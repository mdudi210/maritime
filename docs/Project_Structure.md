# Project Structure

```text
Maritime/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── dashboard.py
│   │   │       ├── drills.py
│   │   │       ├── maintenance.py
│   │   │       ├── ships.py
│   │   │       └── users.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tests/
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── API.md
│   ├── Architecture.md
│   ├── Deployment.md
│   ├── Product_Requirement.md
│   ├── Project_Structure.md
│   └── Security.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── docker-publish.yml
├── README.md
└── .gitignore
```

## Backend Boundaries

- API routes should stay thin.
- Auth/session behavior belongs in `services/auth_service.py`.
- JWT and password utilities belong in `core/security.py`.
- SQLAlchemy models belong in `models`.
- Request and response validation belongs in `schemas`.
- Lightweight startup migrations in `core/database.py` cover MVP schema additions such as password reset flags, task/drill time fields, and completion timestamps.

## Frontend Boundaries

- Network calls belong in `src/api`.
- Current-user state belongs in `src/auth`.
- Shared authenticated layout belongs in `src/components`.
- Route-level screens belong in `src/pages`.
- API response shapes belong in `src/types`.
- Admin user management, first-login password reset, maintenance completion metadata, and drill attendance details are implemented as route-level screens backed by `src/api`.
