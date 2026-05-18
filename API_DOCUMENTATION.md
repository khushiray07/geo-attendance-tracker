# API Documentation

Base URL: `http://localhost:5005/api`

Use `Authorization: Bearer <token>` for protected routes.

## Auth

### POST `/auth/signup`

Create an admin organization account or join by invite code.

```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "mode": "create",
  "organizationName": "Acme"
}
```

For employee join:

```json
{
  "name": "Employee User",
  "email": "employee@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "mode": "join",
  "inviteCode": "DEMOHQ"
}
```

### POST `/auth/login`

```json
{
  "email": "admin@demo.com",
  "password": "password123"
}
```

### GET `/auth/me`

Returns current user and organization.

## Attendance

### GET `/attendance/today`

Returns today’s attendance for the logged-in employee.

### POST `/attendance/check-in`

```json
{
  "lat": 12.8728198,
  "lng": 77.6185537
}
```

Validates latitude/longitude and geofence on the server. Rejects duplicate check-in.

### POST `/attendance/check-out`

```json
{
  "lat": 12.8728198,
  "lng": 77.6185537
}
```

Rejects checkout before check-in and duplicate checkout. Calculates working minutes on the server.

### GET `/attendance/history?month=YYYY-MM`

Employee monthly records.

### GET `/attendance/summary?month=YYYY-MM`

Employee monthly summary.

### GET `/attendance/auto-status?lat=...&lng=...`

Returns auto check-in eligibility using geofence plus optional IP range configuration.

### POST `/attendance/auto-check-in`

Explicit user-confirmed auto check-in.

### POST `/attendance/auto-check-out`

Auto checkout while app is open, if enabled.

## Admin

### GET `/admin/dashboard?date=YYYY-MM-DD&department_id=all`

Organization dashboard metrics and employee attendance list.

### GET `/admin/employees`

List employees in the admin organization.

### POST `/admin/employees`

```json
{
  "name": "New Employee",
  "email": "new@example.com",
  "password": "password123",
  "shift_start_time": "09:00",
  "department_id": 1
}
```

### PUT `/admin/employees/:id`

Update employee name, shift, department, or active status.

### PUT `/admin/employees/:id/department`

```json
{ "department_id": 1 }
```

### PUT `/admin/employees/:id/shift`

```json
{ "shift_start_time": "09:30" }
```

## Departments

### GET `/admin/departments`

### POST `/admin/departments`

```json
{ "name": "Operations" }
```

### PUT `/admin/departments/:id`

```json
{ "name": "People Ops" }
```

### DELETE `/admin/departments/:id`

## Attendance Exceptions

### POST `/admin/attendance/exception`

Admin marks WFH, On Duty, Leave, or on-site correction.

```json
{
  "employee_id": 2,
  "date": "2026-05-18",
  "attendance_type": "work_from_home",
  "reason": "Approved remote work"
}
```

## Reports

### GET `/admin/attendance/report?month=YYYY-MM&employee_id=all&department_id=all&status=all`

### GET `/admin/attendance/report/export?month=YYYY-MM&employee_id=all&department_id=all&status=all`

Returns CSV.

### GET `/admin/reports/employee/:employeeId?month=YYYY-MM`

Per-employee monthly report with summary.

### GET `/admin/reports/employee/:employeeId/export?month=YYYY-MM`

Per-employee CSV export.

## Settings

### GET `/settings/office`

### PUT `/settings/office`

```json
{
  "office_name": "Main Office",
  "latitude": 12.8728198,
  "longitude": 77.6185537,
  "radius_meters": 150,
  "default_shift_start_time": "09:00",
  "late_threshold_minutes": 15,
  "office_network_name_label": "Main Office Network",
  "allowed_ip_ranges": "192.168.1.0/24",
  "enable_auto_checkin": true,
  "enable_auto_checkout": true,
  "auto_checkout_grace_minutes": 5
}
```

## Audit Logs

### GET `/admin/audit-logs`

Shows event type, user, accepted/rejected status, reason, distance, email status, and timestamp.
