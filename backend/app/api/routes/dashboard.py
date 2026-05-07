from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.drill import SafetyDrill
from app.models.maintenance import MaintenanceTask
from app.models.ship import Ship
from app.models.user import User
from app.schemas.domain import DashboardMetrics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _percent(part: int, total: int) -> float:
    return round((part / total) * 100, 2) if total else 100.0


@router.get("/compliance", response_model=DashboardMetrics)
def compliance(
    ship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    today = date.today()
    effective_ship_id = current_user.ship_id if current_user.role == "crew" and current_user.ship_id else ship_id
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
    if effective_ship_id:
        ship_query = ship_query.where(Ship.id == effective_ship_id)
        task_total_query = task_total_query.where(MaintenanceTask.ship_id == effective_ship_id)
        task_completed_query = task_completed_query.where(MaintenanceTask.ship_id == effective_ship_id)
        task_overdue_query = task_overdue_query.where(MaintenanceTask.ship_id == effective_ship_id)
        drill_total_query = drill_total_query.where(SafetyDrill.ship_id == effective_ship_id)
        drill_completed_query = drill_completed_query.where(SafetyDrill.ship_id == effective_ship_id)
        drill_missed_query = drill_missed_query.where(SafetyDrill.ship_id == effective_ship_id)

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
    return DashboardMetrics(
        ships=ships,
        maintenance_total=maintenance_total,
        maintenance_completed=maintenance_completed,
        maintenance_overdue=maintenance_overdue,
        drills_total=drills_total,
        drills_completed=drills_completed,
        drills_missed=drills_missed,
        maintenance_compliance_percent=_percent(maintenance_completed, maintenance_total),
        drill_compliance_percent=_percent(drills_completed, drills_total),
    )
