# Deployment Guide

## Local Reviewer Deployment

Use Docker Compose from the repository root:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`

Stop:

```bash
docker compose down
```

## GitHub Actions

### CI

`.github/workflows/ci.yml` runs on `main` and `dev`.

It validates:

- backend tests
- frontend production build
- backend Docker image build
- frontend Docker image build

### Docker Publish

`.github/workflows/docker-publish.yml` publishes images to GitHub Container Registry on pushes to `main`. It can also be triggered manually from GitHub Actions.

Images:

- `ghcr.io/mdudi210/maritime-backend`
- `ghcr.io/mdudi210/maritime-frontend`

## Production Deployment With Docker Compose

On a VPS/cloud server with Docker installed:

```bash
export BACKEND_IMAGE=ghcr.io/mdudi210/maritime-backend:main
export FRONTEND_IMAGE=ghcr.io/mdudi210/maritime-frontend:main
docker compose -f docker-compose.prod.yml up -d
```

The frontend is exposed on port `8080` by default:

```text
http://YOUR_SERVER_IP:8080
```

For a real domain, put Nginx, Caddy, Cloudflare Tunnel, or a cloud load balancer in front of the app and terminate HTTPS.

## Required Production Environment Changes

Set these before exposing the system:

- `JWT_SECRET_KEY`: long random secret
- `JWT_REFRESH_SECRET_KEY`: long random secret
- `POSTGRES_PASSWORD`: strong password
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=lax` or stricter depending on deployment
- `CORS_ORIGINS=https://your-domain.com`
- seed admin password changed from the default

## Recommended Server Layout

```text
/opt/maritime/
  docker-compose.prod.yml
  .env
```

Example `.env`:

```bash
BACKEND_IMAGE=ghcr.io/mdudi210/maritime-backend:main
FRONTEND_IMAGE=ghcr.io/mdudi210/maritime-frontend:main
POSTGRES_DB=maritime
POSTGRES_USER=maritime
POSTGRES_PASSWORD=replace-with-strong-password
```

Then:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## Production Hardening Checklist

- Use HTTPS.
- Use managed PostgreSQL or scheduled database backups.
- Replace startup table creation with Alembic migrations.
- Add request rate limiting to login endpoints.
- Add structured audit logs.
- Configure container restart policies.
- Monitor backend health and database disk usage.
- Restrict server firewall ports to HTTP/HTTPS and SSH.
