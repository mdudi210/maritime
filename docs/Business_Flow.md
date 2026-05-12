# Business Flow

This document describes the end-to-end business flow for the Maritime Operations & Compliance System. It is intended for reviewers and can be exported to PDF for submission.

## 1. User Access Flow

1. An admin logs in using email or username and password.
2. The backend validates credentials and verifies that the account is active.
3. The backend issues access and refresh JWT cookies plus a CSRF cookie.
4. If the user must reset a temporary password, they are redirected to the reset-password flow.
5. The user is routed to the correct workspace:
   - Admin users use dashboard, maintenance, drill, attendance, users, security, and profile pages.
   - Crew users use dashboard, crew workspace, security, and profile pages.

## 2. User Management Flow

1. An admin opens the Users page.
2. User cards show account details, role, ship assignment, activity status, last login, assigned drill count, and completed drill count.
3. Admins can create users from the Add User modal.
4. Admins can edit user details from the Edit action on the user card.
5. Admins can reset a user's password. This revokes active sessions and requires a password change on next login.
6. Admins can deactivate a user. Deactivated users cannot log in and active sessions are revoked.
7. The backend prevents duplicate email/username accounts and prevents deactivating or demoting the final active admin.

## 3. Ship and Access Flow

1. Super Admins can view all ships.
2. Ship-scoped admins and crew members see only their assigned ship.
3. API filters enforce ship access server-side.
4. Frontend dropdowns only display ships returned by the backend.

## 4. Maintenance Flow

1. Admin creates a maintenance task for a ship.
2. Admin assigns the task to one crew member, multiple crew members, or all eligible crew on that ship.
3. Crew members see only tasks assigned to them.
4. Crew can update task status.
5. Completed tasks record completion timestamp and completing user.
6. Dashboard metrics treat open tasks past due date as overdue.

## 5. Safety Drill Flow

1. Admin schedules a drill with drill type, ship, date, start time, and end time.
2. The backend validates that end time is after start time.
3. Eligible crew for the ship are snapshotted into attendance rows.
4. A drill is scheduled before start time.
5. A drill becomes active between start time and end time.
6. Crew can mark attendance or completion only while active.
7. After end time, drill records become read-only.
8. New crew added after a drill is completed do not appear in that historical drill attendance list.

## 6. Attendance Reporting Flow

1. Admin opens the Attendance page.
2. The system loads drill attendance rows across selected drills.
3. Filters can be applied by ship, drill type, date range, crew member, and attendance status.
4. If filters return no matching data, the page shows a clear "No records found" state.
5. Large reports use load-more pagination on the frontend.

## 7. Compliance Dashboard Flow

1. Dashboard requests compliance metrics from the backend.
2. Backend refreshes drill statuses based on server time.
3. Backend applies role and ship scoping.
4. Backend calculates:
   - total ships visible to the user
   - maintenance total/completed/overdue
   - drill total/completed/missed
   - maintenance compliance percentage
   - drill participation percentage
5. Frontend displays metrics, risk lists, and visual progress indicators.

## 8. Profile Flow

1. Any authenticated user can open Profile.
2. Users can update their display name.
3. Users can change password after entering the old password.
4. Users cannot change their own role, ship assignment, or restricted account settings.

## 9. Security Flow

1. Access token authorizes normal requests.
2. Refresh token rotates sessions.
3. Write requests require CSRF token header.
4. Logout revokes the current refresh session.
5. Logout all revokes all active refresh sessions for the user.
6. Inactive users cannot authenticate.
