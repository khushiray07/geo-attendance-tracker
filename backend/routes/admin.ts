import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { exec, one, query } from '../database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { attendanceMonthRecords } from '../services/attendanceCalendarService';
import { autoCheckoutMissedPunches } from '../services/autoCheckoutService';
import { adminBreachRows } from '../services/geofenceBreachService';

const router = Router();
router.use(authenticate, requireAdmin);

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function csv(rows: any[]) {
  const headers = ['Date', 'Employee', 'Department', 'Email', 'Attendance Type', 'Check In', 'Check Out', 'Working Minutes', 'Status', 'Late', 'Not Onsite Minutes', 'Geofence Breach Count', 'Admin Note'];
  const lines = rows.map((row) => [
    row.date, row.name, row.department_name || '', row.email, row.attendance_type || 'on_site',
    row.check_in_time || '', row.check_out_time || '', row.working_minutes || 0,
    row.status || '', row.is_late ? 'Yes' : 'No', row.not_onsite_minutes || 0, row.geofence_breach_count || 0, row.admin_note || ''
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...lines].join('\n');
}

async function reportRows(organizationId: number, month: string, employeeId = 'all', status = 'all', departmentId = 'all', search = '') {
  const params: any[] = [organizationId, month];
  let sql = `
    SELECT a.*, u.name, u.email, d.name AS department_name,
           COALESCE(b.not_onsite_minutes, 0)::int AS not_onsite_minutes,
           COALESCE(b.geofence_breach_count, 0)::int AS geofence_breach_count
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN (
      SELECT attendance_id,
             COALESCE(SUM(CASE WHEN status = 'open' THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))::int ELSE COALESCE(duration_minutes, 0) END), 0)::int AS not_onsite_minutes,
             COUNT(*)::int AS geofence_breach_count
      FROM onsite_breaches
      GROUP BY attendance_id
    ) b ON b.attendance_id = a.id
    WHERE a.organization_id = $1 AND to_char(a.date, 'YYYY-MM') = $2
  `;
  if (employeeId !== 'all') {
    params.push(Number(employeeId));
    sql += ` AND a.user_id = $${params.length}`;
  }
  if (departmentId !== 'all') {
    params.push(Number(departmentId));
    sql += ` AND u.department_id = $${params.length}`;
  }
  if (status !== 'all') {
    if (status === 'late') sql += ' AND a.is_late = TRUE';
    else if (status === 'missing_checkout') sql += " AND ((a.check_in_time IS NOT NULL AND a.check_out_time IS NULL) OR LOWER(a.status) IN ('missing_checkout_auto_closed','auto_checkout'))";
    else if (status === 'present') sql += ' AND a.check_in_time IS NOT NULL AND a.is_late = FALSE';
    else if (['work_from_home', 'on_duty', 'leave', 'on_site'].includes(status)) {
      params.push(status);
      sql += ` AND a.attendance_type = $${params.length}`;
    }
  }
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    sql += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(COALESCE(d.name, '')) LIKE $${params.length})`;
  }
  sql += ' ORDER BY a.date DESC, a.check_in_time DESC NULLS LAST';
  return query(sql, params);
}

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : todayIso();
  const departmentId = String(req.query.department_id || 'all');
  const employeeParams: any[] = [req.user!.organization_id];
  let departmentClause = '';
  if (departmentId !== 'all') {
    employeeParams.push(Number(departmentId));
    departmentClause = ` AND department_id = $${employeeParams.length}`;
  }

  const totals = await one(
    `SELECT COUNT(*)::int AS total_employees,
            COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0)::int AS active_employees
     FROM users WHERE organization_id = $1 AND role = 'employee'${departmentClause}`,
    employeeParams
  );

  const attendanceParams: any[] = [req.user!.organization_id, date];
  let attendanceClause = '';
  if (departmentId !== 'all') {
    attendanceParams.push(Number(departmentId));
    attendanceClause = ` AND u.department_id = $${attendanceParams.length}`;
  }
  const attendance = await one(
    `SELECT
      COALESCE(SUM(CASE WHEN a.check_in_time IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS present_today,
      COALESCE(SUM(CASE WHEN a.is_late THEN 1 ELSE 0 END), 0)::int AS late_arrivals,
      COALESCE(SUM(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN 1 ELSE 0 END), 0)::int AS missing_checkouts,
      COALESCE(SUM(CASE WHEN a.attendance_type = 'work_from_home' THEN 1 ELSE 0 END), 0)::int AS wfh_today,
      COALESCE(SUM(CASE WHEN a.attendance_type = 'on_duty' THEN 1 ELSE 0 END), 0)::int AS on_duty_today,
      COALESCE(SUM(CASE WHEN a.attendance_type = 'leave' THEN 1 ELSE 0 END), 0)::int AS leave_today
     FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE a.organization_id = $1 AND a.date = $2${attendanceClause}`,
    attendanceParams
  );

  const employees = await query(
    `SELECT u.id AS user_id, u.name, u.email, u.shift_start_time, u.is_active, d.name AS department_name,
            a.id, a.date, a.check_in_time, a.check_out_time, a.working_minutes, a.is_late, a.status, a.attendance_type, a.admin_note
     FROM users u
     LEFT JOIN attendance a ON a.user_id = u.id AND a.organization_id = u.organization_id AND a.date = $2
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.organization_id = $1 AND u.role = 'employee'${departmentId !== 'all' ? ' AND u.department_id = $3' : ''}
     ORDER BY u.is_active DESC, u.name ASC`,
    departmentId !== 'all' ? [req.user!.organization_id, date, Number(departmentId)] : [req.user!.organization_id, date]
  );

  res.json({ ...totals, ...attendance, employees });
});

router.get('/employees', async (req: AuthRequest, res: Response) => {
  res.json(await query(
    `SELECT u.id, u.name, u.email, u.role, u.shift_start_time, u.is_active, u.department_id,
            d.name AS department_name, u.created_at
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.organization_id = $1 AND u.role = 'employee'
     ORDER BY u.is_active DESC, u.name ASC`,
    [req.user!.organization_id]
  ));
});

router.post('/employees', async (req: AuthRequest, res: Response) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const shift = String(req.body.shift_start_time || '09:00');
  const departmentId = req.body.department_id ? Number(req.body.department_id) : null;
  if (!name || !email || password.length < 8) return res.status(400).json({ message: 'Name, email, and an 8+ character password are required' });
  if (!/^\d{2}:\d{2}$/.test(shift)) return res.status(400).json({ message: 'Shift start time must use HH:MM format' });
  if (await one('SELECT id FROM users WHERE email = $1', [email])) return res.status(409).json({ message: 'An account with this email already exists' });
  if (departmentId && !await one('SELECT id FROM departments WHERE id = $1 AND organization_id = $2', [departmentId, req.user!.organization_id])) {
    return res.status(400).json({ message: 'Department is invalid' });
  }
  const employee = await one(
    `INSERT INTO users (name, email, password_hash, role, organization_id, department_id, shift_start_time, is_active)
     VALUES ($1,$2,$3,'employee',$4,$5,$6,TRUE) RETURNING id, name, email, role, department_id, shift_start_time, is_active, created_at`,
    [name, email, await bcrypt.hash(password, 10), req.user!.organization_id, departmentId, shift]
  );
  res.status(201).json(employee);
});

router.put('/employees/:id', async (req: AuthRequest, res: Response) => {
  const employeeId = Number(req.params.id);
  const existing = await one('SELECT * FROM users WHERE id = $1 AND organization_id = $2 AND role = $3', [employeeId, req.user!.organization_id, 'employee']);
  if (!existing) return res.status(404).json({ message: 'Employee not found' });
  const departmentId = req.body.department_id === undefined ? existing.department_id : (req.body.department_id ? Number(req.body.department_id) : null);
  const employee = await one(
    `UPDATE users SET name = $1, shift_start_time = $2, department_id = $3, is_active = $4, updated_at = NOW()
     WHERE id = $5 AND organization_id = $6
     RETURNING id, name, email, role, department_id, shift_start_time, is_active, created_at`,
    [String(req.body.name ?? existing.name).trim(), String(req.body.shift_start_time ?? existing.shift_start_time).slice(0, 5), departmentId, req.body.is_active === undefined ? existing.is_active : !!req.body.is_active, employeeId, req.user!.organization_id]
  );
  res.json(employee);
});

router.put('/employees/:id/department', async (req: AuthRequest, res: Response) => {
  const departmentId = req.body.department_id ? Number(req.body.department_id) : null;
  if (departmentId && !await one('SELECT id FROM departments WHERE id = $1 AND organization_id = $2', [departmentId, req.user!.organization_id])) return res.status(400).json({ message: 'Department is invalid' });
  await exec('UPDATE users SET department_id = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3 AND role = $4', [departmentId, Number(req.params.id), req.user!.organization_id, 'employee']);
  res.json({ message: 'Department updated' });
});

router.put('/employees/:id/shift', async (req: AuthRequest, res: Response) => {
  const shift = String(req.body.shift_start_time || '');
  if (!/^\d{2}:\d{2}$/.test(shift)) return res.status(400).json({ message: 'Shift start time must use HH:MM format' });
  await exec('UPDATE users SET shift_start_time = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3 AND role = $4', [shift, Number(req.params.id), req.user!.organization_id, 'employee']);
  res.json({ message: 'Shift updated' });
});

router.get('/departments', async (req: AuthRequest, res: Response) => {
  res.json(await query('SELECT * FROM departments WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organization_id]));
});

router.post('/departments', async (req: AuthRequest, res: Response) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Department name is required' });
  try {
    res.status(201).json(await one('INSERT INTO departments (organization_id, name) VALUES ($1, $2) RETURNING *', [req.user!.organization_id, name]));
  } catch {
    res.status(409).json({ message: 'Department already exists' });
  }
});

router.put('/departments/:id', async (req: AuthRequest, res: Response) => {
  const dept = await one('UPDATE departments SET name = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3 RETURNING *', [String(req.body.name || '').trim(), Number(req.params.id), req.user!.organization_id]);
  if (!dept) return res.status(404).json({ message: 'Department not found' });
  res.json(dept);
});

router.delete('/departments/:id', async (req: AuthRequest, res: Response) => {
  await exec('UPDATE users SET department_id = NULL WHERE department_id = $1 AND organization_id = $2', [Number(req.params.id), req.user!.organization_id]);
  await exec('DELETE FROM departments WHERE id = $1 AND organization_id = $2', [Number(req.params.id), req.user!.organization_id]);
  res.json({ message: 'Department deleted' });
});

router.get('/attendance/today', async (req: AuthRequest, res: Response) => {
  res.json((await query(
    `SELECT u.id AS user_id, u.name, u.email, u.shift_start_time, u.is_active, d.name AS department_name,
            a.id, a.date, a.check_in_time, a.check_out_time, a.working_minutes, a.is_late, a.status, a.attendance_type, a.admin_note
     FROM users u
     LEFT JOIN attendance a ON a.user_id = u.id AND a.organization_id = u.organization_id AND a.date = $2
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.organization_id = $1 AND u.role = 'employee'
     ORDER BY a.check_in_time DESC NULLS LAST, u.name ASC`,
    [req.user!.organization_id, todayIso()]
  )));
});

router.get('/attendance/geofence-breaches', async (req: AuthRequest, res: Response) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : todayIso();
  res.json(await adminBreachRows(req.user!.organization_id, date));
});

router.get('/attendance/report', async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  res.json(await reportRows(req.user!.organization_id, month, String(req.query.employee_id || 'all'), String(req.query.status || 'all'), String(req.query.department_id || 'all'), String(req.query.search || '')));
});

router.get('/attendance/report/export', async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  const rows = await reportRows(req.user!.organization_id, month, String(req.query.employee_id || 'all'), String(req.query.status || 'all'), String(req.query.department_id || 'all'), String(req.query.search || ''));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${month}.csv"`);
  res.send(csv(rows));
});

router.post('/attendance/auto-checkout', async (req: AuthRequest, res: Response) => {
  const result = await autoCheckoutMissedPunches(req.user!.organization_id, req.user!.id);
  res.json({
    message: `Auto checkout completed for ${result.closedCount} missed punch-out record(s).`,
    ...result
  });
});

router.post('/attendance/exception', async (req: AuthRequest, res: Response) => {
  const employeeId = Number(req.body.employee_id);
  const date = String(req.body.date || '');
  const type = String(req.body.attendance_type || '');
  const note = String(req.body.reason || req.body.admin_note || '').trim();
  if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['work_from_home', 'on_duty', 'leave', 'on_site'].includes(type)) return res.status(400).json({ message: 'Employee, date, and attendance type are required' });
  if (!note) return res.status(400).json({ message: 'Reason is required' });
  const employee = await one('SELECT * FROM users WHERE id = $1 AND organization_id = $2 AND role = $3', [employeeId, req.user!.organization_id, 'employee']);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  const status = type === 'leave' ? 'leave' : type === 'work_from_home' ? 'wfh' : type === 'on_duty' ? 'on_duty' : 'present';
  const record = await one(
    `INSERT INTO attendance (organization_id, user_id, date, attendance_type, status, admin_marked_by, admin_note, is_late)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)
     ON CONFLICT (user_id, date) DO UPDATE SET attendance_type = EXCLUDED.attendance_type, status = EXCLUDED.status, admin_marked_by = EXCLUDED.admin_marked_by, admin_note = EXCLUDED.admin_note, updated_at = NOW()
     RETURNING *`,
    [req.user!.organization_id, employeeId, date, type, status, req.user!.id, note]
  );
  await exec('INSERT INTO attendance_logs (organization_id, user_id, event_type, accepted, reason, action_by, admin_note) VALUES ($1,$2,$3,TRUE,$4,$5,$6)', [req.user!.organization_id, employeeId, 'admin-exception', `Marked ${type}`, req.user!.id, note]);
  res.json({ message: 'Attendance exception saved', record });
});

router.get('/attendance/employee/:employeeId/calendar', async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  const employee = await one('SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND role = $3', [Number(req.params.employeeId), req.user!.organization_id, 'employee']);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  res.json(await attendanceMonthRecords(req.user!.organization_id, Number(req.params.employeeId), month));
});

router.get('/reports/employee/:employeeId', async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  const employeeId = Number(req.params.employeeId);
  const records = await reportRows(req.user!.organization_id, month, String(employeeId), 'all', 'all', String(req.query.search || ''));
  const summary = await one(
    `SELECT COUNT(*)::int AS total_days,
      COALESCE(SUM(CASE WHEN check_in_time IS NOT NULL OR attendance_type IN ('work_from_home','on_duty') THEN 1 ELSE 0 END), 0)::int AS present_days,
      COALESCE(SUM(CASE WHEN is_late THEN 1 ELSE 0 END), 0)::int AS late_days,
      COALESCE(SUM(CASE WHEN attendance_type = 'work_from_home' THEN 1 ELSE 0 END), 0)::int AS wfh_days,
      COALESCE(SUM(CASE WHEN attendance_type = 'on_duty' THEN 1 ELSE 0 END), 0)::int AS on_duty_days,
      COALESCE(SUM(CASE WHEN attendance_type = 'leave' THEN 1 ELSE 0 END), 0)::int AS leave_days,
      COALESCE((SELECT SUM(CASE WHEN b.status = 'open' THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - b.started_at)) / 60))::int ELSE COALESCE(b.duration_minutes, 0) END) FROM onsite_breaches b JOIN attendance ba ON ba.id = b.attendance_id WHERE ba.organization_id = $1 AND ba.user_id = $2 AND to_char(ba.date, 'YYYY-MM') = $3), 0)::int AS not_onsite_minutes,
      COALESCE((SELECT COUNT(*) FROM onsite_breaches b JOIN attendance ba ON ba.id = b.attendance_id WHERE ba.organization_id = $1 AND ba.user_id = $2 AND to_char(ba.date, 'YYYY-MM') = $3), 0)::int AS geofence_breach_count,
      COALESCE(SUM(working_minutes), 0)::int AS working_minutes
     FROM attendance WHERE organization_id = $1 AND user_id = $2 AND to_char(date, 'YYYY-MM') = $3`,
    [req.user!.organization_id, employeeId, month]
  );
  res.json({ summary, records });
});

router.get('/reports/employee/:employeeId/export', async (req: AuthRequest, res: Response) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : new Date().toISOString().substring(0, 7);
  const rows = await reportRows(req.user!.organization_id, month, String(Number(req.params.employeeId)), 'all', 'all', String(req.query.search || ''));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="employee_${req.params.employeeId}_attendance_${month}.csv"`);
  res.send(csv(rows));
});

router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  res.json(await query(
    `SELECT l.*, u.name, u.email
     FROM attendance_logs l
     JOIN users u ON l.user_id = u.id
     WHERE l.organization_id = $1
     ORDER BY l.timestamp DESC
     LIMIT 200`,
    [req.user!.organization_id]
  ));
});

export default router;
