# Comprehensive QA Test Plan & Test Cases

This document outlines the end-to-end test cases required to validate the Maritime Operations & Compliance System. It covers functional testing, role-based access control (RBAC), security features, and business logic.

---

## 1. Authentication & Security

### TC-1.01: Successful Login
- **Steps:** Navigate to `/auth`. Enter valid credentials (e.g., `admin@example.com` / `Admin@12345`). Click Sign In.
- **Expected:** User is redirected to `/dashboard`. Session cookies (`access_token`, `refresh_token`, `csrf_token`) are set as HTTP-only.

### TC-1.02: Invalid Credentials
- **Steps:** Navigate to `/auth`. Enter an incorrect password or non-existent email. Click Sign In.
- **Expected:** Error message "Invalid credentials" is displayed. User remains on the login page.

### TC-1.03: First-Time User Forced Password Reset
- **Steps:** Login as a newly created crew member using the temporary password.
- **Expected:** System redirects immediately to `/reset-password`. Attempting to navigate to `/dashboard` directly redirects back to the reset page.
- **Steps (cont):** Enter a new password.
- **Expected:** Password is updated, session is refreshed, and user is granted access to `/dashboard`.

### TC-1.04: Cross-Site Request Forgery (CSRF) Protection
- **Steps:** Using a tool like Postman, intercept a valid POST request (e.g., creating a task) and remove or alter the `X-CSRF-Token` header.
- **Expected:** The server rejects the request with a `403 Forbidden` ("CSRF validation failed").

### TC-1.05: Logout and Logout-All
- **Steps:** Click "Logout" in the sidebar.
- **Expected:** User is redirected to `/auth`. Cookies are cleared. Pressing the browser's "Back" button and attempting an action results in a redirect to login.
- **Steps:** Log in on two different browsers. On browser A, click "Logout all sessions".
- **Expected:** Browser A is logged out. Refreshing Browser B also results in being logged out.

---

## 2. Role-Based Access Control (RBAC)

### TC-2.01: Crew Navigation Restrictions
- **Steps:** Login as a Crew member.
- **Expected:** Sidebar only shows "Dashboard", "Crew", "Session", and "Profile". "Maintenance", "Drills", "Attendance", and "Users" are hidden.
- **Steps (cont):** Manually type the URL `/users` into the browser.
- **Expected:** System blocks access and redirects back to `/dashboard`.

### TC-2.02: Super Admin Fleet Access
- **Steps:** Login as a Super Admin (`all_ships=true`).
- **Expected:** On the Dashboard, the Ship filter dropdown shows "All ships" and lists every ship in the fleet. Maintenance and Drill tabs show data across all ships.

### TC-2.03: Ship-Scoped Admin Isolation
- **Steps:** Login as an Admin assigned to "Ship A".
- **Expected:** Dashboard automatically filters to "Ship A". Data for "Ship B" is completely invisible. Attempting to create a task for "Ship B" via direct API call results in a `403 Forbidden`.

---

## 3. Maintenance Task Management

### TC-3.01: Admin Creates Task
- **Steps:** Navigate to `/maintenance`. Click "Add Task". Fill in Title, select a Ship, select Due Date/Time, and assign a Crew member. Submit.
- **Expected:** Task appears in the list with status "Pending".

### TC-3.02: Admin Assigns Task to "All Crew"
- **Steps:** Create a task and check the "Assign to all crew on this ship" checkbox.
- **Expected:** The task is created, and all active crew members assigned to that ship are listed as assignees.

### TC-3.03: Crew Views Assigned Tasks
- **Steps:** Login as a Crew member. Navigate to the "Crew" page.
- **Expected:** The task created in TC-3.01 is visible. Tasks assigned to *other* crew members on the same ship are *not* visible here (but are visible on the main Dashboard).

### TC-3.04: Crew Updates Task Status
- **Steps:** On the Crew page, change a task status from "Pending" to "In Progress".
- **Expected:** Status updates successfully.
- **Steps (cont):** Change status to "Completed".
- **Expected:** Status updates to "Completed", and the system records the `completed_by_id` and `completed_at` timestamp.

### TC-3.05: Task Comments
- **Steps:** Click the "Notes" button on a task. Add a comment.
- **Expected:** Comment appears with the author's name and timestamp. Both Admins and assigned Crew can see and add comments.

---

## 4. Safety Drills & Time Windows

### TC-4.01: Schedule a Future Drill
- **Steps:** Navigate to `/drills` as Admin. Click "Schedule Drill". Set the date to tomorrow, start time `10:00`, end time `11:00`.
- **Expected:** Drill is created with status "Scheduled".

### TC-4.02: Drill Auto-Transitions to "Active"
- **Steps:** Create a drill where the current time falls exactly between the start and end time. Refresh the Dashboard.
- **Expected:** Drill status automatically shows as "Active".

### TC-4.03: Crew Marks Attendance
- **Steps:** Login as Crew during an "Active" drill window. Navigate to the Crew page. Click "Mark Present" on the drill.
- **Expected:** Status changes to "Present", recording the `attended_at` timestamp.

### TC-4.04: Crew Submits Drill Completion
- **Steps:** After marking attendance, click "Submit Completion" on the drill.
- **Expected:** The drill row shows as "Completed" for that crew member, recording the `completed_at` timestamp.

### TC-4.05: Drill Window Closes (Read-Only)
- **Steps:** Wait until a drill's end time passes, or create a drill with an end time in the past.
- **Expected:** Status automatically updates to "Completed".
- **Steps (cont):** As a Crew member, attempt to mark attendance.
- **Expected:** Action is disabled in the UI. Direct API calls return `403 Forbidden: Attendance can only be changed while the drill is active`.

---

## 5. Dashboard & Compliance Engine

### TC-5.01: Maintenance Compliance Calculation
- **Steps:** Ensure a ship has 4 maintenance tasks total. Complete 3 of them.
- **Expected:** Dashboard shows Maintenance Compliance as 75%.

### TC-5.02: Drill Participation Calculation
- **Steps:** Ensure a ship has 1 past drill with 5 crew members. 4 marked attendance.
- **Expected:** Dashboard shows Drill Participation as 80%.
- **Steps (cont):** Schedule a *future* drill.
- **Expected:** Compliance remains 80% (future drills do not impact current compliance).

### TC-5.03: Overdue and Missed Risk Banners
- **Steps:** Create a maintenance task with a due date in the past. Do not complete it.
- **Expected:** Dashboard displays a red Risk Banner: "You have 1 overdue maintenance task(s)". The specific task appears in the "Pending maintenance" panel with a red border.
- **Steps (cont):** A drill window closes without a crew member marking attendance.
- **Expected:** Risk Banner updates to show missed drills, appearing in the "Missed drills" panel.

---

## 6. User and Ship Administration

### TC-6.01: Create and Deactivate User
- **Steps:** Navigate to `/users` as Super Admin. Click "Add User". Create a Crew member.
- **Expected:** User appears in the list.
- **Steps (cont):** Click "Deactivate" on the user. Attempt to login as that user.
- **Expected:** Login fails with "Invalid credentials" (inactive accounts cannot log in).

### TC-6.02: Admin Resets User Password
- **Steps:** On `/users`, click "Reset Pass" for a user. Note the temporary password provided in the modal.
- **Expected:** User's active sessions are immediately revoked. Upon next login with the temporary password, the user is forced through the password reset flow (TC-1.03).

### TC-6.03: Retire a Ship
- **Steps:** On the Dashboard, find a ship in the list. Click "Retire" (requires Admin). Confirm the prompt.
- **Expected:** Ship status changes to "retired". The "Retire" button disappears.

---

## 7. Edge Cases & Boundary Testing

### TC-7.01: Invalid Drill Time Boundaries
- **Steps:** Attempt to schedule a drill where the `end_time` is *before* the `start_time` (e.g., Start: 14:00, End: 13:00).
- **Expected:** Form validation prevents submission. API returns `400 Bad Request`.

### TC-7.02: Prevent Orphaned Tasks
- **Steps:** Create a task assigned to Crew Member A. Admin edits the user and changes their assigned ship to a different ship.
- **Expected:** While the task remains on the original ship, the system gracefully handles the user ID no longer matching the ship context (name still resolves via historical data, or falls back to ID).

### TC-7.03: High Volume Pagination / Limits
- **Steps:** Seed the database with 250 tasks for a single ship. Navigate to Dashboard.
- **Expected:** The UI limits the display of the Pending panels to a reasonable subset (e.g., top 8), preventing UI lag, while the total metrics count remains accurate (250).

### TC-7.04: Token Expiration Flow
- **Steps:** Alter the backend `ACCESS_TOKEN_EXPIRE_MINUTES` to 1 minute. Log in. Wait 61 seconds. Click a navigation link or action.
- **Expected:** The API call fails with 401, the Frontend `apiRequest` utility intercepts the 401, silently calls `/api/auth/refresh`, obtains a new token, and retries the original request seamlessly without logging the user out.
