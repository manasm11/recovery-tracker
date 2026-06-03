from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Contact, Customer, User
from app.schemas import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/api/customers", tags=["contacts"])


def _get_customer(customer_id: int, db: Session) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/{customer_id}/contacts", response_model=list[ContactOut])
def list_contacts(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Contact]:
    _get_customer(customer_id, db)
    return (
        db.query(Contact)
        .filter(Contact.customer_id == customer_id)
        .order_by(Contact.id.asc())
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
    _get_customer(customer_id, db)
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
    _get_customer(customer_id, db)
    contact = db.get(Contact, contact_id)
    if contact is None or contact.customer_id != customer_id:
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
    _get_customer(customer_id, db)
    contact = db.get(Contact, contact_id)
    if contact is None or contact.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
