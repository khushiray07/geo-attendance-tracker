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

Employee monthly records with backend-generated date-wise statuses for past working-day absences and today’s pending state. Future dates are not marked absent.

### GET `/attendance/summary?month=YYYY-MM`

Employee monthly summary.

### GET `/attendance/auto-status?lat=...&lng=...`

Returns auto check-in eligibility using geofence plus optional IP range configuration.

### POST `/attendance/auto-check-in`

Explicit user-confirmed auto check-in.

### POST `/attendance/auto-check-out`

Auto checkout while app is open, if enabled.

### POST `/attendance/location-heartbeat`

Foreground location heartbeat while an employee is checked in.

```json
{
  "lat": 12.8728198,
  "lng": 77.6185537
}
```

The backend calculates distance from office. If outside the radius, it opens a Not Onsite interval. If back inside, it closes any open interval.
If the browser denies location permission, the frontend may post `{ "permission_denied": true }` to create a `LOCATION_PERMISSION_DENIED` audit log.

### GET `/attendance/onsite-status`

Returns current employee geofence state, active Not Onsite interval, today’s Not Onsite minutes, and today’s intervals.

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

### POST `/admin/attendance/auto-checkout`

Manually triggers missed punch-out auto checkout for the admin organization. This is useful for demos and uses the same logic as the configured `shift_checkout_time` scheduler.

```json
{
  "message": "Auto checkout completed for 1 missed punch-out record(s).",
  "closedCount": 1,
  "checkoutTime": "13:58",
  "checkoutDate": "2026-05-18"
}
```

Creates an `AUTO_CHECKOUT` audit log for every closed attendance record.

### GET `/admin/attendance/geofence-breaches?date=YYYY-MM-DD`

Returns Not Onsite/geofence breach intervals for the admin organization, including employee, department, outside time, returned time, duration, and current status.

## Reports

### GET `/admin/attendance/report?month=YYYY-MM&employee_id=all&department_id=all&status=all&search=khushi`

Filters support month, employee, department, status, and employee search by name/email/department.

### GET `/admin/attendance/report/export?month=YYYY-MM&employee_id=all&department_id=all&status=all&search=khushi`

Returns CSV for the currently filtered report.

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
  "shift_checkout_time": "23:59",
  "late_threshold_minutes": 15,
  "office_network_name_label": "Main Office Network",
  "allowed_ip_ranges": "192.168.1.0/24",
  "auto_checkout_enabled": true,
  "enable_auto_checkin": true,
  "enable_auto_checkout": true,
  "auto_checkout_grace_minutes": 0
}
```

## Audit Logs

### GET `/admin/audit-logs`

Shows event type, user, accepted/rejected status, reason, distance, email status, and timestamp. Geofence monitoring events include `OUTSIDE_GEOFENCE`, `RETURNED_TO_GEOFENCE`, `LOCATION_HEARTBEAT_SKIPPED`, and `LOCATION_PERMISSION_DENIED`.
