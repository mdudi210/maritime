# Maritime Operations & Compliance System

A full-stack app for managing vessel maintenance, safety drills, compliance metrics, ship-level filtering, crew attendance, completion tracking, and secure login/logout sessions.

The authentication flow follows the same core pattern as `LogOnService`:

- Login validates a user and issues access plus refresh JWTs in HTTP-only cookies.
- A readable CSRF cookie is issued and must be sent on refresh/logout/write requests.
- Refresh rotates the refresh session.
- Logout revokes the current refresh session and clears auth cookies.
- Logout all revokes every active session for the signed-in user.
- Public registration is disabled. Only admins can create users and assign crew to ships.

Admins schedule tasks and drills with both a date and time. Completed maintenance tasks show who completed them and when; drill attendance and completion rows show the crew member and timestamp.

## Stack

- Frontend: React, Vite, TypeScript
- Backend: FastAPI, SQLAlchemy, JWT cookies
- Database: SQLite for local default, PostgreSQL in Docker Compose
- Deployment: Docker Compose

## Quick Start

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

Seed users:

- Admin: `admin@example.com` / `Admin@12345`
- Crew: `crew@example.com` / `Crew@12345`

## Docker

```bash
docker compose up --build
```

Then open `http://localhost:5173`.

## GitHub Deployment

This repo includes:

- `.github/workflows/ci.yml` for backend tests, frontend build, and Docker image build checks.
- `.github/workflows/docker-publish.yml` to publish backend and frontend images to GitHub Container Registry on pushes to `main`.
- `docker-compose.prod.yml` for running published images with PostgreSQL.

For production, copy `backend/.env.production.example`, replace secrets/passwords/domains, set `BACKEND_IMAGE` and `FRONTEND_IMAGE`, then run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Documentation

- [Product Requirements](docs/Product_Requirement.md)
- [Architecture](docs/Architecture.md)
- [Project Structure](docs/Project_Structure.md)
- [API Guide](docs/API.md)
- [Deployment Guide](docs/Deployment.md)
- [Security Notes](docs/Security.md)
