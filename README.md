# Maritime Operations & Compliance System

Maritime Operations & Compliance System is a full-stack application for ship-level maintenance tracking, safety drill scheduling, crew attendance, compliance metrics, and secure user administration.

The project is structured as an evaluator-ready production MVP:

- React + TypeScript frontend with clear admin and crew workspaces.
- FastAPI backend with route, schema, model, and service separation.
- SQLAlchemy models with PostgreSQL support through Docker Compose.
- Secure cookie-based authentication with refresh-session tracking and CSRF protection.
- GitHub Actions for test/build validation and Docker image publishing.

## Deployed Link

- Local Docker deployment: `http://localhost:5173`
- Public deployment: add your hosted URL here after deploying the Docker Compose stack to a VPS/cloud host.

## Business Roles

The application stores two role values:

- `admin`: manages ships, users, maintenance tasks, drills, attendance reports, and compliance dashboards.
- `crew`: views assigned work, updates assigned maintenance tasks, and marks drill attendance only during an active drill window.

Super Admin behavior is represented by `role = admin` and `all_ships = true`. A ship-scoped admin has `role = admin`, `all_ships = false`, and a `ship_id`.

## Core Features

- Authentication with access/refresh JWT cookies, CSRF validation, logout, and logout-all.
- Admin user management with create, edit, password reset, activate, and deactivate controls.
- Ship-scoped access control enforced in backend APIs.
- Maintenance task assignment to one, multiple, or all eligible crew members.
- Safety drills with mandatory start and end time.
- Drill attendance allowed only while the drill is active.
- Historical drill attendance snapshots that do not pull in crew added after completion.
- Dashboard metrics for maintenance compliance, drill participation, overdue work, and missed drills.
- Attendance reporting with ship, drill type, date range, crew, and status filters.

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: FastAPI, SQLAlchemy, Pydantic
- Database: SQLite for simple local Python runs, PostgreSQL for Docker Compose
- Auth: HTTP-only JWT cookies, refresh-session table, CSRF header validation
- Deployment: Docker, Docker Compose, GitHub Container Registry

## Local Setup

### Option 1: Docker Compose

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

Seed users:

- Admin: `admin@example.com` / `Admin@12345`
- Crew: `crew@example.com` / `Crew@12345`

### Option 2: Run Backend and Frontend Separately

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## GitHub Deployment

The repository includes:

- `.github/workflows/ci.yml`: backend tests, frontend build, Docker build checks.
- `.github/workflows/docker-publish.yml`: publishes backend and frontend images to GitHub Container Registry on pushes to `main`, and can be run manually.
- `docker-compose.prod.yml`: runs published images with PostgreSQL.

Production flow:

1. Push or merge the code to `main`.
2. Confirm GitHub Actions is enabled.
3. Allow the Docker publish workflow to create GHCR images.
4. On your VPS/cloud server, set image variables:

```bash
export BACKEND_IMAGE=ghcr.io/mdudi210/maritime-backend:main
export FRONTEND_IMAGE=ghcr.io/mdudi210/maritime-frontend:main
docker compose -f docker-compose.prod.yml up -d
```

Before exposing publicly:

- Copy `backend/.env.production.example` to your server environment.
- Replace all secrets and seed passwords.
- Set `AUTH_COOKIE_SECURE=true` behind HTTPS.
- Set `CORS_ORIGINS` to the exact frontend domain.
- Use a real domain with HTTPS through Nginx, Caddy, or a cloud load balancer.

## Architecture Decisions

- Routes stay thin and delegate business rules to services.
- Backend enforces authorization and ship scoping; the frontend only reflects permissions.
- Drill status is derived by server time from start and end windows.
- Attendance records are persisted as historical rows to protect completed drill reports.
- Compliance metrics are calculated server-side from current task, drill, and attendance state.
- Docker Compose is used to make local and production deployment reproducible.

## Documentation

- [Business Flow](docs/Business_Flow.md)
- [Business Flow PDF](docs/Business_Flow.pdf)
- [Architecture](docs/Architecture.md)
- [Project Structure](docs/Project_Structure.md)
- [API Guide](docs/API.md)
- [Deployment Guide](docs/Deployment.md)
- [Security Notes](docs/Security.md)
- [API Flow & Middleware](docs/API_Flow.md)
- [Schema Documentation](docs/Schema.md)
- [Compliance Calculation](docs/Compliance_Calculation.md)
- [QA Test Cases](docs/Test_Cases.md)
- [Evaluation Mapping](docs/Evaluation_Mapping.md)
