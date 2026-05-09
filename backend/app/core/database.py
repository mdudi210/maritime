from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import drill, maintenance, session, ship, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_lightweight_sqlite_migrations()


def _apply_lightweight_sqlite_migrations() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "users" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("users")}
            if "ship_id" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN ship_id INTEGER"))
            if "all_ships" not in columns:
                if settings.DATABASE_URL.startswith("sqlite"):
                    connection.execute(text("ALTER TABLE users ADD COLUMN all_ships BOOLEAN NOT NULL DEFAULT 0"))
                else:
                    connection.execute(text("ALTER TABLE users ADD COLUMN all_ships BOOLEAN NOT NULL DEFAULT FALSE"))
            if "password_reset_required" not in columns:
                if settings.DATABASE_URL.startswith("sqlite"):
                    connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_required BOOLEAN NOT NULL DEFAULT 0"))
                else:
                    connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_required BOOLEAN NOT NULL DEFAULT FALSE"))
        if "maintenance_tasks" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("maintenance_tasks")}
            if "due_time" not in columns:
                connection.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN due_time TIME"))
            if "completed_by_id" not in columns:
                connection.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN completed_by_id INTEGER"))
            if "completed_at" not in columns:
                connection.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN completed_at TIMESTAMP"))
        if "safety_drills" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("safety_drills")}
            if "scheduled_time" not in columns:
                connection.execute(text("ALTER TABLE safety_drills ADD COLUMN scheduled_time TIME"))
            if "end_time" not in columns:
                connection.execute(text("ALTER TABLE safety_drills ADD COLUMN end_time TIME"))
        if "drill_participation" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("drill_participation")}
            if "attended_at" not in columns:
                connection.execute(text("ALTER TABLE drill_participation ADD COLUMN attended_at TIMESTAMP"))
            if "completed_at" not in columns:
                connection.execute(text("ALTER TABLE drill_participation ADD COLUMN completed_at TIMESTAMP"))
