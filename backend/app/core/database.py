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
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "users" in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns("users")}
            if "ship_id" not in columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN ship_id INTEGER"))
