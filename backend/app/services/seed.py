from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.ship import Ship
from app.models.user import User


def _ensure_user(db: Session, *, email: str, username: str, password: str, role: str) -> None:
    existing = db.scalar(select(User).where((User.email == email) | (User.username == username)))
    if existing:
        existing.email = email
        existing.role = role
        existing.is_active = True
        if not existing.password_hash or not existing.password_salt:
            existing.password_hash, existing.password_salt = hash_password(password)
        return
    password_hash, password_salt = hash_password(password)
    db.add(
        User(
            email=email,
            username=username,
            password_hash=password_hash,
            password_salt=password_salt,
            role=role,
        )
    )


def seed_initial_data(db: Session) -> None:
    if not db.scalar(select(Ship).where(Ship.name == "MV Horizon Star")):
        db.add(Ship(name="MV Horizon Star", imo_number="IMO-9321487", current_port="Singapore"))
    if not db.scalar(select(Ship).where(Ship.name == "MV Blue Atlas")):
        db.add(Ship(name="MV Blue Atlas", imo_number="IMO-9481152", current_port="Mumbai"))
    db.flush()
    first_ship = db.scalar(select(Ship).order_by(Ship.name))

    _ensure_user(
        db,
        email=settings.SEED_ADMIN_EMAIL,
        username=settings.SEED_ADMIN_USERNAME,
        password=settings.SEED_ADMIN_PASSWORD,
        role="admin",
    )
    admin = db.scalar(select(User).where(User.email == settings.SEED_ADMIN_EMAIL))
    if admin:
        admin.all_ships = True
    _ensure_user(
        db,
        email=settings.SEED_CREW_EMAIL,
        username=settings.SEED_CREW_USERNAME,
        password=settings.SEED_CREW_PASSWORD,
        role="crew",
    )
    crew = db.scalar(select(User).where(User.email == settings.SEED_CREW_EMAIL))
    if crew and first_ship and crew.ship_id is None:
        crew.ship_id = first_ship.id
    db.commit()
