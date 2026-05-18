import { query } from '../database';
import { breachSummaryByAttendance } from './geofenceBreachService';

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return { start, end };
}

function isWorkingDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export async function attendanceMonthRecords(organizationId: number, userId: number, month: string) {
  const records = await query(
    'SELECT * FROM attendance WHERE user_id = $1 AND organization_id = $2 AND to_char(date, $3) = $4 ORDER BY date ASC',
    [userId, organizationId, 'YYYY-MM', month]
  );
  const breachSummary = await breachSummaryByAttendance(records.map((record) => Number(record.id)).filter(Boolean));
  for (const record of records) {
    const summary = breachSummary.get(Number(record.id));
    record.not_onsite_minutes = summary?.not_onsite_minutes || 0;
    record.geofence_breach_count = summary?.geofence_breach_count || 0;
  }
  const recordByDate = new Map(records.map((record) => [String(record.date), record]));
  const { start, end } = monthBounds(month);
  const today = new Date();
  const todayKey = toDateKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  const result = [...records];

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = toDateKey(cursor);
    if (recordByDate.has(dateKey) || !isWorkingDay(cursor)) continue;

    if (dateKey < todayKey) {
      result.push({
        id: `absent-${userId}-${dateKey}`,
        organization_id: organizationId,
        user_id: userId,
        date: dateKey,
        check_in_time: null,
        check_out_time: null,
        working_minutes: 0,
        is_late: false,
        status: 'absent',
        attendance_type: 'on_site',
        admin_note: 'No attendance record for this working day',
        virtual: true
      });
    } else if (dateKey === todayKey) {
      result.push({
        id: `pending-${userId}-${dateKey}`,
        organization_id: organizationId,
        user_id: userId,
        date: dateKey,
        check_in_time: null,
        check_out_time: null,
        working_minutes: 0,
        is_late: false,
        status: 'pending',
        attendance_type: 'on_site',
        admin_note: 'Not checked in yet',
        virtual: true
      });
    }
  }

  return result.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function attendanceSummary(records: any[]) {
  return records.reduce((summary, record) => {
    const status = String(record.status || '').toLowerCase();
    const type = String(record.attendance_type || 'on_site');
    const hasPresence = !!record.check_in_time || ['work_from_home', 'on_duty'].includes(type) || ['present', 'late', 'missing_checkout_auto_closed', 'auto_checkout'].includes(status);

    if (hasPresence) summary.present_days += 1;
    if (record.is_late || status === 'late') summary.late_days += 1;
    if (status === 'absent') summary.absent_days += 1;
    if (type === 'work_from_home') summary.wfh_days += 1;
    if (type === 'on_duty') summary.on_duty_days += 1;
    if (type === 'leave') summary.leave_days += 1;
    if (record.check_in_time && !record.check_out_time) summary.missing_checkouts += 1;
    summary.not_onsite_minutes += Number(record.not_onsite_minutes || 0);
    summary.geofence_breach_count += Number(record.geofence_breach_count || 0);
    summary.working_minutes += Number(record.working_minutes || 0);
    return summary;
  }, {
    present_days: 0,
    late_days: 0,
    absent_days: 0,
    wfh_days: 0,
    on_duty_days: 0,
    leave_days: 0,
    missing_checkouts: 0,
    not_onsite_minutes: 0,
    geofence_breach_count: 0,
    working_minutes: 0
  });
}
