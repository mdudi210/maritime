from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SafetyDrill(Base):
    __tablename__ = "safety_drills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    drill_type: Mapped[str] = mapped_column(String(120), nullable=False)
    ship_id: Mapped[int] = mapped_column(ForeignKey("ships.id"), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="scheduled", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    ship = relationship("Ship", back_populates="safety_drills")
    participation = relationship("DrillParticipation", back_populates="drill", cascade="all, delete-orphan")


class DrillParticipation(Base):
    __tablename__ = "drill_participation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    drill_id: Mapped[int] = mapped_column(ForeignKey("safety_drills.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    attendance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completion_status: Mapped[str] = mapped_column(String(40), default="missed", nullable=False)

    drill = relationship("SafetyDrill", back_populates="participation")
    user = relationship("User")
