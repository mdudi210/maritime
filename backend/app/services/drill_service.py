from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.drill import DrillParticipation, SafetyDrill
from app.models.user import User


def drill_start_at(drill: SafetyDrill) -> datetime:
    return datetime.combine(drill.scheduled_date, drill.scheduled_time)


def drill_end_at(drill: SafetyDrill) -> datetime:
    return datetime.combine(drill.scheduled_date, drill.end_time)


def is_drill_active(drill: SafetyDrill, now: datetime | None = None) -> bool:
    current = now or datetime.now()
    return drill_start_at(drill) <= current <= drill_end_at(drill)


def validate_drill_window(drill: SafetyDrill) -> None:
    if drill.scheduled_time is None or drill.end_time is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Drill start and end time are required",
        )
    if not is_drill_active(drill):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance can only be changed while the drill is active",
        )


def validate_schedule_window(start_time, end_time) -> None:
    if end_time <= start_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End Time must be after Start Time")


def refresh_drill_statuses(db: Session) -> None:
    now = datetime.now()
    drills = db.scalars(select(SafetyDrill).where(SafetyDrill.status.in_(["scheduled", "active"]))).all()
    if not drills:
        return

    changed = False
    for drill in drills:
        if drill.scheduled_time is None or drill.end_time is None:
            continue
        if drill.status == "scheduled" and is_drill_active(drill, now):
            drill.status = "active"
            changed = True
        elif drill.status in ("scheduled", "active") and now > drill_end_at(drill):
            drill.status = "completed"
            changed = True

    if changed:
        db.commit()


def ensure_participation_rows(db: Session, drill: SafetyDrill) -> None:
    if drill.end_time is not None and datetime.now() > drill_end_at(drill):
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


def assert_drill_is_writable(drill: SafetyDrill) -> None:
    pass
