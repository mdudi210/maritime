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

`PATCH /maintenance/{task_id}`

Admins can update task fields. Crew users can update status on assigned tasks.

`GET /drills`

Lists safety drills. Optional filters: `ship_id`, `status_filter`.

Additional filters:

- `scheduled_from` (YYYY-MM-DD)
- `scheduled_to` (YYYY-MM-DD)

`POST /drills`

Admin only. Schedules a drill.

`PATCH /drills/{drill_id}`

Admin only. Updates a drill.

`GET /dashboard/compliance`

Returns ship count, task totals, overdue counts, drill totals, and compliance percentages. `drill_compliance_percent` is based on participation (attendance), and `drill_participation_percent` is included explicitly. Optional filter: `ship_id`.

`GET /dashboard/compliance/items`

Returns the list views used by the compliance dashboard:

- `pending_maintenance`
- `overdue_maintenance`
- `missed_drills`
