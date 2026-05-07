# Product Requirements

## Product

Maritime Operations & Compliance System is a web application for tracking vessel maintenance, safety drills, and operational compliance.

## Goals

- Give admins a single console to create and monitor maintenance tasks and safety drills.
- Give crew users a simple workspace to see assigned work and update task status.
- Show compliance metrics that identify overdue maintenance and missed drills.
- Provide secure login, refresh, logout, and logout-all behavior based on the LogOnService session model.
- Prevent public signup; admins own user creation and crew-to-ship assignment.
- Make the project easy to run, deploy, and hand over to another engineer or reviewer.

## Users

Admin users:

- Manage ships.
- Create maintenance tasks.
- Schedule safety drills.
- Review fleet compliance metrics.

Crew users:

- View assigned maintenance tasks.
- Update task status.
- View upcoming safety drills.

## MVP Scope

Authentication:

- Email or username login.
- Admin-only user creation.
- Crew assignment to ships.
- Access and refresh JWT cookies.
- CSRF protection for refresh, logout, and write requests.
- Current-session logout.
- Logout all sessions.

Maritime operations:

- Ships list, ship filtering, individual ship views, and ship creation.
- Maintenance task creation, listing, and status updates.
- Safety drill scheduling and listing.
- Compliance dashboard.

Deployment and handoff:

- Docker Compose for backend, frontend, and PostgreSQL.
- Local SQLite default for fast development.
- Documentation for architecture, APIs, security, and deployment.

## Business Rules

- A maintenance task must have a due date.
- A safety drill must have a scheduled date.
- Maintenance is overdue when the due date is before today and status is not `completed`.
- A drill is missed when the scheduled date is before today and status is not `completed`.
- Maintenance compliance is `completed tasks / total tasks`.
- Drill compliance is `completed drills / total drills`.

## Out of Scope for This MVP

- MFA and OAuth.
- Email notifications.
- File attachments.
- Full audit event history.
- Alembic migrations.

These are documented as production follow-ups rather than hidden assumptions.
