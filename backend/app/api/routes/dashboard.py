from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.drill import DrillParticipation, SafetyDrill
from app.models.maintenance import MaintenanceTask
from app.models.ship import Ship
from app.models.user import User
from app.schemas.domain import ComplianceItems, DashboardMetrics, MaintenanceTaskRead, SafetyDrillRead

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _percent(part: int, total: int) -> float:
    return round((part / total) * 100, 2) if total else 100.0


def _auto_complete_due_drills(db: Session) -> None:
    now = datetime.now()
    due_drills = db.scalars(
        select(SafetyDrill).where(
            SafetyDrill.status.in_(["scheduled", "active"]),
            or_(
                SafetyDrill.scheduled_date < now.date(),
                (SafetyDrill.scheduled_date == now.date()) & (SafetyDrill.end_time <= now.time()),
            ),
        )
    ).all()
    active_drills = db.scalars(
        select(SafetyDrill).where(
            SafetyDrill.status == "scheduled",
            SafetyDrill.scheduled_date == now.date(),
            SafetyDrill.scheduled_time <= now.time(),
            SafetyDrill.end_time >= now.time(),
        )
    ).all()
    if not due_drills and not active_drills:
        return
    for drill in due_drills:
        drill.status = "completed"
    for drill in active_drills:
        drill.status = "active"
    db.commit()


@router.get("/compliance", response_model=DashboardMetrics)
def compliance(
    ship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    _auto_complete_due_drills(db)
    today = date.today()
    if current_user.role in {"admin", "crew"} and not current_user.all_ships and not current_user.ship_id:
        return DashboardMetrics(
            ships=0,
            maintenance_total=0,
            maintenance_completed=0,
            maintenance_overdue=0,
            drills_total=0,
            drills_completed=0,
            drills_missed=0,
            maintenance_compliance_percent=100.0,
            drill_compliance_percent=100.0,
            drill_participation_percent=100.0,
        )
    effective_ship_id = current_user.ship_id if current_user.role in {"admin", "crew"} and not current_user.all_ships and current_user.ship_id else ship_id
    ship_query = select(func.count()).select_from(Ship)
    task_total_query = select(func.count()).select_from(MaintenanceTask)
    task_completed_query = select(func.count()).select_from(MaintenanceTask).where(MaintenanceTask.status == "completed")
    task_overdue_query = (
        select(func.count())
        .select_from(MaintenanceTask)
        .where(MaintenanceTask.status != "completed", MaintenanceTask.due_date < today)
    )
    drill_total_query = select(func.count()).select_from(SafetyDrill)
    drill_completed_query = select(func.count()).select_from(SafetyDrill).where(SafetyDrill.status == "completed")
    drill_missed_query = (
        select(func.count())
        .select_from(SafetyDrill)
        .where(SafetyDrill.status != "completed", SafetyDrill.scheduled_date < today)
    )
    participation_total_query = (
        select(func.count())
        .select_from(DrillParticipation)
        .join(SafetyDrill, SafetyDrill.id == DrillParticipation.drill_id)
        .where(SafetyDrill.scheduled_date <= today)
    )
    participation_attended_query = (
        select(func.count())
        .select_from(DrillParticipation)
        .join(SafetyDrill, SafetyDrill.id == DrillParticipation.drill_id)
        .where(SafetyDrill.scheduled_date <= today, DrillParticipation.attendance.is_(True))
    )
    if effective_ship_id:
        ship_query = ship_query.where(Ship.id == effective_ship_id)
        task_total_query = task_total_query.where(MaintenanceTask.ship_id == effective_ship_id)
        task_completed_query = task_completed_query.where(MaintenanceTask.ship_id == effective_ship_id)
        task_overdue_query = task_overdue_query.where(MaintenanceTask.ship_id == effective_ship_id)
        drill_total_query = drill_total_query.where(SafetyDrill.ship_id == effective_ship_id)
        drill_completed_query = drill_completed_query.where(SafetyDrill.ship_id == effective_ship_id)
        drill_missed_query = drill_missed_query.where(SafetyDrill.ship_id == effective_ship_id)
        participation_total_query = participation_total_query.where(SafetyDrill.ship_id == effective_ship_id)
        participation_attended_query = participation_attended_query.where(SafetyDrill.ship_id == effective_ship_id)

    ships = db.scalar(ship_query) or 0
    maintenance_total = db.scalar(task_total_query) or 0
    maintenance_completed = db.scalar(
        task_completed_query
    ) or 0
    maintenance_overdue = db.scalar(
        task_overdue_query
    ) or 0
    drills_total = db.scalar(drill_total_query) or 0
    drills_completed = db.scalar(
        drill_completed_query
    ) or 0
    drills_missed = db.scalar(
        drill_missed_query
    ) or 0
    participation_total = db.scalar(participation_total_query) or 0
    participation_attended = db.scalar(participation_attended_query) or 0
    drill_participation_percent = _percent(participation_attended, participation_total)
    return DashboardMetrics(
        ships=ships,
        maintenance_total=maintenance_total,
        maintenance_completed=maintenance_completed,
        maintenance_overdue=maintenance_overdue,
        drills_total=drills_total,
        drills_completed=drills_completed,
        drills_missed=drills_missed,
        maintenance_compliance_percent=_percent(maintenance_completed, maintenance_total),
        drill_compliance_percent=drill_participation_percent,
        drill_participation_percent=drill_participation_percent,
    )


@router.get("/compliance/items", response_model=ComplianceItems)
def compliance_items(
    ship_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    _auto_complete_due_drills(db)
    today = date.today()
    if current_user.role in {"admin", "crew"} and not current_user.all_ships and not current_user.ship_id:
        return ComplianceItems(pending_maintenance=[], overdue_maintenance=[], missed_drills=[])
    effective_ship_id = current_user.ship_id if current_user.role in {"admin", "crew"} and not current_user.all_ships and current_user.ship_id else ship_id
    safe_limit = min(max(limit, 1), 200)

    pending_tasks_query = select(MaintenanceTask).where(MaintenanceTask.status != "completed").order_by(MaintenanceTask.due_date)
    overdue_tasks_query = (
        select(MaintenanceTask)
        .where(MaintenanceTask.status != "completed", MaintenanceTask.due_date < today)
        .order_by(MaintenanceTask.due_date)
    )
    missed_drills_query = (
        select(SafetyDrill)
        .where(SafetyDrill.status != "completed", SafetyDrill.scheduled_date < today)
        .order_by(SafetyDrill.scheduled_date.desc())
    )

    if effective_ship_id:
        pending_tasks_query = pending_tasks_query.where(MaintenanceTask.ship_id == effective_ship_id)
        overdue_tasks_query = overdue_tasks_query.where(MaintenanceTask.ship_id == effective_ship_id)
        missed_drills_query = missed_drills_query.where(SafetyDrill.ship_id == effective_ship_id)

    pending = db.scalars(pending_tasks_query.limit(safe_limit)).all()
    overdue = db.scalars(overdue_tasks_query.limit(safe_limit)).all()
    missed = db.scalars(missed_drills_query.limit(safe_limit)).all()

    return ComplianceItems(
        pending_maintenance=[MaintenanceTaskRead.model_validate(t) for t in pending],
        overdue_maintenance=[MaintenanceTaskRead.model_validate(t) for t in overdue],
        missed_drills=[SafetyDrillRead.model_validate(d) for d in missed],
    )
