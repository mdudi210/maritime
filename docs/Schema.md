# Schema Documentation

## Database Models (SQLAlchemy ORM)

### User

**Table:** `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK, indexed | Auto-increment primary key |
| email | String(255) | Unique, indexed, NOT NULL | Login identifier |
| username | String(120) | Unique, indexed, NOT NULL | Display name and alt login |
| password_hash | String(255) | NOT NULL | PBKDF2-SHA256 digest |
| password_salt | String(255) | NOT NULL | Per-user random salt |
| role | String(20) | NOT NULL, default="crew" | `admin` or `crew` |
| ship_id | Integer | FK → ships.id, nullable | Assigned ship (NULL for Super Admin) |
| all_ships | Boolean | NOT NULL, default=False | Super Admin flag |
| is_active | Boolean | NOT NULL, default=True | Account activation state |
| password_reset_required | Boolean | NOT NULL, default=False | Forces password change on login |
| created_at | DateTime | NOT NULL | Account creation timestamp |

**Relationships:** `sessions` → UserSession (cascade delete), `ship` → Ship

---

### Ship

**Table:** `ships`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| name | String(160) | Unique, NOT NULL | Ship display name |
| imo_number | String(40) | Unique, nullable | International Maritime Organization ID |
| current_port | String(160) | nullable | Current docking location |
| status | String(40) | NOT NULL, default="operational" | `operational`, `maintenance`, `out_of_service`, `retired` |

**Relationships:** `crew_members` → User, `maintenance_tasks` → MaintenanceTask, `safety_drills` → SafetyDrill

---

### MaintenanceTask

**Table:** `maintenance_tasks`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| title | String(180) | NOT NULL | Task name |
| description | Text | nullable | Detailed description |
| ship_id | Integer | FK → ships.id, NOT NULL | Target ship |
| assigned_to_id | Integer | FK → users.id, nullable | Primary assignee (legacy single-assign) |
| status | String(40) | NOT NULL, default="pending" | `pending`, `in_progress`, `completed` |
| due_date | Date | NOT NULL | Compliance deadline date |
| due_time | Time | nullable | Compliance deadline time |
| completed_by_id | Integer | FK → users.id, nullable | Who marked completion |
| completed_at | DateTime | nullable | When marked completed |
| created_at | DateTime | NOT NULL | Creation timestamp |
| updated_at | DateTime | NOT NULL | Last update timestamp |

**Relationships:** `ship` → Ship, `assigned_to` → User, `completed_by` → User, `assignees` → MaintenanceTaskAssignee (cascade delete), `comments` → TaskComment (cascade delete)

**Computed property:** `assigned_to_ids` → list of all assignee user IDs

---

### MaintenanceTaskAssignee

**Table:** `maintenance_task_assignees`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| task_id | Integer | FK → maintenance_tasks.id, indexed | Parent task |
| user_id | Integer | FK → users.id, indexed | Assigned crew member |

**Unique constraint:** `(task_id, user_id)`

---

### TaskComment

**Table:** `task_comments`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| task_id | Integer | FK → maintenance_tasks.id, NOT NULL | Parent task |
| user_id | Integer | FK → users.id, NOT NULL | Comment author |
| comment | Text | NOT NULL | Comment body |
| created_at | DateTime | NOT NULL | Creation timestamp |

---

### SafetyDrill

**Table:** `safety_drills`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| drill_type | String(120) | NOT NULL | e.g. "Fire drill", "Evacuation" |
| ship_id | Integer | FK → ships.id, NOT NULL | Target ship |
| scheduled_date | Date | NOT NULL | Drill date |
| scheduled_time | Time | nullable | Drill start time |
| end_time | Time | nullable | Drill end time |
| status | String(40) | NOT NULL, default="scheduled" | `scheduled`, `active`, `completed` |
| created_at | DateTime | NOT NULL | Creation timestamp |

**Status derivation:** Before start → `scheduled`, between start and end → `active`, after end → `completed`

---

### DrillParticipation

**Table:** `drill_participation`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| drill_id | Integer | FK → safety_drills.id, NOT NULL | Parent drill |
| user_id | Integer | FK → users.id, NOT NULL | Crew member |
| attendance | Boolean | NOT NULL, default=False | Present or absent |
| completion_status | String(40) | NOT NULL, default="missed" | `missed`, `attended`, `completed` |
| attended_at | DateTime | nullable | When attendance was marked |
| completed_at | DateTime | nullable | When completion was submitted |

---

### UserSession

**Table:** `user_sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | Integer | PK | Auto-increment primary key |
| user_id | Integer | FK → users.id, indexed | Session owner |
| jti | String(160) | Unique, indexed, NOT NULL | JWT ID for refresh token tracking |
| user_agent | String(500) | nullable | Browser/client identifier |
| ip_address | String(80) | nullable | Client IP at login |
| created_at | DateTime | NOT NULL | Session start |
| expires_at | DateTime | NOT NULL | Session expiry |
| revoked_at | DateTime | nullable | When revoked (NULL = active) |

---

## Pydantic API Schemas

### Auth Schemas (`schemas/auth.py`)

#### Request Schemas

**LoginRequest**
```json
{
  "email_or_username": "string (1–255 chars, required)",
  "password": "string (1–128 chars, required)"
}
```

**RegisterRequest** (Admin creates user)
```json
{
  "email": "valid email (required)",
  "username": "string (2–120 chars, required)",
  "password": "string (8–128 chars, required)",
  "role": "admin | crew (default: crew)",
  "ship_id": "int | null (optional)",
  "all_ships": "bool (default: false)"
}
```

**UserUpdateRequest** (Admin edits user)
```json
{
  "role": "admin | crew | null",
  "ship_id": "int | null",
  "all_ships": "bool | null",
  "email": "valid email | null",
  "username": "string (2–120) | null",
  "is_active": "bool | null"
}
```

**ProfileUpdateRequest** (User edits own profile)
```json
{
  "username": "string (2–120) | null"
}
```

**ChangePasswordRequest**
```json
{
  "current_password": "string (1–128 chars, required)",
  "new_password": "string (8–128 chars, required)"
}
```

**AdminPasswordResetRequest**
```json
{
  "temporary_password": "string (8–128 chars, required)"
}
```

#### Response Schemas

**UserSummary**
```json
{
  "id": 1,
  "email": "admin@example.com",
  "username": "admin",
  "role": "admin",
  "ship_id": null,
  "all_ships": true,
  "is_active": true,
  "password_reset_required": false,
  "created_at": "2026-05-12T10:00:00",
  "last_login_at": "2026-05-12T14:30:00",
  "total_drills_assigned": 5,
  "total_drills_completed": 3
}
```

**LoginResponse**
```json
{
  "message": "Login successful",
  "user": { /* UserSummary */ }
}
```

**MessageResponse**
```json
{
  "message": "string"
}
```

---

### Domain Schemas (`schemas/domain.py`)

#### Ship Schemas

**ShipCreate** (request)
```json
{
  "name": "string (2–160 chars, required)",
  "imo_number": "string (max 40) | null",
  "current_port": "string (max 160) | null",
  "status": "string (default: operational)"
}
```

**ShipUpdate** (request)
```json
{
  "current_port": "string | null",
  "status": "operational | maintenance | out_of_service | retired | null"
}
```

**ShipRead** (response)
```json
{
  "id": 1,
  "name": "MV Horizon Star",
  "imo_number": "IMO-9321487",
  "current_port": "Singapore",
  "status": "operational"
}
```

#### Maintenance Schemas

**MaintenanceTaskCreate** (request)
```json
{
  "title": "string (2–180 chars, required)",
  "description": "string | null",
  "ship_id": "int (required)",
  "assigned_to_id": "int | null",
  "assigned_to_ids": "[int] (default: [])",
  "assign_all_crew": "bool (default: false)",
  "due_date": "YYYY-MM-DD (required)",
  "due_time": "HH:MM:SS (required)"
}
```

**MaintenanceTaskUpdate** (request, all fields optional)
```json
{
  "title": "string (2–180) | null",
  "description": "string | null",
  "assigned_to_id": "int | null",
  "assigned_to_ids": "[int] | null",
  "status": "pending | in_progress | completed | null",
  "due_date": "YYYY-MM-DD | null",
  "due_time": "HH:MM:SS | null"
}
```

**MaintenanceTaskRead** (response)
```json
{
  "id": 1,
  "title": "Hull inspection",
  "description": "Check for corrosion damage",
  "ship_id": 1,
  "assigned_to_id": 2,
  "assigned_to_ids": [2, 3],
  "status": "pending",
  "due_date": "2026-06-01",
  "due_time": "09:00:00",
  "completed_by_id": null,
  "completed_at": null,
  "created_at": "2026-05-12T10:00:00",
  "updated_at": "2026-05-12T10:00:00"
}
```

**TaskCommentCreate** (request)
```json
{
  "comment": "string (1–2000 chars, required)"
}
```

**TaskCommentRead** (response)
```json
{
  "id": 1,
  "task_id": 1,
  "user_id": 2,
  "comment": "Inspection completed, minor rust found",
  "created_at": "2026-05-12T15:00:00",
  "user": { "id": 2, "email": "crew@example.com", "username": "crew" }
}
```

#### Safety Drill Schemas

**SafetyDrillCreate** (request)
```json
{
  "drill_type": "string (2–120 chars, required)",
  "ship_id": "int (required)",
  "scheduled_date": "YYYY-MM-DD (required)",
  "scheduled_time": "HH:MM:SS (required)",
  "end_time": "HH:MM:SS (required, must be after scheduled_time)"
}
```

**SafetyDrillUpdate** (request, all fields optional)
```json
{
  "drill_type": "string | null",
  "scheduled_date": "YYYY-MM-DD | null",
  "scheduled_time": "HH:MM:SS | null",
  "end_time": "HH:MM:SS | null",
  "status": "scheduled | active | completed | missed | null"
}
```

**SafetyDrillRead** (response)
```json
{
  "id": 1,
  "drill_type": "Fire drill",
  "ship_id": 1,
  "scheduled_date": "2026-06-15",
  "scheduled_time": "10:00:00",
  "end_time": "10:30:00",
  "status": "scheduled",
  "created_at": "2026-05-12T10:00:00"
}
```

#### Drill Attendance Schemas

**DrillAttendanceMark** (request)
```json
{
  "attendance": true
}
```

**DrillCompletionSubmit** (request)
```json
{
  "completed": true
}
```

**DrillAttendanceEntry** (response)
```json
{
  "id": 1,
  "drill_id": 5,
  "user_id": 2,
  "attendance": true,
  "completion_status": "attended",
  "attended_at": "2026-06-15T10:05:00",
  "completed_at": null,
  "user": { "id": 2, "email": "crew@example.com", "username": "crew" }
}
```

#### Dashboard Schemas

**DashboardMetrics** (response)
```json
{
  "ships": 2,
  "maintenance_total": 10,
  "maintenance_completed": 7,
  "maintenance_overdue": 1,
  "drills_total": 5,
  "drills_completed": 3,
  "drills_missed": 1,
  "maintenance_compliance_percent": 70.0,
  "drill_compliance_percent": 80.0,
  "drill_participation_percent": 80.0
}
```

**ComplianceItems** (response)
```json
{
  "pending_maintenance": [ /* MaintenanceTaskRead[] */ ],
  "overdue_maintenance": [ /* MaintenanceTaskRead[] */ ],
  "missed_drills": [ /* SafetyDrillRead[] */ ]
}
```

---

## ER Diagram

```
┌─────────────┐       ┌──────────────────────┐       ┌──────────────────────────┐
│    Ship     │       │   MaintenanceTask    │       │  MaintenanceTaskAssignee │
├─────────────┤       ├──────────────────────┤       ├──────────────────────────┤
│ id       PK │◄──────│ ship_id          FK  │       │ id                   PK  │
│ name        │       │ assigned_to_id   FK  │───┐   │ task_id              FK  │──► MaintenanceTask
│ imo_number  │       │ completed_by_id  FK  │   │   │ user_id              FK  │──► User
│ current_port│       │ title, description   │   │   └──────────────────────────┘
│ status      │       │ status, due_date     │   │
└──────┬──────┘       │ due_time             │   │   ┌──────────────────────────┐
       │              │ completed_at         │   │   │      TaskComment         │
       │              └──────────────────────┘   │   ├──────────────────────────┤
       │                                         │   │ id                   PK  │
       │              ┌──────────────────────┐   │   │ task_id              FK  │──► MaintenanceTask
       ├──────────────│    SafetyDrill       │   │   │ user_id              FK  │──► User
       │              ├──────────────────────┤   │   │ comment, created_at      │
       │              │ id               PK  │   │   └──────────────────────────┘
       │              │ ship_id          FK  │   │
       │              │ drill_type           │   │   ┌──────────────────────────┐
       │              │ scheduled_date/time  │   ├──►│        User              │
       │              │ end_time, status     │   │   ├──────────────────────────┤
       │              └──────────┬───────────┘   │   │ id                   PK  │
       │                         │               │   │ email, username          │
       │              ┌──────────┴───────────┐   │   │ password_hash/salt       │
       │              │ DrillParticipation   │   │   │ role, ship_id        FK  │──► Ship
       │              ├──────────────────────┤   │   │ all_ships, is_active     │
       │              │ id               PK  │   │   │ password_reset_required  │
       │              │ drill_id         FK  │   │   └──────────┬───────────────┘
       │              │ user_id          FK  │───┘              │
       │              │ attendance           │       ┌──────────┴───────────────┐
       │              │ completion_status    │       │      UserSession         │
       │              │ attended_at          │       ├──────────────────────────┤
       │              │ completed_at         │       │ id                   PK  │
       │              └──────────────────────┘       │ user_id              FK  │
       │                                             │ jti (unique)             │
       │                                             │ user_agent, ip_address   │
       └─────────────────────────────────────────────│ created_at, expires_at   │
                                                     │ revoked_at               │
                                                     └──────────────────────────┘
```

---

## JWT Token Schema

**Access Token Payload:**
```json
{
  "sub": "1",
  "role": "admin",
  "type": "access",
  "iat": 1747050000,
  "exp": 1747050900,
  "jti": "random-base64-string"
}
```

**Refresh Token Payload:**
```json
{
  "sub": "1",
  "role": "admin",
  "type": "refresh",
  "iat": 1747050000,
  "exp": 1747654800,
  "jti": "session-tracking-id"
}
```

| Field | Access Token | Refresh Token |
|---|---|---|
| Expiry | 15 minutes | 7 days |
| Secret | `JWT_SECRET_KEY` | `JWT_REFRESH_SECRET_KEY` |
| Cookie | `access_token` (HTTP-only) | `refresh_token` (HTTP-only) |
| Purpose | Authenticate API requests | Rotate sessions without re-login |
