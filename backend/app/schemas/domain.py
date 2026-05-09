from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field


class ShipCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    imo_number: Optional[str] = Field(default=None, max_length=40)
    current_port: Optional[str] = Field(default=None, max_length=160)
    status: str = Field(default="operational", max_length=40)


class ShipUpdate(BaseModel):
    current_port: Optional[str] = Field(default=None, max_length=160)
    status: Optional[str] = Field(default=None, pattern="^(operational|maintenance|out_of_service|retired)$")


class ShipRead(ShipCreate):
    id: int

    model_config = {"from_attributes": True}


class MaintenanceTaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    description: Optional[str] = None
    ship_id: int
    assigned_to_id: Optional[int] = None
    assigned_to_ids: list[int] = Field(default_factory=list)
    assign_all_crew: bool = False
    due_date: date
    due_time: time


class MaintenanceTaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=180)
    description: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_ids: Optional[list[int]] = None
    status: Optional[str] = Field(default=None, pattern="^(pending|in_progress|completed)$")
    due_date: Optional[date] = None
    due_time: Optional[time] = None


class MaintenanceTaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    ship_id: int
    assigned_to_id: Optional[int]
    assigned_to_ids: list[int] = Field(default_factory=list)
    status: str
    due_date: date
    due_time: Optional[time]
    completed_by_id: Optional[int]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskCommentCreate(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)


class TaskCommentUser(BaseModel):
    id: int
    email: str
    username: str

    model_config = {"from_attributes": True}


class TaskCommentRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    comment: str
    created_at: datetime
    user: TaskCommentUser

    model_config = {"from_attributes": True}


class SafetyDrillCreate(BaseModel):
    drill_type: str = Field(min_length=2, max_length=120)
    ship_id: int
    scheduled_date: date
    scheduled_time: time
    end_time: time


class SafetyDrillUpdate(BaseModel):
    drill_type: Optional[str] = Field(default=None, min_length=2, max_length=120)
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[str] = Field(default=None, pattern="^(scheduled|active|completed|missed)$")


class SafetyDrillRead(BaseModel):
    id: int
    drill_type: str
    ship_id: int
    scheduled_date: date
    scheduled_time: Optional[time]
    end_time: Optional[time]
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
    drill_participation_percent: float


class DrillAttendanceMark(BaseModel):
    attendance: bool = True


class DrillCompletionSubmit(BaseModel):
    completed: bool = True


class DrillAttendanceUser(BaseModel):
    id: int
    email: str
    username: str

    model_config = {"from_attributes": True}


class DrillAttendanceEntry(BaseModel):
    id: int
    drill_id: int
    user_id: int
    attendance: bool
    completion_status: str
    attended_at: Optional[datetime]
    completed_at: Optional[datetime]
    user: DrillAttendanceUser

    model_config = {"from_attributes": True}


class ComplianceItems(BaseModel):
    pending_maintenance: list[MaintenanceTaskRead]
    overdue_maintenance: list[MaintenanceTaskRead]
    missed_drills: list[SafetyDrillRead]
