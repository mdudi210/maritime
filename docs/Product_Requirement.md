# Product Requirements

## Product

Maritime Operations & Compliance System is a web application for managing vessel maintenance tasks, safety drills, crew attendance, user access, and compliance reporting.

## Goals

- Provide admins with a single operational console.
- Provide crew members with a focused assigned-work workspace.
- Track maintenance completion and drill attendance with timestamps.
- Calculate compliance metrics for maintenance and safety drill participation.
- Enforce role and ship access at the backend.
- Support Docker-based local review and production deployment.
- Provide clear documentation for evaluation and handoff.

## Users

### Super Admin

Implemented as `role = admin` and `all_ships = true`.

- Access all ships.
- Manage all users.
- Create admin and crew accounts.
- View fleet-wide and ship-wise metrics.
- Create ships, maintenance tasks, and drills.

### Ship-Scoped Admin

Implemented as `role = admin`, `all_ships = false`, and `ship_id` set.

- Access assigned ship.
- Manage crew for assigned ship.
- Create ship-scoped maintenance tasks and drills.
- View compliance metrics for assigned ship.

### Crew

Implemented as `role = crew`.

- View assigned maintenance tasks.
- Update assigned task status.
- View assigned ship drills.
- Mark attendance only while a drill is active.

## Functional Scope

### Authentication

- Login with email or username.
- HTTP-only access and refresh cookies.
- CSRF protection for write requests.
- Refresh-token session tracking.
- Logout current session.
- Logout all sessions.
- Forced first-login password reset.

### User Management

- Admin-created accounts only.
- Unique email and username.
- Edit user details from modal.
- Reset password.
- Activate/deactivate user.
- Prevent inactive users from logging in.
- Prevent deactivating/demoting final active admin.

### Maintenance

- Create tasks with due date and due time.
- Assign to one, multiple, or all eligible crew.
- Crew can update assigned task status.
- Completion records user and timestamp.
- Overdue cases are included in dashboard risk metrics.

### Safety Drills

- Create drills with date, start time, and end time.
- Drill becomes active only during start/end window.
- Attendance changes are blocked outside the active window.
- Completed drills are read-only.
- Historical attendance rows are preserved.

### Attendance Reporting

- Report across crew members and drills.
- Filters for ship, drill type, date range, crew, and status.
- Empty state for no matching records.
- Load-more pagination for large result sets.

### Compliance Dashboard

- Maintenance compliance percentage.
- Drill participation percentage.
- Overdue maintenance count.
- Missed drill count.
- Role/ship-scoped metrics.

## Business Rules

- Drill start and end time are mandatory.
- Drill end time must be after start time.
- Drill attendance can be modified only while active.
- Maintenance is overdue when due date is before today and status is not completed.
- Drill participation is counted from persisted attendance rows.
- Backend permission checks are authoritative.
- Deactivated users cannot authenticate.

## Out of Scope

- MFA/OAuth.
- Email/SMS notifications.
- File attachments.
- Full audit log UI.
- Alembic migrations.
- Advanced analytics cache.

## Future Enhancements

- Audit log module.
- Notification service.
- Alembic migration setup.
- Managed PostgreSQL deployment guide.
- Role-permission matrix table in the database.
- Background scheduler for notifications and drill state updates.
