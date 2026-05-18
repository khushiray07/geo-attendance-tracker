import { Router, Response } from 'express';
import { query } from '../database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

async function rows(req: AuthRequest) {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : new Date().toISOString().substring(0, 7);

  return query(
    `SELECT a.*, u.name, u.email, d.name AS department_name
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE a.organization_id = $1 AND to_char(a.date, 'YYYY-MM') = $2
     ORDER BY a.date DESC, a.check_in_time DESC`,
    [req.user!.organization_id, month]
  );
}

function toCsv(records: any[]) {
  const headers = ['Date', 'Employee', 'Department', 'Email', 'Attendance Type', 'Check In', 'Check Out', 'Working Minutes', 'Status', 'Late', 'Admin Note'];
  const lines = records.map((row) => [
    row.date,
    row.name,
    row.department_name || '',
    row.email,
    row.attendance_type || 'on_site',
    row.check_in_time || '',
    row.check_out_time || '',
    row.working_minutes || 0,
    row.status || '',
    row.is_late ? 'Yes' : 'No',
    row.admin_note || ''
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...lines].join('\n');
}

router.get('/monthly', async (req: AuthRequest, res: Response) => {
  res.json(await rows(req));
});

router.get('/monthly/export', async (req: AuthRequest, res: Response) => {
  const month = String(req.query.month || new Date().toISOString().substring(0, 7));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${month}.csv"`);
  res.send(toCsv(await rows(req)));
});

export default router;
