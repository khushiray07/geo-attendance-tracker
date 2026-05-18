import { exec, one, query } from '../database';

const OUTSIDE_REASON = 'Employee moved outside office geofence during checked-in session';
const RETURNED_REASON = 'Employee returned inside office geofence';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export async function activeAttendance(organizationId: number, userId: number) {
  return one(
    `SELECT * FROM attendance
     WHERE organization_id = $1 AND user_id = $2 AND date = $3 AND check_in_time IS NOT NULL AND check_out_time IS NULL
       AND attendance_type = 'on_site'
     LIMIT 1`,
    [organizationId, userId, todayIso()]
  );
}

export async function openBreach(attendanceId: number) {
  return one('SELECT * FROM onsite_breaches WHERE attendance_id = $1 AND status = $2 LIMIT 1', [attendanceId, 'open']);
}

export async function breachIntervalsForToday(organizationId: number, userId: number) {
  return query(
    `SELECT * FROM onsite_breaches
     WHERE organization_id = $1 AND user_id = $2 AND date = $3
     ORDER BY started_at ASC`,
    [organizationId, userId, todayIso()]
  );
}

export async function todayBreachMinutes(organizationId: number, userId: number) {
  const row = await one(
    `SELECT COALESCE(SUM(
       CASE WHEN status = 'open'
         THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int
         ELSE COALESCE(duration_minutes, 0)
       END
     ), 0)::int AS minutes
     FROM onsite_breaches
     WHERE organization_id = $1 AND user_id = $2 AND date = $3`,
    [organizationId, userId, todayIso()]
  );
  return Number(row?.minutes || 0);
}

async function logBreach(organizationId: number, userId: number, eventType: string, lat: number | null, lng: number | null, distance: number | null, reason: string) {
  await exec(
    `INSERT INTO attendance_logs (organization_id, user_id, event_type, lat, lng, distance_from_office, accepted, reason, action_by)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$2)`,
    [organizationId, userId, eventType, lat, lng, distance, reason]
  );
}

export async function markOutsideGeofence(attendance: any, lat: number, lng: number, distance: number) {
  const existing = await openBreach(attendance.id);
  if (existing) return existing;

  const breach = await one(
    `INSERT INTO onsite_breaches (organization_id, user_id, attendance_id, date, start_lat, start_lng, distance_from_office, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open')
     RETURNING *`,
    [attendance.organization_id, attendance.user_id, attendance.id, attendance.date, lat, lng, distance]
  );
  await logBreach(attendance.organization_id, attendance.user_id, 'OUTSIDE_GEOFENCE', lat, lng, distance, OUTSIDE_REASON);
  return breach;
}

export async function closeOpenBreach(attendanceId: number, lat: number | null, lng: number | null, distance: number | null, reason = RETURNED_REASON) {
  const breach = await openBreach(attendanceId);
  if (!breach) return null;

  const closed = await one(
    `UPDATE onsite_breaches
     SET ended_at = NOW(),
         duration_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int,
         end_lat = $1,
         end_lng = $2,
         distance_from_office = COALESCE($3, distance_from_office),
         status = 'closed',
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [lat, lng, distance, breach.id]
  );
  await logBreach(breach.organization_id, breach.user_id, 'RETURNED_TO_GEOFENCE', lat, lng, distance, reason);
  return closed;
}

export async function skippedHeartbeat(organizationId: number, userId: number) {
  await exec(
    `INSERT INTO attendance_logs (organization_id, user_id, event_type, accepted, reason, action_by)
     VALUES ($1,$2,'LOCATION_HEARTBEAT_SKIPPED',TRUE,'No active checked-in attendance session',$2)`,
    [organizationId, userId]
  );
}

export async function locationPermissionDenied(organizationId: number, userId: number) {
  await exec(
    `INSERT INTO attendance_logs (organization_id, user_id, event_type, accepted, reason, action_by)
     VALUES ($1,$2,'LOCATION_PERMISSION_DENIED',FALSE,'Location access is required to verify onsite status during checked-in session',$2)`,
    [organizationId, userId]
  );
}

export async function employeeOnsiteStatus(organizationId: number, userId: number) {
  const attendance = await activeAttendance(organizationId, userId);
  const intervals = await breachIntervalsForToday(organizationId, userId);
  const activeBreach = attendance ? await openBreach(attendance.id) : null;
  return {
    insideGeofence: !activeBreach,
    distanceFromOffice: activeBreach ? Math.round(Number(activeBreach.distance_from_office || 0)) : null,
    activeBreach,
    todayBreachMinutes: await todayBreachMinutes(organizationId, userId),
    breachIntervals: intervals,
    message: activeBreach ? 'You are currently outside the configured office radius.' : 'Inside office geofence.'
  };
}

export async function breachSummaryByAttendance(attendanceIds: number[]) {
  if (attendanceIds.length === 0) return new Map<number, { not_onsite_minutes: number; geofence_breach_count: number }>();
  const rows = await query(
    `SELECT attendance_id,
            COALESCE(SUM(CASE WHEN status = 'open' THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int ELSE COALESCE(duration_minutes, 0) END), 0)::int AS not_onsite_minutes,
            COUNT(*)::int AS geofence_breach_count
     FROM onsite_breaches
     WHERE attendance_id = ANY($1::int[])
     GROUP BY attendance_id`,
    [attendanceIds]
  );
  return new Map(rows.map((row) => [Number(row.attendance_id), {
    not_onsite_minutes: Number(row.not_onsite_minutes || 0),
    geofence_breach_count: Number(row.geofence_breach_count || 0)
  }]));
}

export async function adminBreachRows(organizationId: number, date: string) {
  return query(
    `SELECT b.*, u.name, u.email, d.name AS department_name, a.check_in_time,
            CASE WHEN b.status = 'open' THEN 'Outside Geofence' ELSE 'Returned' END AS onsite_status,
            CASE WHEN b.status = 'open' THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - b.started_at)) / 60))::int ELSE b.duration_minutes END AS current_duration_minutes
     FROM onsite_breaches b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     JOIN attendance a ON a.id = b.attendance_id
     WHERE b.organization_id = $1 AND b.date = $2
     ORDER BY b.status = 'open' DESC, b.started_at DESC`,
    [organizationId, date]
  );
}
