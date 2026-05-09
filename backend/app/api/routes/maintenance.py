from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_password_ready, require_role, verify_csrf
from app.core.database import get_db
from app.models.maintenance import MaintenanceTask, MaintenanceTaskAssignee, TaskComment
from app.models.user import User
from app.schemas.domain import MaintenanceTaskCreate, MaintenanceTaskRead, MaintenanceTaskUpdate, TaskCommentCreate, TaskCommentRead

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _eligible_crew_query(ship_id: int):
    return select(User).where(User.role == "crew", or_(User.ship_id == ship_id, User.all_ships.is_(True)))


def _validate_assignee(db: Session, user_id: int, ship_id: int) -> User:
    assignee = db.get(User, user_id)
    if not assignee or assignee.role != "crew":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned crew member not found")
    if not assignee.all_ships and assignee.ship_id != ship_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Crew member is not assigned to this ship")
    return assignee


def _task_assigned_to_user(task: MaintenanceTask, user_id: int) -> bool:
    return task.assigned_to_id == user_id or user_id in task.assigned_to_ids


def _set_task_assignees(db: Session, task: MaintenanceTask, assignee_ids: list[int]) -> None:
    unique_ids = list(dict.fromkeys(assignee_ids))
    task.assigned_to_id = unique_ids[0] if unique_ids else None
    task.assignees.clear()
    for user_id in unique_ids:
        task.assignees.append(MaintenanceTaskAssignee(user_id=user_id))


@router.get("", response_model=list[MaintenanceTaskRead])
def list_tasks(
    ship_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    due_from: Optional[date] = None,
    due_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_ready),
):
    query = select(MaintenanceTask).order_by(MaintenanceTask.due_date)
    if current_user.role == "crew":
        query = query.where(
            or_(
                MaintenanceTask.assigned_to_id == current_user.id,
                MaintenanceTask.assignees.any(MaintenanceTaskAssignee.user_id == current_user.id),
            )
        )
    elif current_user.role == "admin" and not current_user.all_ships:
        if current_user.ship_id:
            query = query.where(MaintenanceTask.ship_id == current_user.ship_id)
        else:
            return []
    if ship_id:
        query = query.where(MaintenanceTask.ship_id == ship_id)
    if status_filter:
        query = query.where(MaintenanceTask.status == status_filter)
    if due_from:
        query = query.where(MaintenanceTask.due_date >= due_from)
    if due_to:
        query = query.where(MaintenanceTask.due_date <= due_to)
    return db.scalars(query).all()


@router.post("", response_model=MaintenanceTaskRead, dependencies=[Depends(verify_csrf)])
def create_task(
    payload: MaintenanceTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not current_user.all_ships and current_user.ship_id != payload.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    assignee_ids = payload.assigned_to_ids or ([payload.assigned_to_id] if payload.assigned_to_id else [])
    if payload.assign_all_crew:
        assignee_ids = [member.id for member in db.scalars(_eligible_crew_query(payload.ship_id)).all()]
    for user_id in assignee_ids:
        _validate_assignee(db, user_id, payload.ship_id)
    task_data = payload.model_dump(exclude={"assigned_to_ids", "assign_all_crew"})
    task = MaintenanceTask(**task_data)
    db.add(task)
    _set_task_assignees(db, task, assignee_ids)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=MaintenanceTaskRead, dependencies=[Depends(verify_csrf)])
def update_task(
    task_id: int,
    payload: MaintenanceTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_ready),
):
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if current_user.role == "admin" and not current_user.all_ships and current_user.ship_id != task.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if current_user.role == "crew" and not _task_assigned_to_user(task, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    allowed_fields = payload.model_dump(exclude_unset=True)
    if current_user.role == "crew":
        allowed_fields = {key: value for key, value in allowed_fields.items() if key == "status"}
    next_assignee_ids = allowed_fields.pop("assigned_to_ids", None)
    next_assignee_id = allowed_fields.get("assigned_to_id")
    if next_assignee_ids is not None:
        for user_id in next_assignee_ids:
            _validate_assignee(db, user_id, task.ship_id)
        _set_task_assignees(db, task, next_assignee_ids)
    elif next_assignee_id:
        _validate_assignee(db, next_assignee_id, task.ship_id)
        _set_task_assignees(db, task, [next_assignee_id])
    next_status = allowed_fields.get("status")
    for key, value in allowed_fields.items():
        setattr(task, key, value)
    if next_status == "completed" and task.completed_at is None:
        task.completed_at = datetime.utcnow()
        task.completed_by_id = current_user.id
    elif next_status and next_status != "completed":
        task.completed_at = None
        task.completed_by_id = None
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", dependencies=[Depends(verify_csrf)])
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> dict[str, str]:
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not current_user.all_ships and current_user.ship_id != task.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


@router.get("/{task_id}/comments", response_model=list[TaskCommentRead])
def list_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_ready),
):
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if current_user.role == "admin" and not current_user.all_ships and current_user.ship_id != task.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if current_user.role == "crew" and not _task_assigned_to_user(task, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return db.scalars(select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at)).all()


@router.post("/{task_id}/comments", response_model=TaskCommentRead, dependencies=[Depends(verify_csrf)])
def add_comment(
    task_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_ready),
):
    task = db.get(MaintenanceTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if current_user.role == "admin" and not current_user.all_ships and current_user.ship_id != task.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if current_user.role == "crew" and not _task_assigned_to_user(task, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    comment = TaskComment(task_id=task_id, user_id=current_user.id, comment=payload.comment.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
