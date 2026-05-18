import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateInviteCode, one, query, transaction } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function createToken(user: any) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
}

async function serializeUser(user: any) {
  const organization = user.organization_id
    ? await one('SELECT id, name, invite_code FROM organizations WHERE id = $1', [user.organization_id])
    : null;
  const department = user.department_id
    ? await one('SELECT id, name FROM departments WHERE id = $1', [user.department_id])
    : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    department_id: user.department_id,
    department_name: department?.name || null,
    shift_start_time: String(user.shift_start_time).slice(0, 5),
    is_active: !!user.is_active,
    organization
  };
}

async function uniqueInviteCode(client?: any) {
  let code = generateInviteCode();
  while (true) {
    const result = client
      ? await client.query('SELECT id FROM organizations WHERE invite_code = $1', [code])
      : await query('SELECT id FROM organizations WHERE invite_code = $1', [code]);
    if (!result.rows?.length && !Array.isArray(result)) return code;
    if (Array.isArray(result) && result.length === 0) return code;
    code = generateInviteCode();
  }
}

async function ensureDefaultDepartments(client: any, organizationId: number) {
  for (const name of ['Engineering', 'HR', 'Sales', 'Operations']) {
    await client.query(
      `INSERT INTO departments (organization_id, name)
       VALUES ($1, $2)
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [organizationId, name]
    );
  }
}

router.post('/signup', async (req, res) => {
  const { name, email, password, confirmPassword, mode, organizationName, inviteCode } = req.body;
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanMode = mode === 'join' ? 'join' : 'create';

  if (!cleanName || !cleanEmail || !password) return res.status(400).json({ message: 'Name, email, and password are required' });
  if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  if (confirmPassword !== undefined && password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
  if (await one('SELECT id FROM users WHERE email = $1', [cleanEmail])) return res.status(409).json({ message: 'An account with this email already exists' });

  try {
    const user = await transaction(async (client) => {
      let organizationId: number;
      let role: 'admin' | 'employee';

      if (cleanMode === 'create') {
        const cleanOrgName = String(organizationName || '').trim();
        if (!cleanOrgName) throw new Error('Organization name is required');
        const code = await uniqueInviteCode(client);
        const orgResult = await client.query(
          'INSERT INTO organizations (name, invite_code) VALUES ($1, $2) RETURNING *',
          [cleanOrgName, code]
        );
        organizationId = orgResult.rows[0].id;
        await ensureDefaultDepartments(client, organizationId);
        role = 'admin';
      } else {
        const orgResult = await client.query('SELECT * FROM organizations WHERE UPPER(invite_code) = UPPER($1)', [String(inviteCode || '').trim()]);
        if (!orgResult.rows[0]) throw new Error('Invite code is invalid');
        organizationId = orgResult.rows[0].id;
        role = 'employee';
      }

      const deptResult = await client.query('SELECT id FROM departments WHERE organization_id = $1 ORDER BY name ASC LIMIT 1', [organizationId]);
      const passwordHash = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id, department_id, shift_start_time, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT default_shift_start_time FROM office_settings WHERE organization_id = $5 LIMIT 1), '09:00'), TRUE)
         RETURNING *`,
        [cleanName, cleanEmail, passwordHash, role, organizationId, deptResult.rows[0]?.id || null]
      );
      const createdUser = userResult.rows[0];

      if (cleanMode === 'create') {
        await client.query('UPDATE organizations SET created_by = $1, updated_at = NOW() WHERE id = $2', [createdUser.id, organizationId]);
        await client.query(
          `INSERT INTO office_settings (organization_id, office_name, latitude, longitude, radius_meters, late_threshold_minutes, default_shift_start_time)
           VALUES ($1, 'Main Office', 0, 0, 100, 15, '09:00')`,
          [organizationId]
        );
      }
      return createdUser;
    });

    res.status(201).json({ token: createToken(user), user: await serializeUser(user) });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Unable to create account' });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const user = await one('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !user.is_active) return res.status(401).json({ message: 'Invalid credentials' });
  if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ message: 'Invalid credentials' });
  res.json({ token: createToken(user), user: await serializeUser(user) });
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = await one('SELECT * FROM users WHERE id = $1', [req.user!.id]);
  res.json({ user: await serializeUser(user) });
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
