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



## Notes

Browsers cannot reliably read WiFi SSID. This app uses GPS geofence as the primary validation and optional backend request IP/range checks as a supporting signal.
