# Security Notes

## Authentication Model

The application uses a cookie-based session model:

- Access JWT stored in an HTTP-only cookie.
- Refresh JWT stored in an HTTP-only cookie.
- CSRF token stored in a readable cookie.
- Write requests and refresh/logout requests require `X-CSRF-Token`.
- Refresh sessions are tracked in the `user_sessions` table.

## Session Lifecycle

- Login creates a refresh session.
- Refresh rotates the refresh session.
- Logout revokes the current refresh session.
- Logout all revokes every refresh session for the current user.
- Password reset revokes target-user sessions.
- Role, ship, or activation changes revoke target-user sessions.

## Passwords

Passwords are salted and hashed with PBKDF2-HMAC-SHA256 for MVP dependency simplicity.

Production recommendation:

- migrate to Argon2id or bcrypt
- enforce stronger password policy
- add login rate limiting
- add MFA for admin users

## Roles and Access

Stored roles:

- `admin`
- `crew`

Super Admin:

- `role = admin`
- `all_ships = true`

Ship-scoped Admin:

- `role = admin`
- `all_ships = false`
- `ship_id` is set

Crew:

- `role = crew`
- assigned to one ship unless explicitly granted all-ship access

Backend APIs enforce role and ship scope. Frontend visibility is treated as convenience, not security.

## Account Deactivation

Admins can deactivate users. Deactivated users:

- cannot log in
- lose active sessions through session revocation
- remain in the database for historical audit and attendance references

The backend prevents deactivating the last active admin.

## CSRF Protection

State-changing requests require a CSRF header matching the readable CSRF cookie. This protects cookie-authenticated browser requests from cross-site form submission.

## Production Checklist

- Use HTTPS.
- Set `AUTH_COOKIE_SECURE=true`.
- Set exact `CORS_ORIGINS`.
- Replace default JWT secrets.
- Replace seed passwords.
- Add request rate limiting.
- Add structured audit logs.
- Add Alembic migrations.
- Back up PostgreSQL.
- Monitor container health and disk usage.
