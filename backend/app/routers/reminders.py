from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Reminder, User
from app.schemas import ReminderCreate, ReminderOut

router = APIRouter(prefix="/api/customers/{customer_id}/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Reminder]:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return (
        db.query(Reminder)
        .filter(Reminder.customer_id == customer_id)
        .order_by(Reminder.reminder_date.desc(), Reminder.id.desc())
        .all()
    )


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    customer_id: int,
    payload: ReminderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Reminder:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
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
    db.delete(reminder)
    db.commit()
