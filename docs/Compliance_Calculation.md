# Compliance Engine Calculation Logic

The Maritime Operations & Compliance System features a centralized compliance calculation engine that computes performance metrics and flags overdue items. This document explains the exact formulas and rules used by the backend.

## 1. Metric Scoping and Role Awareness

All calculations are **scoped** to the requesting user's authorization level.

- **Crew Members**: Metrics are scoped exclusively to the single ship they are assigned to (`user.ship_id`).
- **Ship-scoped Admin**: Metrics are scoped to their assigned ship (`user.ship_id`).
- **Super Admin (`all_ships=true`)**: Metrics default to the entire fleet (across all ships). They can optionally pass a `?ship_id=X` query parameter to filter metrics down to a specific ship.
- **Unassigned Crew/Admin**: If a user is not a Super Admin and has no assigned ship, all metrics return 0 or empty.

## 2. Calculation Timing

Metrics are always calculated dynamically on-the-fly. However, before any calculations take place, the system runs a pre-calculation hook (`refresh_drill_statuses(db)`) to ensure all data is current.

### Drill Status Auto-Transition
Drill statuses are not manually progressed by users; they are derived from the system clock. Before counting any metrics, the system evaluates all "scheduled" and "active" drills:
1. If `current_time > end_time` → transition status to `completed`.
2. If `start_time <= current_time <= end_time` → transition status to `active`.

## 3. The Mathematics of Compliance

The system exposes 10 primary metrics in the `DashboardMetrics` response.

### 3.1 Maintenance Metrics

- **`maintenance_total`**: Count of all maintenance tasks.
- **`maintenance_completed`**: Count of all tasks where `status == "completed"`.
- **`maintenance_overdue`**: Count of tasks where:
  - `status != "completed"`
  - `due_date < today` (strictly before today's date)

**Calculation:**
```python
maintenance_compliance_percent = (maintenance_completed / maintenance_total) * 100
```
*(If `maintenance_total` is 0, compliance defaults to 100.0%)*

### 3.2 Safety Drill Metrics

Drills are divided into two concepts: the event itself (the `SafetyDrill`), and the crew attendance (the `DrillParticipation`).

- **`drills_total`**: Count of all safety drills created.
- **`drills_completed`**: Count of drills where `status == "completed"` (time window has passed).
- **`drills_missed`**: Count of drills where:
  - `status != "completed"` (This technically catches drills that the system hasn't auto-transitioned yet)
  - `scheduled_date < today`

**The Participation Ratio**
Unlike maintenance (which evaluates the task status), drill compliance evaluates *human participation*.

1. **`participation_total`**: The sum total of all `DrillParticipation` rows linked to drills that are scheduled for *today or earlier* (`scheduled_date <= today`). Future drills are excluded so they do not artificially lower compliance.
2. **`participation_attended`**: The subset of those rows where `attendance == true`.

**Calculation:**
```python
drill_participation_percent = (participation_attended / participation_total) * 100
# Note: drill_compliance_percent is an alias for this same value.
```
*(If `participation_total` is 0, compliance defaults to 100.0%)*

## 4. Risk Identification (The Action Lists)

The dashboard surfaces three lists of items requiring attention:

1. **Pending Maintenance**: All tasks where `status != "completed"`. These are ordered by `due_date` (closest deadline first).
2. **Overdue Maintenance**: A filtered subset of Pending Maintenance where `due_date < today`. These trigger the red UI banners.
3. **Missed Drills**: Drills where `status != "completed"` but `scheduled_date < today`. (This acts as a safety net to highlight drills that fell out of schedule or failed to transition correctly).

## 5. Historical Snapshots (The "No Backfill" Rule)

A critical business rule in the calculation engine is the handling of new crew members.

When a drill is created, or when it is still in the future/active, the system ensures all eligible crew members have a `DrillParticipation` row created for them.

However, once a drill's time window closes (`current_time > end_time`), the drill is marked as "Completed". At this point, the drill and its attendance roster become **read-only historical snapshots**.

If a new crew member joins the ship *after* a drill has been completed, the system **will not** retroactively create a "missed" participation row for them for that past drill. Their personal compliance percentage starts fresh from the day they join, and the ship's overall past compliance remains historically accurate to who was on board at the time.
