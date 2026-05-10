from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.domain import ComplianceItems, DashboardMetrics
from app.services.compliance_service import get_compliance_items, get_dashboard_metrics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/compliance", response_model=DashboardMetrics)
def compliance(
    ship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
) -> DashboardMetrics:
    return get_dashboard_metrics(db, current_user, ship_id)


@router.get("/compliance/items", response_model=ComplianceItems)
def compliance_items(
    ship_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "crew")),
) -> ComplianceItems:
    return get_compliance_items(db, current_user, ship_id, limit)
