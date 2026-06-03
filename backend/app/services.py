from datetime import date

from app.models import Customer
from app.schemas import CustomerStatus


def compute_status(customer: Customer, today: date) -> CustomerStatus:
    """Derive a customer's follow-up status from their reminder history.

    The reminders relationship is ordered by reminder_date desc, so the first
    element (if any) is the most recent reminder.
    """
    reminders = [r for r in customer.reminders if r.deleted_at is None]
    count = len(reminders)

    if count == 0:
        status = "never_contacted"
        last_reminder_date = None
        next_date = None
        last_notes = None
    else:
        latest = reminders[0]
        last_reminder_date = latest.reminder_date
        next_date = latest.next_date
        last_notes = latest.notes
        if next_date is None:
            status = "no_followup"
        elif next_date < today:
            status = "overdue"
        elif next_date == today:
            status = "due_today"
        else:
            status = "upcoming"

    return CustomerStatus(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        created_at=customer.created_at,
        deleted_at=customer.deleted_at,
        balance=customer.balance,
        last_reminder_date=last_reminder_date,
        next_date=next_date,
        last_notes=last_notes,
        reminders_count=count,
        status=status,
    )
