import { Router } from 'express';
import { exec, generateInviteCode, one } from '../database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

async function uniqueInviteCode() {
  let code = generateInviteCode();
  while (await one('SELECT id FROM organizations WHERE invite_code = $1', [code])) {
    code = generateInviteCode();
  }
  return code;
}

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const org = await one(
    `SELECT o.*, COUNT(u.id)::int AS employee_count
     FROM organizations o
     LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = TRUE
     WHERE o.id = $1
     GROUP BY o.id`,
    [req.user!.organization_id]
  );
  res.json(org);
});

router.post('/create', authenticate, async (req: AuthRequest, res) => {
  if (req.user!.organization_id) return res.status(400).json({ message: 'You already belong to an organization' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Organization name is required' });

  const org = await one(
    `INSERT INTO organizations (name, invite_code, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, await uniqueInviteCode(), req.user!.id]
  );
  await exec('UPDATE users SET role = $1, organization_id = $2, updated_at = NOW() WHERE id = $3', ['admin', org.id, req.user!.id]);
  await exec(
    `INSERT INTO office_settings (organization_id, office_name, latitude, longitude, radius_meters, late_threshold_minutes, default_shift_start_time)
     VALUES ($1, 'Main Office', 0, 0, 100, 15, '09:00')`,
    [org.id]
  );
  res.status(201).json(org);
});

router.post('/join', authenticate, async (req: AuthRequest, res) => {
  if (req.user!.organization_id) return res.status(400).json({ message: 'You already belong to an organization' });
  const org = await one('SELECT * FROM organizations WHERE UPPER(invite_code) = UPPER($1)', [String(req.body.inviteCode || '').trim()]);
  if (!org) return res.status(404).json({ message: 'Invite code is invalid' });
  await exec('UPDATE users SET role = $1, organization_id = $2, updated_at = NOW() WHERE id = $3', ['employee', org.id, req.user!.id]);
  res.json(org);
});

router.get('/invite-code', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const org = await one('SELECT invite_code FROM organizations WHERE id = $1', [req.user!.organization_id]);
  res.json({ invite_code: org.invite_code });
});

router.post('/regenerate-invite-code', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const code = await uniqueInviteCode();
  await exec('UPDATE organizations SET invite_code = $1, updated_at = NOW() WHERE id = $2', [code, req.user!.organization_id]);
  res.json({ invite_code: code });
});

export default router;
