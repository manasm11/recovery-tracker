from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Reminder, User
from app.schemas import CallDetail, CustomerStatus, DailyCount, DashboardStats, MyActivity, UserOut
from app.services import compute_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _all_statuses(db: Session) -> list[CustomerStatus]:
    today = date.today()
    customers = db.query(Customer).filter(Customer.deleted_at.is_(None)).all()
    return [compute_status(c, today) for c in customers]


def _resolve_target_user(
    db: Session, current_user: User, user_id: int | None
) -> int:
    """Return the effective user ID to query. Admins may specify another user."""
    if user_id is None:
        return current_user.id
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view other users' activity")
    return user_id


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


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[User]:
    """List all users. Admin only."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return db.query(User).order_by(User.username.asc()).all()


@router.get("/my-activity", response_model=MyActivity)
def my_activity(
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyActivity:
    """Return daily call counts for the last 30 days. Admins can pass user_id."""
    target_uid = _resolve_target_user(db, user, user_id)
    today = date.today()
    since = today - timedelta(days=29)

    rows = (
        db.query(
            Reminder.reminder_date,
            func.count(Reminder.id),
        )
        .filter(
            Reminder.created_by == target_uid,
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


@router.get("/calls-on-date", response_model=list[CallDetail])
def calls_on_date(
    target_date: date,
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CallDetail]:
    """Return customers called on a specific date. Admins can pass user_id."""
    target_uid = _resolve_target_user(db, user, user_id)
    rows = (
        db.query(Reminder, Customer.name)
        .join(Customer, Reminder.customer_id == Customer.id)
        .filter(
            Reminder.created_by == target_uid,
            Reminder.deleted_at.is_(None),
            Reminder.reminder_date == target_date,
        )
        .order_by(Reminder.id.asc())
        .all()
    )
    return [
        CallDetail(
            customer_id=r.customer_id,
            customer_name=name,
            notes=r.notes,
            reminder_date=r.reminder_date,
        )
        for r, name in rows
    ]
