# Evaluation Mapping

This document maps the implementation directly to the requested evaluation criteria.

## Technical

### API Design

- REST-style resources are grouped by domain:
  - `/api/auth`
  - `/api/users`
  - `/api/ships`
  - `/api/maintenance`
  - `/api/drills`
  - `/api/dashboard`
- Pydantic request/response schemas define API contracts.
- Mutating requests are protected with CSRF validation.
- Backend role and ship access checks are enforced in dependencies/routes, not only in UI.

### DB Schema

- Users store identity, role, assigned ship, activation state, password reset state, and timestamps.
- Sessions store refresh-token identifiers, expiry, revocation, user agent, and IP.
- Ships own maintenance tasks and safety drills.
- Maintenance supports single and multi-assignee rows.
- Drill participation stores historical attendance rows, attendance status, attended timestamp, and completed timestamp.

### Code Structure

- `backend/app/api/routes`: HTTP route orchestration.
- `backend/app/services`: business logic such as authentication, compliance, drill status, and seed data.
- `backend/app/models`: SQLAlchemy database models.
- `backend/app/schemas`: Pydantic request/response contracts.
- `frontend/src/pages`: route-level UI screens.
- `frontend/src/api`: API client functions.
- `frontend/src/auth`: authentication context.
- `frontend/src/components`: shared layout and route guards.

### Logic

- Admin and crew permissions are checked server-side.
- Inactive users are blocked at login.
- Password resets revoke sessions and require password change.
- Drill state is computed using server time and persisted as scheduled, active, completed, or missed.

### Compliance Calculation

- Maintenance compliance = completed maintenance tasks / total maintenance tasks.
- Drill participation = attended drill participation rows / total eligible participation rows.
- Metrics are calculated after refreshing drill statuses.
- Metrics are scoped by user role and ship access.

### Handling Overdue/Missed Cases

- Maintenance tasks with due dates in the past and non-completed status are overdue.
- Drills past their end time become completed/read-only.
- Missed attendance is represented by attendance rows that remain incomplete after the active drill window.
- Completed drill attendance lists are historical snapshots; new crew are not backfilled into old drills.

## Frontend

### UI Clarity

- Admin and crew navigation are separated.
- User cards are read-only by default and expose explicit Edit, Reset, and Deactivate actions.
- Add actions use top-right buttons and modal forms.
- Empty states are shown for no records and no filter results.

### Data Visualization

- Dashboard metrics show totals, completion counts, participation percentage, and risk counts.
- Progress bars summarize compliance ratios.
- Risk panels list overdue maintenance and missed drills.
- Attendance report supports filtering and load-more pagination.

## System Thinking

### Scalability

- Docker Compose separates frontend, backend, and database.
- GitHub Actions validate backend, frontend, and Docker image builds.
- Service-layer extraction keeps domain rules reusable and testable.
- PostgreSQL is used for containerized deployment, with a path to managed Postgres.

### Clean Separation of Concerns

- Routes handle request/response and dependency injection.
- Services handle domain rules and calculations.
- Models define persistence.
- Schemas define external contracts.
- Frontend API modules isolate HTTP calls from page components.
- Auth context isolates session state from UI screens.

## Submission Artifacts

- GitHub repo: `https://github.com/mdudi210/maritime`
- Business flow: [Business_Flow.md](Business_Flow.md)
- Business flow PDF: [Business_Flow.pdf](Business_Flow.pdf)
- README: [../README.md](../README.md)
- Architecture: [Architecture.md](Architecture.md)
- Deployment: [Deployment.md](Deployment.md)
- Security: [Security.md](Security.md)
