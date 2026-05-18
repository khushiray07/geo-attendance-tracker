# Geo Attendance Tracker

Hackathon-ready employee attendance system with browser geolocation, server-side geofence validation, JWT auth, PostgreSQL storage, admin reporting, audit logs, and CSV export.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT
- Location: Browser Geolocation API
- Validation: Backend Haversine distance check

## Features

- Real signup/login plus optional demo accounts
- Admin creates an organization and invite code
- Employees join by invite code
- Server-side check-in/check-out validation
- Duplicate check-in rejection
- Check-out without check-in rejection
- Server-side working minutes calculation
- Server-side late arrival calculation
- Configurable missed punch-out auto checkout with audit logs
- Foreground geofence heartbeat tracking for Not Onsite intervals while employees are checked in
- Departments: Engineering, HR, Sales, Operations
- WFH, On Duty, Leave, and on-site admin exceptions
- Audit logs for punch attempts, rejections, admin exceptions, and auto checkout
- Office settings with geofence radius, shift start, late threshold, optional IP/network support
- Employee dashboard, attendance history, and calendar view
- Admin dashboard, employee management, calendar, reports, and CSV export
- Optional late check-in email via SMTP
- Late-arrival email alerts are optional. If SMTP variables are not configured, check-in still succeeds and the backend logs: `Late email skipped because SMTP is not configured.`

## Ports

- Frontend: http://localhost:5173
- Backend: http://localhost:5005
- PostgreSQL: localhost:55432

## Setup

1. Install dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Configure backend environment:

```bash
cd backend
cp .env.example .env
```

Update `JWT_SECRET` in `.env` before a real deployment.

4. Run migration and seed:

```bash
cd backend
npm run migrate
npm run seed
```

5. Start backend:

```bash
cd backend
npm run dev
```

6. Start frontend:

```bash
cd frontend
npm run dev
```

## Environment Variables

Backend `.env`:

```env
PORT=5005
DATABASE_URL=postgres://postgres:postgres@localhost:55432/geo_attendance_tracker
DATABASE_SSL=false
JWT_SECRET=replace-with-a-long-random-secret

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

SEED_OFFICE_LAT=12.8728198074464
SEED_OFFICE_LNG=77.6185537861114
```

If SMTP variables are empty, late check-in email is skipped safely and the app keeps working.

For local development, `DATABASE_URL` must point to a database reachable from your machine, such as the Docker URL above or Render's external database URL. Render internal hostnames like `dpg-...-a` only resolve from services running inside Render.

Frontend production builds use `frontend/.env.production`:

```env
VITE_API_BASE_URL=/api
```

Vercel rewrites `/api/*` to `https://geo-attendance-tracker.onrender.com/*`. If you rename the Render backend service, update the rewrite destination in `vercel.json` before redeploying.

On deployment, the root `npm start` runs migration and demo seeding before starting the backend, so these demo credentials are recreated safely:

- `admin@demo.com` / `password123`
- `employee@demo.com` / `password123`

## Late Arrival Email Alerts

Late detection is always calculated on the server using:

```text
check_in_time > shift_start_time + late_threshold_minutes
```

When an employee is late, the attendance record is saved with `is_late = true`, a late check-in audit log is created, and the backend attempts to send an email only when all SMTP variables are present. Missing or failed email configuration never blocks check-in.

## Missed Punch-out Auto Checkout

If an on-site employee checks in but forgets to punch out, the backend can close the record with the configured `office_settings.shift_checkout_time`, calculate working minutes server-side, mark the status as `AUTO_CHECKOUT`, and write an `AUTO_CHECKOUT` audit log.

The server checks every 60 seconds using Asia/Kolkata local date/time. The default checkout time is `23:59`, and admins can set values such as `13:58` from Admin -> Office Settings for testing. For demos, admins can trigger the same logic from Admin Dashboard or manually:

```http
POST /api/admin/attendance/auto-checkout
```

WFH, On Duty, Leave, and already checked-out records are not auto-closed.

## Not Onsite Tracking

While an employee is checked in and the web app is open, the employee dashboard sends a location heartbeat about once per minute. The backend uses the configured office geofence and Haversine distance check to create a Not Onsite interval when the employee moves outside the radius, then closes that interval when they return.

This is foreground tracking for browser demo reliability; browsers cannot guarantee continuous background location monitoring.

## Demo Credentials

- Admin: `admin@demo.com` / `password123`
- Employee: `employee@demo.com` / `password123`
- Extra seeded employees:
  - `meera@demo.com` / `password123`
  - `rohan@demo.com` / `password123`
  - `nisha@demo.com` / `password123`
  - `kabir@demo.com` / `password123`

## Demo Flow

1. Login as admin.
2. Open Office Settings and set office location using “Use my current location”.
3. Confirm radius, shift start time, and late threshold.
4. Login as employee.
5. Allow browser location permission.
6. Check in inside geofence.
7. Try check-in again to show duplicate rejection.
8. Check out.
9. Login as admin and view dashboard updates.
10. Export monthly report CSV.
11. Open Audit Logs to show accepted and rejected attempts.
12. Use the admin auto-checkout endpoint to demonstrate missed punch-out closure and audit logging.

## Screenshots

Add screenshots before submission:

- Landing/Login
- Employee dashboard
- Admin dashboard
- Office settings
- Reports export
- Audit logs

## Demo Video Script

1. Introduce problem: proxy attendance and location trust.
2. Show JWT login for admin and employee.
3. Show office geofence settings.
4. Show employee browser geolocation check-in.
5. Explain backend Haversine validation.
6. Show duplicate check-in rejection.
7. Show checkout and working-hours calculation.
8. Show reports, CSV export, and audit logs.

## Team Contributions

- Frontend UI and responsive dashboard:
- Backend APIs and JWT auth:
- PostgreSQL schema and seed data:
- QA/demo script and documentation:

## Notes

Browsers cannot reliably read WiFi SSID. This app uses GPS geofence as the primary validation and optional backend request IP/range checks as a supporting signal.
