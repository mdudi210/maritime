# API Guide

Base URL: `/api`

## Authentication

`POST /auth/login`

Request:

```json
{
  "email_or_username": "admin@example.com",
  "password": "Admin@12345"
}
```

Response sets `access_token`, `refresh_token`, and `csrf_token` cookies.

`GET /users/me`

Returns the current authenticated user from the access cookie.

`POST /auth/refresh`

Requires `X-CSRF-Token` header matching the `csrf_token` cookie. Rotates the refresh session and sets new cookies.

`POST /auth/logout`

Requires CSRF header. Revokes the current refresh session and clears cookies.

`POST /auth/logout-all`

Requires CSRF header and a valid access cookie. Revokes all sessions for the current user.

`POST /auth/change-password`

Requires CSRF header. Lets the signed-in user change their password and clears first-login reset requirements.

There is no public registration endpoint. Admins create users with `POST /users`.

## Users

`GET /users`

Admin only. Optional filters: `role`, `ship_id`.

`POST /users`

Admin only. Requires CSRF header.

```json
{
  "email": "crew.one@example.com",
  "username": "crew_one",
  "password": "StrongPassword123",
  "role": "crew",
  "ship_id": 1
}
```

New users are created with `password_reset_required=true` and must change the temporary password before accessing operational screens.

`PATCH /users/{user_id}`

Admin only. Updates role and crew ship assignment.

`POST /users/{user_id}/reset-password`

Admin only. Sets a temporary password, revokes active sessions for that account, and forces password reset on next login.

## Maritime Resources

`GET /ships`

Lists ships for admin and crew users. Optional filters: `search`, `status`.

`GET /ships/{ship_id}`

Returns one ship. Crew users can access only their assigned ship.

`POST /ships`

Admin only. Creates a ship.

`GET /maintenance`

Admins see all maintenance tasks. Crew users see their assigned ship/tasks. Optional filters: `ship_id`, `status_filter`.

Additional filters:

- `due_from` (YYYY-MM-DD)
- `due_to` (YYYY-MM-DD)

`POST /maintenance`

Admin only. Creates a maintenance task.

```json
{
  "title": "Inspect lifeboat davits",
  "ship_id": 1,
  "assigned_to_id": 2,
  "due_date": "2026-05-15",
  "due_time": "14:30"
}
```

`PATCH /maintenance/{task_id}`

Admins can update task fields. Crew users can update status on assigned tasks. When status becomes `completed`, responses include `completed_at` and `completed_by_id`.

`GET /drills`

Lists safety drills. Optional filters: `ship_id`, `status_filter`.

Additional filters:

- `scheduled_from` (YYYY-MM-DD)
- `scheduled_to` (YYYY-MM-DD)

`POST /drills`

Admin only. Schedules a drill.

```json
{
  "drill_type": "Fire drill",
  "ship_id": 1,
  "scheduled_date": "2026-05-15",
  "scheduled_time": "09:15"
}
```

`PATCH /drills/{drill_id}`

Admin only. Updates a drill.

`DELETE /drills/{drill_id}`

Admin only. Deletes a drill and its attendance rows.

`GET /drills/{drill_id}/attendance`

Admin and assigned crew. Returns attendance rows with `attended_at` and `completed_at` timestamps when available.

`POST /drills/{drill_id}/attendance/mark`

Crew only. Marks attendance on the scheduled date and records `attended_at`.

`POST /drills/{drill_id}/complete`

Crew only. Submits completion on the scheduled date and records `completed_at`.

`GET /dashboard/compliance`

Returns ship count, task totals, overdue counts, drill totals, and compliance percentages. `drill_compliance_percent` is based on participation (attendance), and `drill_participation_percent` is included explicitly. Optional filter: `ship_id`.

`GET /dashboard/compliance/items`

Returns the list views used by the compliance dashboard:

- `pending_maintenance`
- `overdue_maintenance`
- `missed_drills`
