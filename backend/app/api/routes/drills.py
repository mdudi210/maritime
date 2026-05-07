from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role, verify_csrf
from app.core.database import get_db
from app.models.drill import SafetyDrill
from app.models.user import User
from app.schemas.domain import SafetyDrillCreate, SafetyDrillRead, SafetyDrillUpdate

router = APIRouter(prefix="/drills", tags=["drills"])


@router.get("", response_model=list[SafetyDrillRead])
def list_drills(
    ship_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    query = select(SafetyDrill).order_by(SafetyDrill.scheduled_date)
    if current_user.role == "crew" and current_user.ship_id:
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
