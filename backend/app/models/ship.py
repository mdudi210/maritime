from __future__ import annotations

from typing import Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Ship(Base):
    __tablename__ = "ships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    imo_number: Mapped[Optional[str]] = mapped_column(String(40), unique=True, nullable=True)
    current_port: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="operational", nullable=False)

    crew_members = relationship("User", back_populates="ship")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="ship")
    safety_drills = relationship("SafetyDrill", back_populates="ship")
