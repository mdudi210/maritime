from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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


def _ensure_participation_rows(db: Session, drill: SafetyDrill) -> None:
    crew = db.scalars(select(User).where(User.role == "crew", User.ship_id == drill.ship_id)).all()
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    query = select(SafetyDrill).order_by(SafetyDrill.scheduled_date)
    if current_user.role == "crew":
        if not current_user.ship_id:
            return []
        query = query.where(SafetyDrill.ship_id == current_user.ship_id)
    if ship_id:
        query = query.where(SafetyDrill.ship_id == ship_id)
    if status_filter:
        query = query.where(SafetyDrill.status == status_filter)
    return db.scalars(query).all()


@router.post("", response_model=SafetyDrillRead, dependencies=[Depends(verify_csrf)])
def create_drill(payload: SafetyDrillCreate, db: Session = Depends(get_db), _: User = Depends(require_role("admin"))):
    drill = SafetyDrill(**payload.model_dump())
    db.add(drill)
    db.commit()
    db.refresh(drill)
    return drill


@router.patch("/{drill_id}", response_model=SafetyDrillRead, dependencies=[Depends(verify_csrf)])
def update_drill(
    drill_id: int,
    payload: SafetyDrillUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(drill, key, value)
    db.commit()
    db.refresh(drill)
    return drill


@router.get("/{drill_id}/attendance", response_model=list[DrillAttendanceEntry])
def get_drill_attendance(
    drill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    drill = db.get(SafetyDrill, drill_id)
    if not drill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drill not found")

    if current_user.role == "crew":
        if not current_user.ship_id or current_user.ship_id != drill.ship_id:
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
    if not current_user.ship_id or current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if date.today() != drill.scheduled_date:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance can only be marked on the scheduled date",
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
    if not current_user.ship_id or current_user.ship_id != drill.ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if date.today() != drill.scheduled_date:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Completion can only be submitted on the scheduled date",
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
    else:
        participation.completion_status = "missed"
    db.commit()
    db.refresh(participation)
    return participation
