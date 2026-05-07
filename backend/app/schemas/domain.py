from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ShipCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    imo_number: Optional[str] = Field(default=None, max_length=40)
    current_port: Optional[str] = Field(default=None, max_length=160)
    status: str = Field(default="operational", max_length=40)


class ShipRead(ShipCreate):
    id: int

    model_config = {"from_attributes": True}


class MaintenanceTaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    description: Optional[str] = None
    ship_id: int
    assigned_to_id: Optional[int] = None
    due_date: date


class MaintenanceTaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=180)
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    status: Optional[str] = Field(default=None, pattern="^(pending|in_progress|completed)$")
    due_date: Optional[date] = None


class MaintenanceTaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    ship_id: int
    assigned_to_id: Optional[int]
    status: str
    due_date: date
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SafetyDrillCreate(BaseModel):
    drill_type: str = Field(min_length=2, max_length=120)
    ship_id: int
    scheduled_date: date


class SafetyDrillUpdate(BaseModel):
    drill_type: Optional[str] = Field(default=None, min_length=2, max_length=120)
    scheduled_date: Optional[date] = None
    status: Optional[str] = Field(default=None, pattern="^(scheduled|completed|missed)$")


class SafetyDrillRead(BaseModel):
    id: int
    drill_type: str
    ship_id: int
    scheduled_date: date
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardMetrics(BaseModel):
    ships: int
    maintenance_total: int
    maintenance_completed: int
    maintenance_overdue: int
    drills_total: int
    drills_completed: int
    drills_missed: int
    maintenance_compliance_percent: float
    drill_compliance_percent: float
