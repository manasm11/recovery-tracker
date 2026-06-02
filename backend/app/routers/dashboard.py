from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, User
from app.schemas import CustomerStatus, DashboardStats
from app.services import compute_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _all_statuses(db: Session) -> list[CustomerStatus]:
    today = date.today()
    customers = db.query(Customer).all()
    return [compute_status(c, today) for c in customers]


@router.get("/today", response_model=list[CustomerStatus])
def reminders_for_today(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CustomerStatus]:
    """Customers the employee needs to call today: due today or overdue.

    Sorted so the most overdue appear first.
    """
    statuses = [s for s in _all_statuses(db) if s.status in ("due_today", "overdue")]
    statuses.sort(key=lambda s: (s.next_date or date.max))
    return statuses


@router.get("/stats", response_model=DashboardStats)
def stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardStats:
    statuses = _all_statuses(db)
    return DashboardStats(
        total_customers=len(statuses),
        due_today=sum(1 for s in statuses if s.status == "due_today"),
        overdue=sum(1 for s in statuses if s.status == "overdue"),
        never_contacted=sum(1 for s in statuses if s.status == "never_contacted"),
        no_followup=sum(1 for s in statuses if s.status == "no_followup"),
    )
