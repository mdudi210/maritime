# API Guide

Base URL: `/api`

The backend exposes JSON APIs and uses cookie-based authentication. Mutating requests require the `X-CSRF-Token` header to match the `csrf_token` cookie.

## Auth

### `POST /auth/login`

Logs in an active user.

```json
{
  "email_or_username": "admin@example.com",
  "password": "Admin@12345"
}
```

Sets:

- `access_token`
- `refresh_token`
- `csrf_token`

### `POST /auth/refresh`

Rotates refresh session and issues new cookies.

### `POST /auth/logout`

Revokes current refresh session and clears cookies.

### `POST /auth/logout-all`

Revokes every active refresh session for the current user.

### `POST /auth/change-password`

Changes password after validating the old password.

## Users

### `GET /users/me`

Returns the current user, including role, ship access, last login, and drill summary counts.

### `PATCH /users/me`

Updates own profile fields allowed for normal users, currently display name.

### `GET /users`

Admin only. Optional filters:

- `role`
- `ship_id`

### `POST /users`

Admin only. Creates a user.

```json
{
  "email": "crew.one@example.com",
  "username": "crew_one",
  "password": "StrongPassword123",
  "role": "crew",
  "ship_id": 1,
  "all_ships": false
}
```

New users must change the temporary password before using operational screens.

### `PATCH /users/{user_id}`

Admin only. Supports controlled updates:

```json
{
  "email": "crew.one@example.com",
  "username": "crew_one",
  "role": "crew",
  "ship_id": 1,
  "all_ships": false,
  "is_active": true
}
```

Setting `is_active=false` deactivates the user. Inactive users cannot log in.

### `POST /users/{user_id}/reset-password`

Admin only. Sets a temporary password, revokes active sessions, and forces password change.

## Ships

### `GET /ships`

Returns ships visible to the current user. Optional filters:

- `search`
- `status`

### `GET /ships/{ship_id}`

Returns one visible ship.

### `POST /ships`

Super Admin only. Creates a ship.

### `PATCH /ships/{ship_id}`

Admin only for accessible ships.

## Maintenance

### `GET /maintenance`

Returns maintenance tasks visible to the user. Optional filters:

- `ship_id`
- `status_filter`
- `due_from`
- `due_to`

### `POST /maintenance`

Admin only. Creates a task.

```json
{
  "title": "Inspect lifeboat davits",
  "description": "Quarterly inspection",
  "ship_id": 1,
  "assigned_to_ids": [2, 3],
  "assign_all_crew": false,
  "due_date": "2026-05-15",
  "due_time": "14:30"
}
```

### `PATCH /maintenance/{task_id}`

Admins can update task fields. Crew can update status for assigned tasks. Completion records `completed_at` and `completed_by_id`.

### `DELETE /maintenance/{task_id}`

Admin only.

### `GET /maintenance/{task_id}/comments`

Returns task comments for users allowed to access the task.

### `POST /maintenance/{task_id}/comments`

Adds a task comment.

## Drills

### `GET /drills`

Returns visible drills. Optional filters:

- `ship_id`
- `status_filter`
- `scheduled_from`
- `scheduled_to`

### `POST /drills`

Admin only. Start and end time are mandatory.

```json
{
  "drill_type": "Fire drill",
  "ship_id": 1,
  "scheduled_date": "2026-05-15",
  "scheduled_time": "09:15",
  "end_time": "10:00"
}
```

### `PATCH /drills/{drill_id}`

Admin only. Completed drills are read-only.

### `DELETE /drills/{drill_id}`

Admin only. Completed drills are read-only.

### `GET /drills/{drill_id}/attendance`

Returns drill attendance rows.

### `POST /drills/{drill_id}/attendance/mark`

Crew only. Attendance can be marked only while:

- current server time is after start time
- current server time is before or equal to end time
- the crew member is assigned to that ship/drill

### `POST /drills/{drill_id}/complete`

Crew only. Marks drill completion during the active drill window.

## Dashboard

### `GET /dashboard/compliance`

Returns:

- ship count
- maintenance totals
- maintenance completed
- maintenance overdue
- drill totals
- drill completed
- drill missed
- maintenance compliance percent
- drill compliance percent
- drill participation percent

Optional filter:

- `ship_id`

### `GET /dashboard/compliance/items`

Returns dashboard list data:

- `pending_maintenance`
- `overdue_maintenance`
- `missed_drills`
