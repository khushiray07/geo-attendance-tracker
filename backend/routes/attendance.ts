import { Router, Response } from 'express';
import { exec, one, query } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDistanceInMeters } from '../utils/haversine';
import { requestIp, matchesAllowedIpRanges } from '../utils/network';
import { sendLateCheckInEmail } from '../utils/email';
import { attendanceMonthRecords, attendanceSummary } from '../services/attendanceCalendarService';
import { activeAttendance, closeOpenBreach, employeeOnsiteStatus, locationPermissionDenied, markOutsideGeofence, skippedHeartbeat } from '../services/geofenceBreachService';

const router = Router();

type EmailAlert = {
  attempted: boolean;
  sent: boolean;
  skipped: boolean;
  reason: string;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function nowTime() {
  return new Date().toTimeString().split(' ')[0];
}

function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function logAttendance(
  organizationId: number,
  userId: number,
  eventType: string,
  lat: number | null,
  lng: number | null,
  distance: number | null,
  accepted: boolean,
  reason: string | null,
  actionBy?: number | null,
  adminNote?: string | null
) {
  const log = await one(
    `INSERT INTO attendance_logs (organization_id, user_id, event_type, lat, lng, distance_from_office, accepted, reason, action_by, admin_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [organizationId, userId, eventType, lat, lng, distance, accepted, reason, actionBy || userId, adminNote || null]
  );
  return log.id;
}

async function getOffice(organizationId: number) {
  return one('SELECT * FROM office_settings WHERE organization_id = $1 LIMIT 1', [organizationId]);
}

async function validateLocation(req: AuthRequest, eventType: string, res: Response) {
  const body = req.body || {};
  const lat = Number(body.lat ?? req.query.lat);
  const lng = Number(body.lng ?? req.query.lng);
  const organizationId = req.user!.organization_id;
  const userId = req.user!.id;

  if (!isValidLatLng(lat, lng)) {
    await logAttendance(organizationId, userId, eventType, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null, null, false, 'Invalid coordinates');
    res.status(400).json({ message: 'Valid latitude and longitude are required' });
    return null;
  }

  const office = await getOffice(organizationId);
  if (!office || (Number(office.latitude) === 0 && Number(office.longitude) === 0)) {
    await logAttendance(organizationId, userId, eventType, lat, lng, null, false, 'Office location not configured');
    res.status(400).json({ message: 'Office location is not configured yet' });
    return null;
  }

  const distance = getDistanceInMeters(lat, lng, Number(office.latitude), Number(office.longitude));
  if (distance > Number(office.radius_meters)) {
    await logAttendance(organizationId, userId, eventType, lat, lng, distance, false, 'Outside geofence');
    res.status(403).json({ message: 'You are outside the office geofence', distance: Math.round(distance), allowed: office.radius_meters });
    return null;
  }

  return { lat, lng, office, distance };
}

async function officeValidation(req: AuthRequest) {
  const body = req.body || {};
  const lat = Number(body.lat ?? req.query.lat);
  const lng = Number(body.lng ?? req.query.lng);
  if (!isValidLatLng(lat, lng)) return { valid: false, lat, lng, message: 'Valid latitude and longitude are required' };
  const office = await getOffice(req.user!.organization_id);
  if (!office || (Number(office.latitude) === 0 && Number(office.longitude) === 0)) {
    return { valid: false, lat, lng, office, message: 'Office location is not configured yet' };
  }
  const distance = getDistanceInMeters(lat, lng, Number(office.latitude), Number(office.longitude));
  const insideGeofence = distance <= Number(office.radius_meters);
  const ip = requestIp(req);
  const network = matchesAllowedIpRanges(ip, office.allowed_ip_ranges);
  return { valid: true, lat, lng, office, distance, insideGeofence, request_ip: ip, network_configured: network.configured, network_matched: network.matched, eligible: insideGeofence && network.matched };
}

async function maybeSendLateEmail(logId: number, userId: number, organizationId: number, today: string, checkInTime: string, shiftStart: string, lateBy: number): Promise<EmailAlert> {
  try {
    const employee = await one('SELECT name, email FROM users WHERE id = $1', [userId]);
    const organization = await one('SELECT name, created_by FROM organizations WHERE id = $1', [organizationId]);
    const admin = organization?.created_by ? await one('SELECT email FROM users WHERE id = $1', [organization.created_by]) : null;
    console.log('ABOUT TO SEND LATE EMAIL');
    console.log('Attempting late arrival email', {
      userId,
      organizationId,
      employeeEmail: employee.email,
      adminEmail: admin?.email || null,
      date: today,
      checkInTime,
      shiftStart,
      lateByMinutes: lateBy
    });
    const result = await sendLateCheckInEmail({
      employeeName: employee.name,
      employeeEmail: employee.email,
      adminEmail: admin?.email,
      organizationName: organization?.name || 'Organization',
      date: today,
      checkInTime,
      shiftStartTime: shiftStart,
      lateByMinutes: lateBy
    });
    await exec('UPDATE attendance_logs SET email_sent = $1, email_error = $2 WHERE id = $3', [result.sent, result.error, logId]);
    console.log('EMAIL RESULT', {
      attempted: true,
      sent: result.sent,
      skipped: Boolean(result.skipped),
      reason: result.reason || result.error || null
    });
    return {
      attempted: true,
      sent: result.sent,
      skipped: Boolean(result.skipped),
      reason: result.reason || result.error || (result.sent ? 'Late email sent successfully' : 'Late email was not sent')
    };
  } catch (err: any) {
    const message = err.message || 'Unknown error';
    console.error(`Late email failed with error: ${message}`);
    console.log('EMAIL RESULT', {
      attempted: true,
      sent: false,
      skipped: false,
      reason: message
    });
    return { attempted: true, sent: false, skipped: false, reason: message };
  }
}

async function createCheckIn(req: AuthRequest, res: Response, eventType: 'check-in' | 'auto-check-in', reason: string | null) {
  const userId = req.user!.id;
  const organizationId = req.user!.organization_id;
  const today = todayIso();
  console.log('CHECK-IN API HIT', { eventType, userId, organizationId, date: today });
  const location: any = eventType === 'check-in' ? await validateLocation(req, eventType, res) : await officeValidation(req);
  if (!location || (location.valid === false && eventType === 'auto-check-in')) return;
  if ('valid' in location && !location.valid) return res.status(400).json({ message: location.message });
  if ('eligible' in location && !location.eligible) {
    await logAttendance(organizationId, userId, eventType, location.lat, location.lng, location.distance ?? null, false, 'Auto check-in eligibility failed');
    return res.status(403).json({ message: 'Auto check-in is not available from your current location or network' });
  }

  const existing = await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [userId, organizationId, today]);
  if (existing) {
    await logAttendance(organizationId, userId, eventType, location.lat, location.lng, location.distance, false, 'Already checked in today');
    return res.status(400).json({ message: 'You have already checked in today', distance: Math.round(location.distance) });
  }

  const timeString = nowTime();
  const user = await one('SELECT id, name, email, shift_start_time FROM users WHERE id = $1', [userId]);
  console.log('CHECK-IN USER LOADED', {
    id: user.id,
    email: user.email,
    name: user.name
  });
  const shiftStart = String(user.shift_start_time || location.office.default_shift_start_time || '09:00').slice(0, 5);
  const diffMinutes = (new Date(`${today}T${timeString}`).getTime() - new Date(`${today}T${shiftStart}`).getTime()) / 60000;
  const isLate = diffMinutes > Number(location.office.late_threshold_minutes);
  console.log('CHECK-IN LATE CALCULATION', {
    isLate,
    checkInTime: timeString,
    shiftStartTime: shiftStart,
    lateThresholdMinutes: Number(location.office.late_threshold_minutes)
  });
  let emailAlert: EmailAlert = { attempted: false, sent: false, skipped: false, reason: 'Employee was not late' };
  if (isLate) {
    console.log('Late check-in detected', {
      userId,
      organizationId,
      date: today,
      checkInTime: timeString,
      shiftStartTime: shiftStart,
      lateThresholdMinutes: Number(location.office.late_threshold_minutes),
      lateByMinutes: Math.max(0, Math.floor(diffMinutes))
    });
  }

  await exec(
    `INSERT INTO attendance (organization_id, user_id, date, check_in_time, check_in_lat, check_in_lng, is_late, status, attendance_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'on_site')`,
    [organizationId, userId, today, timeString, location.lat, location.lng, isLate, isLate ? 'late' : 'present']
  );
  const successEventType = isLate ? 'CHECK_IN_SUCCESS_LATE' : eventType;
  const logId = await logAttendance(organizationId, userId, successEventType, location.lat, location.lng, location.distance, true, reason || (isLate ? 'Late check-in accepted' : null));
  if (isLate) emailAlert = await maybeSendLateEmail(logId, userId, organizationId, today, timeString, shiftStart, Math.max(0, Math.floor(diffMinutes)));

  const record = await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [userId, organizationId, today]);
  const baseMessage = eventType === 'auto-check-in' ? 'Auto check-in confirmed' : 'Checked in successfully';
  res.json({ message: isLate ? `${baseMessage}, marked late.` : baseMessage, distance: Math.round(location.distance), record, emailAlert });
}

router.post('/check-in', authenticate, async (req: AuthRequest, res: Response) => {
  console.log('CHECK-IN API HIT');
  return createCheckIn(req, res, 'check-in', null);
});

router.post('/check-out', authenticate, async (req: AuthRequest, res: Response) => {
  const location = await validateLocation(req, 'check-out', res);
  if (!location) return;
  const today = todayIso();
  const existing = await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [req.user!.id, req.user!.organization_id, today]);
  if (!existing) {
    await logAttendance(req.user!.organization_id, req.user!.id, 'check-out', location.lat, location.lng, location.distance, false, 'Check-out attempted before check-in');
    return res.status(400).json({ message: 'You have not checked in today', distance: Math.round(location.distance) });
  }
  if (existing.check_out_time) {
    await logAttendance(req.user!.organization_id, req.user!.id, 'check-out', location.lat, location.lng, location.distance, false, 'Already checked out today');
    return res.status(400).json({ message: 'You have already checked out today', distance: Math.round(location.distance) });
  }
  const timeString = nowTime();
  const workingMinutes = Math.max(0, Math.floor((new Date(`${today}T${timeString}`).getTime() - new Date(`${today}T${existing.check_in_time}`).getTime()) / 60000));
  await exec(
    `UPDATE attendance SET check_out_time = $1, check_out_lat = $2, check_out_lng = $3, working_minutes = $4, updated_at = NOW()
     WHERE id = $5 AND organization_id = $6`,
    [timeString, location.lat, location.lng, workingMinutes, existing.id, req.user!.organization_id]
  );
  await closeOpenBreach(existing.id, location.lat, location.lng, location.distance, 'Open Not Onsite interval closed during checkout');
  await logAttendance(req.user!.organization_id, req.user!.id, 'check-out', location.lat, location.lng, location.distance, true, null);
  res.json({ message: 'Checked out successfully', distance: Math.round(location.distance), record: await one('SELECT * FROM attendance WHERE id = $1', [existing.id]) });
});

router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  res.json(await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [req.user!.id, req.user!.organization_id, todayIso()]));
});

router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const rows = month
    ? (await attendanceMonthRecords(req.user!.organization_id, req.user!.id, month)).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : await query('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 ORDER BY date DESC', [req.user!.id, req.user!.organization_id]);
  res.json(rows);
});

router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  const records = await attendanceMonthRecords(req.user!.organization_id, req.user!.id, month);
  res.json(attendanceSummary(records));
});

router.get('/calendar', authenticate, async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  res.json(await attendanceMonthRecords(req.user!.organization_id, req.user!.id, month));
});

router.get('/auto-status', authenticate, async (req: AuthRequest, res: Response) => {
  const validation: any = await officeValidation(req);
  if (!validation.valid) return res.status(400).json({ eligible: false, message: validation.message });
  const record = await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [req.user!.id, req.user!.organization_id, todayIso()]);
  res.json({
    enable_auto_checkin: !!validation.office.enable_auto_checkin,
    enable_auto_checkout: !!validation.office.enable_auto_checkout,
    auto_checkout_grace_minutes: validation.office.auto_checkout_grace_minutes || 5,
    office_network_name_label: validation.office.office_network_name_label,
    request_ip: validation.request_ip,
    network_configured: validation.network_configured,
    network_matched: validation.network_matched,
    inside_geofence: validation.insideGeofence,
    distance: Math.round(validation.distance),
    eligible: !!validation.office.enable_auto_checkin && validation.eligible && !record,
    record
  });
});

router.post('/auto-check-in', authenticate, async (req: AuthRequest, res: Response) => {
  const validation: any = await officeValidation(req);
  if (!validation.valid) return res.status(400).json({ message: validation.message });
  if (!validation.office.enable_auto_checkin) return res.status(400).json({ message: 'Auto check-in is not enabled for this organization' });
  return createCheckIn(req, res, 'auto-check-in', 'Confirmed auto check-in');
});

router.post('/auto-check-out', authenticate, async (req: AuthRequest, res: Response) => {
  const validation: any = await officeValidation(req);
  if (!validation.valid) return res.status(400).json({ message: validation.message });
  if (!validation.office.enable_auto_checkout) return res.status(400).json({ message: 'Auto checkout is not enabled for this organization' });
  const today = todayIso();
  const existing = await one('SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND date = $3', [req.user!.id, req.user!.organization_id, today]);
  if (!existing || existing.check_out_time) return res.status(400).json({ message: existing ? 'You have already checked out today' : 'You have not checked in today' });
  const timeString = nowTime();
  const workingMinutes = Math.max(0, Math.floor((new Date(`${today}T${timeString}`).getTime() - new Date(`${today}T${existing.check_in_time}`).getTime()) / 60000));
  await exec('UPDATE attendance SET check_out_time = $1, check_out_lat = $2, check_out_lng = $3, working_minutes = $4, updated_at = NOW() WHERE id = $5', [timeString, validation.lat, validation.lng, workingMinutes, existing.id]);
  await closeOpenBreach(existing.id, validation.lat, validation.lng, validation.distance, 'Open Not Onsite interval closed during auto checkout');
  await logAttendance(req.user!.organization_id, req.user!.id, 'auto-check-out', validation.lat, validation.lng, validation.distance, true, 'Auto checkout triggered because user moved outside office radius');
  res.json({ message: 'Auto checkout marked', distance: Math.round(validation.distance), record: await one('SELECT * FROM attendance WHERE id = $1', [existing.id]) });
});

router.post('/location-heartbeat', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.body?.permission_denied === true) {
    await locationPermissionDenied(req.user!.organization_id, req.user!.id);
    const status = await employeeOnsiteStatus(req.user!.organization_id, req.user!.id);
    return res.status(400).json({
      ...status,
      message: 'Location access is required to verify onsite status during checked-in session.'
    });
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!isValidLatLng(lat, lng)) return res.status(400).json({ message: 'Valid latitude and longitude are required' });

  const attendance = await activeAttendance(req.user!.organization_id, req.user!.id);
  if (!attendance) {
    await skippedHeartbeat(req.user!.organization_id, req.user!.id);
    return res.json({
      insideGeofence: true,
      distanceFromOffice: null,
      activeBreach: null,
      breachIntervals: [],
      todayBreachMinutes: 0,
      message: 'No active checked-in attendance session'
    });
  }

  const office = await getOffice(req.user!.organization_id);
  if (!office) return res.status(400).json({ message: 'Office location is not configured yet' });
  const distance = getDistanceInMeters(lat, lng, Number(office.latitude), Number(office.longitude));
  const insideGeofence = distance <= Number(office.radius_meters);

  if (insideGeofence) {
    await closeOpenBreach(attendance.id, lat, lng, distance);
  } else {
    await markOutsideGeofence(attendance, lat, lng, distance);
  }

  const status = await employeeOnsiteStatus(req.user!.organization_id, req.user!.id);
  res.json({
    ...status,
    insideGeofence,
    distanceFromOffice: Math.round(distance),
    message: insideGeofence ? 'Inside office geofence.' : 'You are currently outside the configured office radius. This interval will be marked as Not Onsite until you return.'
  });
});

router.get('/onsite-status', authenticate, async (req: AuthRequest, res: Response) => {
  res.json(await employeeOnsiteStatus(req.user!.organization_id, req.user!.id));
});

export default router;
