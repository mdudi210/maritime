# API Flow & Middleware Architecture

## Request Lifecycle Overview

Every HTTP request to the Maritime backend passes through a layered pipeline of middleware, dependency injection, and route handling before reaching business logic. This document traces the complete journey of a request.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                               │
│  Cookies: access_token, refresh_token, csrf_token                      │
│  Header:  X-CSRF-Token (on mutating requests)                          │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 1 — CORS Middleware                                              │
│  Validates Origin header against CORS_ORIGINS / CORS_ORIGIN_REGEX       │
│  Adds Access-Control-Allow-* headers for cross-origin requests          │
│  Passes credentials: true (cookies allowed)                             │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 2 — FastAPI Router Resolution                                    │
│  Matches URL path to router prefix + route path                         │
│  /api/auth/*         → auth.router                                      │
│  /api/users/*        → users.router                                     │
│  /api/ships/*        → ships.router                                     │
│  /api/maintenance/*  → maintenance.router                               │
│  /api/drills/*       → drills.router                                    │
│  /api/dashboard/*    → dashboard.router                                 │
│  /health             → inline health check                              │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 3 — Pydantic Request Validation                                  │
│  Validates path params, query params, and JSON body against schemas      │
│  Returns 422 with field-level errors on validation failure               │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 4 — Dependency Injection (deps.py)                               │
│  Runs declared Depends() in order:                                      │
│    get_db           → Opens SQLAlchemy session                           │
│    verify_csrf      → Compares cookie vs header CSRF tokens              │
│    get_current_user → Decodes JWT from cookie, loads User from DB        │
│    require_role     → Checks user.role against allowed set               │
│    require_password_ready → Blocks users needing password reset          │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 5 — Route Handler (Business Logic)                               │
│  Performs authorization checks (ship scoping, ownership)                 │
│  Delegates to services for domain rules                                 │
│  Returns Pydantic response model                                        │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Layer 6 — Pydantic Response Serialization                              │
│  Serializes return value using response_model                            │
│  Strips internal fields, formats dates/times                             │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
                     JSON Response to Client
```

---

## Middleware Details

### 1. CORS Middleware

**File:** `app/main.py` (lines 14–21)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,       # ["http://localhost:5173", ...]
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,  # r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"
    allow_credentials=True,                          # Required for cookie-based auth
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**What it does:**
- Intercepts every incoming request before any route processing.
- On preflight `OPTIONS` requests, responds with `Access-Control-Allow-*` headers.
- On actual requests, validates the `Origin` header against the allowed list.
- `allow_credentials=True` is mandatory because the app uses HTTP-only cookies for JWT tokens.

**Configuration:**
- `CORS_ORIGINS` env var: comma-separated list of allowed origins.
- `CORS_ORIGIN_REGEX` env var: regex fallback for dynamic port matching in development.

---

### 2. CSRF Validation Dependency

**File:** `app/api/deps.py` (lines 20–28)

```python
async def verify_csrf(
    request: Request,
    csrf_cookie_value: Optional[str] = Security(csrf_cookie),
    csrf_header_value: Optional[str] = Security(csrf_header),
) -> None:
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    if not csrf_cookie_value or not csrf_header_value or csrf_cookie_value != csrf_header_value:
        raise HTTPException(status_code=403, detail="CSRF validation failed")
```

**What it does:**
- Only activates on state-changing methods: `POST`, `PUT`, `PATCH`, `DELETE`.
- Reads the `csrf_token` cookie (set by server during login/refresh).
- Reads the `X-CSRF-Token` header (sent by frontend JavaScript).
- Compares both values — if they don't match, the request is rejected.
- GET requests skip CSRF validation entirely.

**Why it works:**
- An attacker on a different origin cannot read the `csrf_token` cookie value (due to `SameSite` and browser security policies), so they cannot set the matching header.

---

### 3. Authentication Dependency

**File:** `app/api/deps.py` (lines 31–45)

```python
def get_current_user(
    db: Session = Depends(get_db),
    access_token: Optional[str] = Security(access_token_cookie),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        payload = verify_access_token(access_token)
    except TokenValidationError:
        raise HTTPException(status_code=401, detail="Invalid access token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active or user.role != payload.get("role"):
        raise HTTPException(status_code=401, detail="Invalid access token")
    return user
```

**Step-by-step flow:**

```
1. Extract `access_token` cookie from request
       │
       ▼
2. Cookie missing? → 401 Unauthorized
       │
       ▼
3. Decode JWT using HS256 + JWT_SECRET_KEY
   Verify: expiration, signature, type="access"
       │
       ▼
4. Decode failed? → 401 Unauthorized
       │
       ▼
5. Load User from DB using payload["sub"] (user ID)
       │
       ▼
6. User not found / inactive / role mismatch? → 401 Unauthorized
       │
       ▼
7. Return User object → injected into route handler
```

---

### 4. Role Authorization Dependency

**File:** `app/api/deps.py` (lines 48–58)

```python
def require_role(*roles: str):
    allowed = {role.lower() for role in roles}

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.password_reset_required:
            raise HTTPException(status_code=403, detail="Password reset required")
        if current_user.role.lower() not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency
```

**Chain:** `require_role("admin")` → `get_current_user` → `get_db`

This is a dependency factory — it generates a FastAPI dependency closure that:
1. First runs `get_current_user` (which runs `get_db`).
2. Checks if the user needs a password reset (blocks access with 403).
3. Checks if the user's role is in the allowed set.

**Usage patterns:**
- `require_role("admin")` — Admin-only endpoints (user management, drill creation).
- `require_role("admin", "crew")` — Both roles allowed (dashboard, drill list).
- `require_role("crew")` — Crew-only endpoints (mark attendance, submit completion).

---

### 5. Password-Ready Dependency

**File:** `app/api/deps.py` (lines 61–64)

```python
def require_password_ready(current_user: User = Depends(get_current_user)) -> User:
    if current_user.password_reset_required:
        raise HTTPException(status_code=403, detail="Password reset required")
    return current_user
```

Like `require_role`, but without role checking. Used on endpoints accessible to any authenticated user who has completed their password setup (e.g., listing maintenance tasks).

---

## Complete Dependency Chain per Endpoint

### Public Endpoints (no auth)

| Endpoint | Dependencies |
|---|---|
| `GET /health` | None |
| `POST /api/auth/login` | `get_db` |

### CSRF-Only Endpoints (cookie auth via refresh token, no access token)

| Endpoint | Dependencies |
|---|---|
| `POST /api/auth/refresh` | `verify_csrf` → `get_db` |
| `POST /api/auth/logout` | `verify_csrf` → `get_db` |

### Authenticated + CSRF Endpoints

| Endpoint | Dependency Chain |
|---|---|
| `POST /api/auth/change-password` | `verify_csrf` → `get_current_user` → `get_db` |
| `POST /api/auth/logout-all` | `verify_csrf` → `get_current_user` → `get_db` |
| `PATCH /api/users/me` | `verify_csrf` → `get_current_user` → `get_db` |

### Role-Protected Endpoints

| Endpoint | Dependency Chain |
|---|---|
| `GET /api/users` | `require_role("admin")` → `get_current_user` → `get_db` |
| `POST /api/users` | `verify_csrf` → `require_role("admin")` → `get_current_user` → `get_db` |
| `POST /api/maintenance` | `verify_csrf` → `require_role("admin")` → `get_current_user` → `get_db` |
| `POST /api/drills` | `verify_csrf` → `require_role("admin")` → `get_current_user` → `get_db` |
| `GET /api/dashboard/compliance` | `require_role("admin", "crew")` → `get_current_user` → `get_db` |
| `POST /api/drills/{id}/attendance/mark` | `verify_csrf` → `require_role("crew")` → `get_current_user` → `get_db` |

### Password-Ready Endpoints

| Endpoint | Dependency Chain |
|---|---|
| `GET /api/maintenance` | `require_password_ready` → `get_current_user` → `get_db` |
| `PATCH /api/maintenance/{id}` | `verify_csrf` → `require_password_ready` → `get_current_user` → `get_db` |

---

## Visual: Request Flow Through All Layers

### Example: `POST /api/maintenance` (Admin creates a task)

```
Browser sends:
  POST /api/maintenance
  Cookie: access_token=eyJ...; refresh_token=eyJ...; csrf_token=abc123
  Header: X-CSRF-Token: abc123
  Body: {"title": "Hull inspection", "ship_id": 1, "due_date": "2026-06-01", "due_time": "09:00"}

     │
     ▼
[CORS Middleware]
  ✓ Origin "http://localhost:5173" is in allow_origins
  ✓ Credentials allowed
     │
     ▼
[Router Resolution]
  ✓ Matched: POST /api/maintenance → maintenance.router → create_task()
     │
     ▼
[Pydantic Validation]
  ✓ Body parsed as MaintenanceTaskCreate
  ✓ title min_length=2 ✓, ship_id present ✓, due_date valid ✓, due_time valid ✓
     │
     ▼
[verify_csrf]
  ✓ Method is POST → CSRF check required
  ✓ Cookie csrf_token = "abc123"
  ✓ Header X-CSRF-Token = "abc123"
  ✓ Match confirmed
     │
     ▼
[require_role("admin")]
  │
  ├── [get_current_user]
  │   │
  │   ├── [get_db] → Opens SQLAlchemy session
  │   │
  │   ├── Reads access_token cookie → "eyJ..."
  │   ├── Decodes JWT → {sub: "1", role: "admin", type: "access", exp: ...}
  │   ├── Loads User(id=1) from DB
  │   ├── Checks: is_active=True ✓, role="admin" matches token ✓
  │   └── Returns User object
  │
  ├── Checks: password_reset_required=False ✓
  ├── Checks: role "admin" in {"admin"} ✓
  └── Returns User object
     │
     ▼
[Route Handler: create_task()]
  ✓ Admin has all_ships=True → ship access allowed
  ✓ Validates assignees belong to the ship
  ✓ Creates MaintenanceTask + MaintenanceTaskAssignee rows
  ✓ Commits to database
     │
     ▼
[Response Serialization]
  ✓ Task serialized as MaintenanceTaskRead
  ✓ Returns 200 with JSON body
```

### Example: `POST /api/drills/{id}/attendance/mark` (Crew marks attendance)

```
Browser sends:
  POST /api/drills/5/attendance/mark
  Cookie: access_token=eyJ...; csrf_token=xyz789
  Header: X-CSRF-Token: xyz789
  Body: {"attendance": true}

     │
     ▼
[CORS] ✓ Origin allowed
     │
     ▼
[Router] ✓ Matched: drills.router → mark_attendance(drill_id=5)
     │
     ▼
[Pydantic] ✓ Body parsed as DrillAttendanceMark
     │
     ▼
[verify_csrf] ✓ Cookie matches header
     │
     ▼
[require_role("crew")]
  ├── [get_current_user]
  │   ├── Decodes JWT → {sub: "2", role: "crew"}
  │   ├── Loads User(id=2, role="crew", ship_id=1)
  │   └── ✓ Active and role matches
  ├── ✓ No password reset required
  └── ✓ Role "crew" in {"crew"}
     │
     ▼
[Route Handler: mark_attendance()]
  ├── Loads SafetyDrill(id=5)
  ├── Checks: crew.ship_id == drill.ship_id ✓
  ├── Checks: drill has start_time and end_time ✓
  ├── Checks: current time is within drill window ✓
  ├── Finds/creates DrillParticipation row
  ├── Sets attendance=True, completion_status="attended", attended_at=now()
  └── Commits and returns DrillAttendanceEntry
```

---

## Error Response Flow

All middleware/dependency errors follow the same FastAPI pattern:

```json
{
  "detail": "Error message string"
}
```

| HTTP Status | Source | Meaning |
|---|---|---|
| `400` | Pydantic / Route logic | Invalid request data or business rule violation |
| `401` | `get_current_user` | Missing/invalid/expired access token |
| `403` | `verify_csrf` | CSRF token mismatch |
| `403` | `require_role` | User role not in allowed set |
| `403` | `require_password_ready` | User must change password first |
| `403` | Route handler | Ship scoping violation or drill window closed |
| `404` | Route handler | Resource not found |
| `409` | Route handler | Duplicate email/username conflict |
| `422` | Pydantic | Request body validation errors (field-level) |

---

## Startup Flow

On application startup (before any request is served):

```
uvicorn starts
     │
     ▼
create_app()
  ├── Register CORS middleware
  ├── Register 6 API routers with /api prefix
  └── Register startup event handler
          │
          ▼
     on_startup()
       ├── init_db()
       │     ├── Import all models (triggers table registration)
       │     ├── Base.metadata.create_all() → Create tables if missing
       │     └── _apply_lightweight_sqlite_migrations() → ALTER TABLE for schema evolution
       │
       └── seed_initial_data(db)
             ├── Create 2 ships (MV Horizon Star, MV Blue Atlas)
             ├── Create admin user (all_ships=True)
             └── Create crew user (ship_id=first_ship)
```

---

## Frontend → Backend Request Pattern

The frontend API client adds middleware-required data automatically and handles token lifecycle:

```typescript
// client.ts — apiRequest()
const response = await fetch(`${API_BASE_URL}${path}`, {
  ...init,
  credentials: "include",                         // ← Sends cookies automatically
  headers: buildHeaders(init?.headers, withCsrf)  // ← Adds CSRF header if needed
});
```

**Cookie & Token Flow:**
1. Login response sets 3 cookies: `access_token`, `refresh_token`, `csrf_token`.
2. `credentials: "include"` sends all cookies on every request.
3. `withCsrf=true` reads `csrf_token` from document cookies and adds `X-CSRF-Token` header.
4. GET requests use `withCsrf=false` (CSRF not needed for safe methods).
5. POST/PATCH/DELETE requests use `withCsrf=true`.

**Seamless Auto-Refresh:**
If the backend returns a `401 Unauthorized` due to an expired access token, the frontend client automatically pauses the request. It makes a background request to `/auth/refresh` using the still-valid refresh token. If successful, the client receives a new access token and seamlessly retries the original request without disrupting the user experience.
