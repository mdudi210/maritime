from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_role, verify_csrf
from app.core.database import get_db
from app.models.drill import DrillParticipation, SafetyDrill
from app.models.user import User
from app.schemas.domain import (
    DrillAttendanceEntry,
    DrillAttendanceMark,
    DrillCompletionSubmit,
    SafetyDrillCreate,
    SafetyDrillRead,
    SafetyDrillUpdate,
)

router = APIRouter(prefix="/drills", tags=["drills"])


def _start_at(drill: SafetyDrill) -> datetime:
    return datetime.combine(drill.scheduled_date, drill.scheduled_time)


def _end_at(drill: SafetyDrill) -> datetime:
    return datetime.combine(drill.scheduled_date, drill.end_time)


def _drill_is_active(drill: SafetyDrill, now: datetime | None = None) -> bool:
    current = now or datetime.now()
    return _start_at(drill) <= current <= _end_at(drill)


def _refresh_drill_statuses(db: Session) -> None:
    now = datetime.now()
    drills = db.scalars(select(SafetyDrill).where(SafetyDrill.status.in_(["scheduled", "active"]))).all()
    if not drills:
        return
    changed = False
    for drill in drills:
        if drill.scheduled_time is None or drill.end_time is None:
            continue
        next_status = "scheduled"
        if now > _end_at(drill):
            next_status = "completed"
        elif _drill_is_active(drill, now):
            next_status = "active"
        if drill.status != next_status:
            drill.status = next_status
            changed = True
    if changed:
        db.commit()


def _ensure_participation_rows(db: Session, drill: SafetyDrill) -> None:
    if drill.end_time is not None and datetime.now() > _end_at(drill):
        return
    crew = db.scalars(
        select(User).where(User.role == "crew", or_(User.ship_id == drill.ship_id, User.all_ships.is_(True)))
    ).all()
    if not crew:
        return
    existing_user_ids = set(
        db.scalars(select(DrillParticipation.user_id).where(DrillParticipation.drill_id == drill.id)).all()
    )
    created = False
    for member in crew:
        if member.id in existing_user_ids:
            continue
        db.add(
            DrillParticipation(
                drill_id=drill.id,
                user_id=member.id,
                attendance=False,
                completion_status="missed",
            )
        )
        created = True
    if created:
        db.commit()


@router.get("", response_model=list[SafetyDrillRead])
def list_drills(
    ship_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    scheduled_from: Optional[date] = None,
    scheduled_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    _refresh_drill_statuses(db)
    query = select(SafetyDrill).order_by(SafetyDrill.scheduled_date)
    if current_user.role in {"admin", "crew"} and not current_user.all_ships:
        if current_user.ship_id:
            query = query.where(SafetyDrill.ship_id == current_user.ship_id)
        else:
            return []
    if ship_id:
        query = query.where(SafetyDrill.ship_id == ship_id)
    if status_filter:
        query = query.where(SafetyDrill.status == status_filter)
    if scheduled_from:
        query = query.where(SafetyDrill.scheduled_date >= scheduled_from)
    if scheduled_to:
        query = query.where(SafetyDrill.scheduled_date <= scheduled_to)
    return db.scalars(query).all()


@router.post("", response_model=SafetyDrillRead, dependencies=[Depends(verify_csrf)])
def create_drill(
    payload: SafetyDrillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not current_user.all_ships and current_user.ship_id != payload.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if payload.end_time <= payload.scheduled_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End Time must be after Start Time")
    drill = SafetyDrill(**payload.model_dump())
    db.add(drill)
    db.commit()
    db.refresh(drill)
    _ensure_participation_rows(db, drill)
    db.refresh(drill)
    return drill


@router.patch("/{drill_id}", response_model=SafetyDrillRead, dependencies=[Depends(verify_csrf)])
def update_drill(
    drill_id: int,
    payload: SafetyDrillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    _refresh_drill_statuses(db)
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")
    if not current_user.all_ships and current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if drill.end_time is not None and datetime.now() > _end_at(drill):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Completed drills are read-only")
    updates = payload.model_dump(exclude_unset=True)
    next_start = updates.get("scheduled_time", drill.scheduled_time)
    next_end = updates.get("end_time", drill.end_time)
    if next_start is not None and next_end is not None and next_end <= next_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End Time must be after Start Time")
    for key, value in updates.items():
        setattr(drill, key, value)
    db.commit()
    db.refresh(drill)
    return drill


@router.delete("/{drill_id}", dependencies=[Depends(verify_csrf)])
def delete_drill(
    drill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> dict[str, str]:
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")
    if not current_user.all_ships and current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if drill.end_time is not None and datetime.now() > _end_at(drill):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Completed drills are read-only")
    db.delete(drill)
    db.commit()
    return {"message": "Drill deleted"}


@router.get("/{drill_id}/attendance", response_model=list[DrillAttendanceEntry])
def get_drill_attendance(
    drill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    _refresh_drill_statuses(db)
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")

    if current_user.role == "admin" and not current_user.all_ships and current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if current_user.role == "crew":
        if not current_user.all_ships and current_user.ship_id != drill.ship_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        participation = db.scalars(
            select(DrillParticipation).where(
                DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
            )
        ).all()
        if not participation:
            _ensure_participation_rows(db, drill)
            participation = db.scalars(
                select(DrillParticipation).where(
                    DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
                )
            ).all()
        return participation

    _ensure_participation_rows(db, drill)
    return db.scalars(select(DrillParticipation).where(DrillParticipation.drill_id == drill.id)).all()


@router.post("/{drill_id}/attendance/mark", response_model=DrillAttendanceEntry, dependencies=[Depends(verify_csrf)])
def mark_attendance(
    drill_id: int,
    payload: DrillAttendanceMark,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("crew")),
):
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")
    if not current_user.all_ships and current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if drill.scheduled_time is None or drill.end_time is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Drill start and end time are required before attendance can be marked",
        )
    if not _drill_is_active(drill):
        _refresh_drill_statuses(db)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance can only be marked while the drill is active",
        )

    participation = db.scalar(
        select(DrillParticipation).where(
            DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
        )
    )
    if not participation:
        _ensure_participation_rows(db, drill)
        participation = db.scalar(
            select(DrillParticipation).where(
                DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
            )
        )
        if not participation:
            participation = DrillParticipation(drill_id=drill.id, user_id=current_user.id)
            db.add(participation)

    participation.attendance = bool(payload.attendance)
    participation.completion_status = "attended" if participation.attendance else "missed"
    participation.attended_at = datetime.utcnow() if participation.attendance else None
    db.commit()
    db.refresh(participation)
    return participation


@router.post("/{drill_id}/complete", response_model=DrillAttendanceEntry, dependencies=[Depends(verify_csrf)])
def submit_completion(
    drill_id: int,
    payload: DrillCompletionSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("crew")),
):
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")
    if not current_user.all_ships and current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if drill.scheduled_time is None or drill.end_time is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Drill start and end time are required before completion can be submitted",
        )
    if not _drill_is_active(drill):
        _refresh_drill_statuses(db)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Completion can only be submitted while the drill is active",
        )

    participation = db.scalar(
        select(DrillParticipation).where(
            DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
        )
    )
    if not participation:
        _ensure_participation_rows(db, drill)
        participation = db.scalar(
            select(DrillParticipation).where(
                DrillParticipation.drill_id == drill.id, DrillParticipation.user_id == current_user.id
            )
        )
        if not participation:
            participation = DrillParticipation(drill_id=drill.id, user_id=current_user.id)
            db.add(participation)

    if payload.completed:
        participation.attendance = True
        participation.completion_status = "completed"
        participation.attended_at = participation.attended_at or datetime.utcnow()
        participation.completed_at = datetime.utcnow()
        drill.status = "completed"
    else:
        participation.completion_status = "missed"
        participation.completed_at = None
    db.commit()
    db.refresh(participation)
    return participation
