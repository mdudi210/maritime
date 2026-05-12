# Architecture

## Overview

The application follows a three-tier architecture:

1. React frontend served by Nginx in Docker.
2. FastAPI backend exposing JSON APIs.
3. PostgreSQL database for persistent operational data.

Local non-Docker backend runs can use SQLite for convenience, but Docker Compose uses PostgreSQL to match production expectations.

## High-Level Diagram

```text
Browser
  |
  | HTTPS/HTTP
  v
Frontend Nginx container
  |
  | /api requests
  v
FastAPI backend container
  |
  | SQLAlchemy ORM
  v
PostgreSQL container or managed PostgreSQL
```

## Backend Layers

```text
app/
  api/
    deps.py              request dependencies, auth checks, CSRF checks
    routes/              HTTP route handlers
  core/
    config.py            environment-based settings
    database.py          engine/session/database initialization
    security.py          password hashing and JWT helpers
  models/                SQLAlchemy persistence models
  schemas/               Pydantic API contracts
  services/              domain and business logic
  tests/                 API-level regression tests
```

Routes are intentionally thin. They validate access and delegate reusable domain behavior to services:

- `auth_service.py`: registration, login, refresh rotation, password reset, logout.
- `drill_service.py`: drill windows, active/completed status refresh, attendance snapshots.
- `compliance_service.py`: compliance metrics and risk list calculations.
- `seed.py`: deterministic startup seed data for demo and evaluation.

## Frontend Layers

```text
src/
  api/                   typed API functions
  auth/                  authenticated user context
  components/            layout and route guards
  pages/                 application screens
  styles/                global CSS
  types/                 shared API response types
```

The frontend keeps business decisions out of page components where possible:

- API calls live in `src/api`.
- Auth/session state lives in `src/auth/AuthContext.tsx`.
- Protected routing lives in `src/components/ProtectedRoute.tsx`.
- Pages focus on screen state, forms, filters, and rendering.

## Authentication and Sessions

1. Login verifies email/username and password.
2. Backend checks that the account is active.
3. Backend issues:
   - access JWT in HTTP-only cookie
   - refresh JWT in HTTP-only cookie
   - readable CSRF token cookie
4. Refresh requests rotate refresh sessions.
5. Logout revokes the current session.
6. Logout all revokes every active session for the user.
7. Password reset and deactivation revoke active sessions.

## Authorization Model

Stored roles:

- `admin`
- `crew`

Super Admin behavior:

- `role = admin`
- `all_ships = true`

Ship-scoped Admin:

- `role = admin`
- `all_ships = false`
- `ship_id` is set

Crew:

- `role = crew`
- normally assigned to a single `ship_id`

The backend enforces role and ship scoping on every sensitive endpoint. The frontend only displays the controls the backend permits.

## Drill Domain Logic

Drills use date, start time, and end time.

- Before start time: `scheduled`
- Between start and end time: `active`
- After end time: `completed` and read-only

Attendance can only be changed while active. Attendance rows are created from eligible crew at scheduling time and are not backfilled into completed historical drills.

## Compliance Metrics

Metrics are calculated in `compliance_service.py` after refreshing drill states:

- Maintenance total
- Maintenance completed
- Maintenance overdue
- Drill total
- Drill completed
- Drill missed
- Maintenance compliance percentage
- Drill participation percentage

All metrics respect the current user's ship access.

## Deployment Architecture

Development:

```bash
docker compose up --build
```

Production:

```bash
docker compose -f docker-compose.prod.yml up -d
```

For production, run the stack behind HTTPS and set secure cookie and CORS settings.

## Scalability Notes

- Replace lightweight startup migrations with Alembic for long-lived production.
- Move PostgreSQL to a managed database for reliability.
- Add indexed query tuning for large attendance and dashboard datasets.
- Add background jobs for notifications and scheduled status refreshes if needed.
- Add audit logging for regulated environments.
