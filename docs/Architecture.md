# Architecture

## Overview

The system uses a three-tier architecture:

```text
React frontend
  -> FastAPI REST API
  -> SQL database
```

The repository supports two operating modes:

- Local development: FastAPI uses SQLite by default.
- Docker deployment: FastAPI uses PostgreSQL from `docker-compose.yml`.

## Backend

Location: `backend/app`

Main responsibilities:

- Authenticate users.
- Issue and validate JWT cookie sessions.
- Enforce CSRF checks on state-changing authenticated calls.
- Enforce role-based access.
- Expose REST endpoints for ships, maintenance, drills, and compliance metrics.

Key modules:

- `core/config.py`: environment-driven settings.
- `core/database.py`: SQLAlchemy engine/session setup.
- `core/security.py`: password hashing and JWT helpers.
- `services/auth_service.py`: login, refresh rotation, logout, logout all.
- `api/deps.py`: current user, CSRF, and role dependencies.
- `api/routes/*`: REST endpoints.
- `models/*`: SQLAlchemy tables.
- `schemas/*`: Pydantic request and response models.

## Frontend

Location: `frontend/src`

Main responsibilities:

- Render login and registration screens.
- Maintain current user state.
- Call backend with `credentials: "include"` so browser cookies are sent.
- Read the CSRF cookie and send it as `X-CSRF-Token` for protected writes.
- Render protected dashboard and session pages.

Key modules:

- `api/client.ts`: shared fetch wrapper.
- `api/authApi.ts`: login, refresh, logout, logout all, current user.
- `api/maritimeApi.ts`: ships, users, maintenance, drills, dashboard APIs.
- `auth/AuthContext.tsx`: startup session restore and user state.
- `components/ProtectedRoute.tsx`: route guard.
- `components/AppShell.tsx`: authenticated layout and logout controls.
- `pages/DashboardPage.tsx`: compliance, maintenance, and drill workflows.

## Authentication Flow

Login:

```text
User submits credentials on the login page
  -> POST /api/auth/login
  -> Backend validates password
  -> Backend creates database refresh session
  -> Backend sets access_token, refresh_token, csrf_token cookies
  -> Frontend reloads /api/users/me
```

Refresh:

```text
Frontend sends POST /api/auth/refresh with X-CSRF-Token
  -> Backend verifies refresh cookie
  -> Backend revokes old refresh session
  -> Backend creates new refresh session
  -> Backend sets replacement cookies
```

Logout:

```text
Frontend sends POST /api/auth/logout with X-CSRF-Token
  -> Backend revokes current refresh session
  -> Backend clears auth cookies
```

Logout all:

```text
Frontend sends POST /api/auth/logout-all with X-CSRF-Token
  -> Backend validates current user
  -> Backend revokes every active refresh session for that user
  -> Backend clears auth cookies
```

## Data Model

Core tables:

- `users`
- `user_sessions`
- `ships`
- `maintenance_tasks`
- `task_comments`
- `safety_drills`
- `drill_participation`

Users include optional `ship_id` assignment. Crew users can be scoped to a ship; admins can filter the fleet or drill into one vessel.

## Deployment

Docker Compose starts:

- `frontend`: static React build served by Nginx on port `8080`.
- `backend`: FastAPI on port `8000`.
- `postgres`: PostgreSQL on port `5432`.

See [Deployment](Deployment.md) for commands and production notes.
