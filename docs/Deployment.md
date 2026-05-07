# Deployment Guide

## Local Shareable Deployment

Use Docker Compose when you want to share the app with another reviewer on your machine:

```bash
docker compose up --build
```

URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`

## Environment Variables

Backend variables live in `backend/.env.example`.

Important production changes:

- Set `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY` to long random values.
- Use PostgreSQL through `DATABASE_URL`.
- Set `AUTH_COOKIE_SECURE=true` behind HTTPS.
- Set `CORS_ORIGINS` to the exact frontend domain.
- Change seed passwords before exposing the app.

## Production Notes

This repository is ready for a small single-node deployment with Docker Compose. For a cloud deployment, run the backend container behind HTTPS, serve the frontend through Nginx or a static host, and use a managed PostgreSQL database.

The current backend creates tables on startup for MVP speed. For a longer-lived production system, add Alembic migrations before making schema changes.

## GitHub Actions

The repo includes two workflows:

- `CI`: installs dependencies, runs backend tests, builds the frontend, and builds Docker images.
- `Publish Docker Images`: publishes backend and frontend images to GitHub Container Registry on `main`.

After pushing to GitHub, enable Actions and push to `main`. Images will be published as:

- `ghcr.io/<owner>/<repo>-backend`
- `ghcr.io/<owner>/<repo>-frontend`

Set those values as `BACKEND_IMAGE` and `FRONTEND_IMAGE` when using `docker-compose.prod.yml`.
