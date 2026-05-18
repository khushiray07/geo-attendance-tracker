import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { one, exec, pool } from '../database';

dotenv.config();

const office = {
  latitude: Number(process.env.SEED_OFFICE_LAT || 12.8728198074464),
  longitude: Number(process.env.SEED_OFFICE_LNG || 77.6185537861114)
};

async function upsertUser(user: {
  name: string;
  email: string;
  role: 'admin' | 'employee';
  organizationId: number;
  departmentId: number | null;
  shift: string;
}) {
  const passwordHash = await bcrypt.hash('password123', 10);
  const existing = await one('SELECT * FROM users WHERE email = $1', [user.email]);
  if (existing) return existing;

  return one(
    `INSERT INTO users (name, email, password_hash, role, organization_id, department_id, shift_start_time, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     RETURNING *`,
    [user.name, user.email, passwordHash, user.role, user.organizationId, user.departmentId, user.shift]
  );
}

async function seed() {
  let org = await one('SELECT * FROM organizations WHERE invite_code = $1', ['DEMOHQ']);
  if (!org) {
    org = await one(
      'INSERT INTO organizations (name, invite_code) VALUES ($1, $2) RETURNING *',
      ['Demo Organization', 'DEMOHQ']
    );
  }

  const departmentNames = ['Engineering', 'HR', 'Sales', 'Operations'];
  const departments: Record<string, any> = {};
  for (const name of departmentNames) {
    departments[name] = await one(
      `INSERT INTO departments (organization_id, name)
       VALUES ($1, $2)
       ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [org.id, name]
    );
  }

  const admin = await upsertUser({
    name: 'Admin User',
    email: 'admin@demo.com',
    role: 'admin',
    organizationId: org.id,
    departmentId: departments.Operations.id,
    shift: '09:00'
  });

  await exec('UPDATE organizations SET created_by = $1, updated_at = NOW() WHERE id = $2', [admin.id, org.id]);
  await exec(
    `INSERT INTO office_settings (
      organization_id, office_name, latitude, longitude, radius_meters, late_threshold_minutes,
      default_shift_start_time, shift_checkout_time, office_network_name_label, allowed_ip_ranges,
      auto_checkout_enabled, enable_auto_checkin, enable_auto_checkout, auto_checkout_grace_minutes
    )
    VALUES ($1, 'Main Office', $2, $3, 150, 15, '09:00', '23:59', 'Main Office Network', '', TRUE, TRUE, TRUE, 5)
    ON CONFLICT (organization_id) DO UPDATE SET
      office_name = EXCLUDED.office_name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      radius_meters = EXCLUDED.radius_meters,
      late_threshold_minutes = EXCLUDED.late_threshold_minutes,
      default_shift_start_time = EXCLUDED.default_shift_start_time,
      shift_checkout_time = EXCLUDED.shift_checkout_time,
      auto_checkout_enabled = EXCLUDED.auto_checkout_enabled,
      updated_at = NOW()`,
    [org.id, office.latitude, office.longitude]
  );

  const employees = [
    ['Aarav Engineer', 'employee@demo.com', 'Engineering'],
    ['Meera Backend', 'meera@demo.com', 'Engineering'],
    ['Rohan Sales', 'rohan@demo.com', 'Sales'],
    ['Nisha HR', 'nisha@demo.com', 'HR'],
    ['Kabir Ops', 'kabir@demo.com', 'Operations']
  ] as const;

  const seededEmployees = [];
  for (const [name, email, department] of employees) {
    seededEmployees.push(await upsertUser({
      name,
      email,
      role: 'employee',
      organizationId: org.id,
      departmentId: departments[department].id,
      shift: '09:00'
    }));
  }

  const today = new Date().toISOString().split('T')[0];
  const samples = [
    [seededEmployees[0].id, today, '09:02', '17:45', 523, false, 'present', 'on_site', null],
    [seededEmployees[1].id, today, '09:45', '18:10', 505, true, 'late', 'on_site', null],
    [seededEmployees[2].id, today, '09:05', null, 0, false, 'present', 'on_site', null],
    [seededEmployees[3].id, today, null, null, 0, false, 'wfh', 'work_from_home', 'Approved remote work'],
    [seededEmployees[4].id, today, null, null, 0, false, 'on_duty', 'on_duty', 'Client site visit']
  ];

  for (const row of samples) {
    await exec(
      `INSERT INTO attendance (
        organization_id, user_id, date, check_in_time, check_out_time, working_minutes,
        is_late, status, attendance_type, admin_marked_by, admin_note
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (user_id, date) DO UPDATE SET
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        working_minutes = EXCLUDED.working_minutes,
        is_late = EXCLUDED.is_late,
        status = EXCLUDED.status,
        attendance_type = EXCLUDED.attendance_type,
        admin_marked_by = EXCLUDED.admin_marked_by,
        admin_note = EXCLUDED.admin_note,
        updated_at = NOW()`,
      [org.id, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], admin.id, row[8]]
    );
  }

  await exec(
    `INSERT INTO attendance_logs (organization_id, user_id, event_type, accepted, reason, action_by, admin_note)
     VALUES ($1, $2, 'seed-demo', TRUE, 'Demo seed data created', $3, 'Hackathon demo data')
     ON CONFLICT DO NOTHING`,
    [org.id, admin.id, admin.id]
  );

  console.log('Seed complete.');
  console.log('Admin: admin@demo.com / password123');
  console.log('Employee: employee@demo.com / password123');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
