from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Reminder, User
from app.schemas import CustomerStatus, DailyCount, DashboardStats, MyActivity
from app.services import compute_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _all_statuses(db: Session) -> list[CustomerStatus]:
    today = date.today()
    customers = db.query(Customer).filter(Customer.deleted_at.is_(None)).all()
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


@router.get("/my-activity", response_model=MyActivity)
def my_activity(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyActivity:
    """Return the current user's daily call counts for the last 30 days."""
    today = date.today()
    since = today - timedelta(days=29)

    rows = (
        db.query(
            Reminder.reminder_date,
            func.count(Reminder.id),
        )
        .filter(
            Reminder.created_by == user.id,
            Reminder.deleted_at.is_(None),
            Reminder.reminder_date >= since,
        )
        .group_by(Reminder.reminder_date)
        .order_by(Reminder.reminder_date.asc())
        .all()
    )

    counts_map = {r[0]: r[1] for r in rows}
    daily_counts = [
        DailyCount(date=since + timedelta(days=i), count=counts_map.get(since + timedelta(days=i), 0))
        for i in range(30)
    ]

    return MyActivity(
        calls_today=counts_map.get(today, 0),
        daily_counts=daily_counts,
    )
