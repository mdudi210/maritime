# Security Notes

## Login and Session Model

The implementation intentionally mirrors the core LogOnService session approach:

- Access token: JWT stored in an HTTP-only cookie.
- Refresh token: JWT stored in an HTTP-only cookie.
- CSRF token: random value stored in a readable cookie.
- Refresh and write requests must include `X-CSRF-Token`.
- Refresh token sessions are tracked in the `user_sessions` table.
- Logout revokes the current refresh session.
- Logout all revokes every active refresh session for the current user.
- Public signup is disabled; only authenticated admins can create users.

## Password Storage

Passwords are salted and hashed with PBKDF2-HMAC-SHA256. This is dependency-light for the MVP. For production parity with LogOnService, switch to Argon2id with a managed password policy.

## Role-Based Access

Roles:

- `admin`: can create ships, tasks, drills, and update all compliance resources.
- `crew`: can view the assigned ship, related drills, and update assigned maintenance task status.

## Production Checklist

- Use HTTPS and set `AUTH_COOKIE_SECURE=true`.
- Replace all example secrets and seed passwords.
- Restrict `CORS_ORIGINS`.
- Add rate limiting on auth endpoints.
- Add audit logging for login, refresh, logout, and admin writes.
- Add Alembic migrations.
- Add MFA if admin access will be exposed outside a private environment.
