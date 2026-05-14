# Maritime Operations & Compliance System

Maritime Operations & Compliance System is a full-stack application for ship-level maintenance tracking, safety drill scheduling, crew attendance, compliance metrics, and secure user administration.

The project is structured as an evaluator-ready production MVP:

- React + TypeScript frontend with clear admin and crew workspaces.
- FastAPI backend with route, schema, model, and service separation.
- SQLAlchemy models with PostgreSQL support through Docker Compose.
- Secure cookie-based authentication with refresh-session tracking and CSRF protection.
- GitHub Actions for test/build validation and Docker image publishing.
- Background scheduler for automatic drill status transitions based on real time.

## Deployed Link

- Local Docker deployment: `http://localhost:5173`
- Public deployment: `http://43.205.138.174:8080`

## Business Roles

The application stores two role values:

- `admin`: manages ships, users, maintenance tasks, drills, attendance reports, and compliance dashboards.
- `crew`: views assigned work, updates assigned maintenance tasks, and marks drill attendance only during an active drill window.

Super Admin behavior is represented by `role = admin` and `all_ships = true`. A ship-scoped admin has `role = admin`, `all_ships = false`, and a `ship_id`.

The default seeded admin (`admin@example.com`) is always created as a **Super Admin** (`all_ships = true`) automatically.

## Core Features

- Authentication with access/refresh JWT cookies, CSRF validation, logout, and logout-all.
- Admin user management with create, edit, password reset, activate, and deactivate controls.
- Ship-scoped access control enforced in backend APIs.
- **Ship creation**: Super Admins can register new ships directly from the dashboard via a modal form.
- Maintenance task assignment to one, multiple, or all eligible crew members.
- Safety drills with mandatory start and end time.
- **Automatic drill status transitions**: a background scheduler runs every 60 seconds and automatically moves drills from `scheduled → active` when start time is reached, and `active → completed` when end time passes.
- Admins can also manually override drill status at any time from the Safety Drills panel.
- **Crew drill attendance**: crew members see a "Mark Present" button on active drills in both the main dashboard and crew dashboard. The button is disabled and shows "Already Marked Present ✓" once they have marked attendance.
- Historical drill attendance snapshots that do not pull in crew added after completion.
- Dashboard metrics for maintenance compliance, drill participation, overdue work, and missed drills.
- Attendance reporting with ship, drill type, date range, crew, and status filters.

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: FastAPI, SQLAlchemy, Pydantic, APScheduler
- Database: PostgreSQL (Docker Compose)
- Auth: HTTP-only JWT cookies, refresh-session table, CSRF header validation
- Deployment: Docker, Docker Compose, GitHub Container Registry, AWS EC2
- Timezone: `TZ=Asia/Kolkata` set on the backend container for correct IST time comparisons

## Local Setup

### Option 1: Docker Compose

```bash
docker compose up --build -d
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

Seed users:

- Admin (Super Admin): `admin@example.com` / `Admin@12345`
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

## EC2 / Production Deployment

The repository includes:

- `.github/workflows/ci.yml`: backend tests, frontend build, Docker build checks.
- `.github/workflows/docker-publish.yml`: publishes backend and frontend images to GitHub Container Registry on pushes to `main`.
- `docker-compose.prod.yml`: runs published images with PostgreSQL.

### First-time setup on EC2

```bash
# Clone the repo and run the deploy script
git clone https://github.com/mdudi210/maritime.git ~/maritime
cd ~/maritime
bash scripts/deploy.sh
```

### Updating the EC2 deployment after new pushes

```bash
cd ~/maritime
git pull origin main
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d
```

> Wait ~3-4 minutes after merging to `main` for GitHub Actions to finish building the new images before pulling.

### Manual database reset (if credentials become stale)

```bash
sudo docker compose -f docker-compose.prod.yml down
sudo docker volume prune -a -f
sudo docker compose -f docker-compose.prod.yml up -d
```

### Upgrade existing admin to Super Admin (one-time, if needed)

```bash
sudo docker exec -it maritime-backend-1 python -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.config import settings
engine = create_engine(settings.DATABASE_URL)
with Session(engine) as db:
    user = db.query(User).filter(User.email == 'admin@example.com').first()
    user.all_ships = True
    db.commit()
    print('Done!')
"
```

## Architecture Decisions

- Routes stay thin and delegate business rules to services.
- Backend enforces authorization and ship scoping; the frontend only reflects permissions.
- Drill status is automatically derived from a background scheduler comparing server time (IST) to drill start/end windows. Admins can override status manually at any time.
- Attendance records are persisted as historical rows to protect completed drill reports.
- Compliance metrics are calculated server-side from current task, drill, and attendance state.
- Docker Compose is used to make local and production deployment reproducible.
- `TZ=Asia/Kolkata` is set in both `docker-compose.yml` and `docker-compose.prod.yml` to align `datetime.now()` with the IST times users enter in the UI.

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
