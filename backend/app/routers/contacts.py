from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Contact, Customer, User
from app.schemas import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/api/customers", tags=["contacts"])


def _get_active_customer(customer_id: int, db: Session) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None or customer.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/{customer_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Contact]:
    _get_active_customer(customer_id, db)
    return (
        db.query(Contact)
        .filter(Contact.customer_id == customer_id, Contact.deleted_at.is_(None))
        .order_by(Contact.id.asc())
        .all()
    )


@router.get("/{customer_id}/contacts/deleted", response_model=list[ContactOut])
def list_deleted_contacts(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Contact]:
    _get_active_customer(customer_id, db)
    return (
        db.query(Contact)
        .filter(Contact.customer_id == customer_id, Contact.deleted_at.isnot(None))
        .order_by(Contact.deleted_at.desc())
        .all()
    )


@router.post(
    "/{customer_id}/contacts",
    response_model=ContactOut,
    status_code=status.HTTP_201_CREATED,
)
def create_contact(
    customer_id: int,
    payload: ContactCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contact:
    _get_active_customer(customer_id, db)
    contact = Contact(
        customer_id=customer_id,
        contact_name=payload.contact_name.strip(),
        phone=payload.phone.strip(),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{customer_id}/contacts/{contact_id}", response_model=ContactOut)
def update_contact(
    customer_id: int,
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contact:
    _get_active_customer(customer_id, db)
    contact = db.get(Contact, contact_id)
    if contact is None or contact.customer_id != customer_id or contact.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Contact not found")
    if payload.contact_name is not None:
        contact.contact_name = payload.contact_name.strip()
    if payload.phone is not None:
        contact.phone = payload.phone.strip()
    db.commit()
    db.refresh(contact)
    return contact


@router.delete(
    "/{customer_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_contact(
    customer_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    _get_active_customer(customer_id, db)
    contact = db.get(Contact, contact_id)
    if contact is None or contact.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.deleted_at is not None:
        return
    contact.deleted_at = datetime.now(UTC)
    db.commit()


@router.post(
    "/{customer_id}/contacts/{contact_id}/restore",
    response_model=ContactOut,
)
def restore_contact(
    customer_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Contact:
    _get_active_customer(customer_id, db)
    contact = db.get(Contact, contact_id)
    if contact is None or contact.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.deleted_at is None:
        raise HTTPException(status_code=400, detail="Contact is not deleted")
    contact.deleted_at = None
    db.commit()
    db.refresh(contact)
    return contact
