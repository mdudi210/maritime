# Project Structure

The repository is organized to keep backend, frontend, deployment, and documentation concerns separate.

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tests/
│   │   └── main.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── types/
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
├── .github/workflows/
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Backend Responsibilities

### `api/routes`

HTTP endpoints grouped by resource. Routes handle request parsing, dependency injection, permission checks, and response models.

### `api/deps.py`

Shared FastAPI dependencies:

- current user resolution
- role enforcement
- CSRF validation
- password-reset access gating

### `core`

Framework-level infrastructure:

- database engine/session setup
- environment configuration
- password hashing and JWT helpers

### `models`

SQLAlchemy ORM models:

- `User`
- `UserSession`
- `Ship`
- `MaintenanceTask`
- `MaintenanceTaskAssignee`
- `TaskComment`
- `SafetyDrill`
- `DrillParticipation`

### `schemas`

Pydantic request and response contracts. These keep API payloads explicit and documented.

### `services`

Business logic and reusable domain behavior:

- `auth_service.py`
- `drill_service.py`
- `compliance_service.py`
- `seed.py`

### `tests`

API-level tests validating login, sessions, user management, drill deletion, and timestamp behavior.

## Frontend Responsibilities

### `api`

Typed functions for backend communication.

### `auth`

Session state and authenticated-user lifecycle.

### `components`

Shared shell, navigation, and route protection.

### `pages`

Screen-level UI:

- Auth
- Dashboard
- Crew dashboard
- Maintenance management
- Drill management
- Attendance report
- Users
- Profile
- Security/session
- Reset password

### `types`

Frontend TypeScript representations of API response objects.

## Deployment Files

- `docker-compose.yml`: local/reviewer deployment with built images.
- `docker-compose.prod.yml`: production deployment using published images.
- `.github/workflows/ci.yml`: tests and build checks.
- `.github/workflows/docker-publish.yml`: GHCR image publication.
