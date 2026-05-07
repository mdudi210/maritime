from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role, verify_csrf
from app.core.database import get_db
from app.models.maintenance import MaintenanceTask
from app.models.user import User
from app.schemas.domain import MaintenanceTaskCreate, MaintenanceTaskRead, MaintenanceTaskUpdate

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceTaskRead])
def list_tasks(
    ship_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(MaintenanceTask).order_by(MaintenanceTask.due_date)
    if current_user.role == "crew":
        if current_user.ship_id:
            query = query.where(MaintenanceTask.ship_id == current_user.ship_id)
        else:
            query = query.where(MaintenanceTask.assigned_to_id == current_user.id)
    if ship_id:
        query = query.where(MaintenanceTask.ship_id == ship_id)
    if status_filter:
        query = query.where(MaintenanceTask.status == status_filter)
    return db.scalars(query).all()


@router.post("", response_model=MaintenanceTaskRead, dependencies=[Depends(verify_csrf)])
def create_task(payload: MaintenanceTaskCreate, db: Session = Depends(get_db), _: User = Depends(require_role("admin"))):
    task = MaintenanceTask(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=MaintenanceTaskRead, dependencies=[Depends(verify_csrf)])
def update_task(
    task_id: int,
    payload: MaintenanceTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if current_user.role == "crew" and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    allowed_fields = payload.model_dump(exclude_unset=True)
    if current_user.role == "crew":
        allowed_fields = {key: value for key, value in allowed_fields.items() if key == "status"}
    for key, value in allowed_fields.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task
