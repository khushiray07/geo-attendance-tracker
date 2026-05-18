CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  shift_start_time TIME NOT NULL DEFAULT '09:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_settings (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  office_name TEXT DEFAULT 'Main Office',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  default_shift_start_time TIME DEFAULT '09:00',
  office_network_name_label TEXT,
  allowed_ip_ranges TEXT,
  enable_auto_checkin BOOLEAN DEFAULT FALSE,
  enable_auto_checkout BOOLEAN DEFAULT FALSE,
  auto_checkout_grace_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIME,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_time TIME,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  working_minutes INTEGER DEFAULT 0,
  is_late BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'present',
  attendance_type TEXT DEFAULT 'on_site' CHECK (attendance_type IN ('on_site', 'work_from_home', 'on_duty', 'leave')),
  admin_marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_from_office DOUBLE PRECISION,
  accepted BOOLEAN NOT NULL,
  reason TEXT,
  action_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  email_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_type ON attendance(attendance_type);
CREATE INDEX IF NOT EXISTS idx_logs_org_time ON attendance_logs(organization_id, timestamp);
