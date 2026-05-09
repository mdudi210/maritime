from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role, verify_csrf
from app.core.database import get_db
from app.models.ship import Ship
from app.models.user import User
from app.schemas.domain import ShipCreate, ShipRead, ShipUpdate

router = APIRouter(prefix="/ships", tags=["ships"])


@router.get("", response_model=list[ShipRead])
def list_ships(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
):
    query = select(Ship).order_by(Ship.name)
    if current_user.role in {"admin", "crew"} and not current_user.all_ships:
        if current_user.all_ships:
            pass
        elif current_user.ship_id:
            query = query.where(Ship.id == current_user.ship_id)
        else:
            return []
    if search:
        query = query.where(Ship.name.ilike(f"%{search.strip()}%"))
    if status_filter == "active":
        query = query.where(Ship.status != "retired")
    elif status_filter:
        query = query.where(Ship.status == status_filter)
    return db.scalars(query).all()


@router.get("/{ship_id}", response_model=ShipRead)
def get_ship(ship_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "crew"))):
    if current_user.role in {"admin", "crew"} and not current_user.all_ships and current_user.ship_id != ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    ship = db.get(Ship, ship_id)
    if not ship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ship not found")
    return ship


@router.post("", response_model=ShipRead, dependencies=[Depends(verify_csrf)])
def create_ship(payload: ShipCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    if not current_user.all_ships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admin accounts can create ships")
    ship = Ship(**payload.model_dump())
    db.add(ship)
    db.commit()
    db.refresh(ship)
    return ship


@router.patch("/{ship_id}", response_model=ShipRead, dependencies=[Depends(verify_csrf)])
def update_ship(
    ship_id: int,
    payload: ShipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not current_user.all_ships and current_user.ship_id != ship_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    ship = db.get(Ship, ship_id)
    if not ship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ship not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ship, key, value)
    db.commit()
    db.refresh(ship)
    return ship
