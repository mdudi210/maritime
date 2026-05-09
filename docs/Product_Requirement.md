# Product Requirements

## Product

Maritime Operations & Compliance System is a web application for tracking vessel maintenance, safety drills, and operational compliance.

## Goals

- Give admins a single console to create and monitor maintenance tasks and safety drills.
- Give crew users a simple workspace to see assigned work and update task status.
- Show compliance metrics that identify overdue maintenance and missed drills.
- Provide secure login, refresh, logout, and logout-all behavior based on the LogOnService session model.
- Prevent public signup; admins own user creation and crew-to-ship assignment.
- Track task completion, drill attendance, and drill completion with visible timestamps.
- Make the project easy to run, deploy, and hand over to another engineer or reviewer.

## Users

Admin users:

- Manage ships.
- Create maintenance tasks.
- Schedule safety drills.
- Review completed task metadata and drill attendance/completion details.
- Review fleet compliance metrics.

Crew users:

- View assigned maintenance tasks.
- Update task status.
- View upcoming safety drills.
- Mark drill attendance and submit drill completion on the scheduled day.

## MVP Scope

Authentication:

- Email or username login.
- Admin-only user creation.
- First-login password reset for newly created users.
- Admin password reset for any account.
- Crew assignment to ships.
- Access and refresh JWT cookies.
- CSRF protection for refresh, logout, and write requests.
- Current-session logout.
- Logout all sessions.

Maritime operations:

- Ships list, ship filtering, individual ship views, and ship creation.
- Maintenance task creation, listing, and status updates.
- Optional time-of-day on maintenance tasks and safety drills.
- Safety drill scheduling, listing, deletion, attendance, and completion.
- Visible `completed_at`, `completed_by`, `attended_at`, and drill completion timestamps where relevant.
- Compliance dashboard.

Deployment and handoff:

- Docker Compose for backend, frontend, and PostgreSQL.
- Local SQLite default for fast development.
- Documentation for architecture, APIs, security, and deployment.

## Business Rules

- A maintenance task must have a due date.
- A safety drill must have a scheduled date.
- Maintenance tasks and drills require a time on the selected date.
- Maintenance is overdue when the due date is before today and status is not `completed`.
- A drill is missed when the scheduled date is before today and status is not `completed`.
- Completing a maintenance task records who completed it and when.
- Marking drill attendance records when the crew member attended.
- Submitting drill completion records when the crew member completed the drill.
- Maintenance compliance is `completed tasks / total tasks`.
- Drill participation compliance is `attended participations / total participations` for drills scheduled up to today.

## Out of Scope for This MVP

- MFA and OAuth.
- Email notifications.
- File attachments.
- Full audit event history.
- Alembic migrations.

These are documented as production follow-ups rather than hidden assumptions.
