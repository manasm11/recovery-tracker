from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Reminder, User
from app.schemas import ReminderCreate, ReminderOut

router = APIRouter(prefix="/api/customers/{customer_id}/reminders", tags=["reminders"])


def _get_active_customer(customer_id: int, db: Session) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None or customer.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Reminder]:
    _get_active_customer(customer_id, db)
    return (
        db.query(Reminder)
        .filter(Reminder.customer_id == customer_id, Reminder.deleted_at.is_(None))
        .order_by(Reminder.reminder_date.desc(), Reminder.id.desc())
        .all()
    )


@router.get("/deleted", response_model=list[ReminderOut])
def list_deleted_reminders(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Reminder]:
    _get_active_customer(customer_id, db)
    return (
        db.query(Reminder)
        .filter(Reminder.customer_id == customer_id, Reminder.deleted_at.isnot(None))
        .order_by(Reminder.deleted_at.desc())
        .all()
    )


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    customer_id: int,
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Reminder:
    _get_active_customer(customer_id, db)
    reminder = Reminder(
        customer_id=customer_id,
        reminder_date=payload.reminder_date,
        notes=payload.notes.strip(),
        next_date=payload.next_date,
        created_by=user.id,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    customer_id: int,
    reminder_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None or reminder.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if reminder.deleted_at is not None:
        return
    reminder.deleted_at = datetime.now(UTC)
    db.commit()


@router.post("/{reminder_id}/restore", response_model=ReminderOut)
def restore_reminder(
    customer_id: int,
    reminder_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None or reminder.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if reminder.deleted_at is None:
        raise HTTPException(status_code=400, detail="Reminder is not deleted")
    reminder.deleted_at = None
    db.commit()
    db.refresh(reminder)
    return reminder
