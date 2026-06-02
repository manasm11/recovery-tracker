from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.ledger_parser import parse_ledger
from app.models import Customer, User
from app.schemas import (
    CustomerCreate,
    CustomerStatus,
    CustomerUpdate,
    CustomerWithReminders,
    ImportedCustomerInfo,
    ImportRequest,
    ImportResult,
)
from app.services import compute_status

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerStatus])
def list_customers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CustomerStatus]:
    query = db.query(Customer)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter((Customer.name.ilike(like)) | (Customer.phone.ilike(like)))
    customers = query.order_by(Customer.name.asc()).all()
    today = date.today()
    return [compute_status(c, today) for c in customers]


@router.post("", response_model=CustomerStatus, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CustomerStatus:
    customer = Customer(
        name=payload.name.strip(), phone=payload.phone.strip(), created_by=user.id
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return compute_status(customer, date.today())


@router.get("/{customer_id}", response_model=CustomerWithReminders)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerStatus)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CustomerStatus:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if payload.name is not None:
        customer.name = payload.name.strip()
    if payload.phone is not None:
        customer.phone = payload.phone.strip()
    db.commit()
    db.refresh(customer)
    return compute_status(customer, date.today())


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()


@router.post("/import", response_model=ImportResult)
def import_customers(
    payload: ImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ImportResult:
    summary = parse_ledger(payload.text)

    # Build a set of existing names (upper-cased) for duplicate detection.
    existing_names: set[str] = {
        row.name.strip().upper() for row in db.query(Customer.name).all()
    }

    imported: list[ImportedCustomerInfo] = []
    skipped_dup: list[ImportedCustomerInfo] = []

    for entry in summary.debit_entries:
        norm = entry.name.strip().upper()
        if norm in existing_names:
            skipped_dup.append(ImportedCustomerInfo(name=entry.name, amount=entry.amount))
            continue
        db.add(Customer(name=entry.name.strip(), phone="", created_by=user.id))
        existing_names.add(norm)
        imported.append(ImportedCustomerInfo(name=entry.name, amount=entry.amount))

    db.commit()

    return ImportResult(
        imported=len(imported),
        duplicates=len(skipped_dup),
        credit_skipped=len(summary.credit_entries),
        total_parsed=summary.total_parsed,
        names_imported=imported,
        names_skipped_credit=[
            ImportedCustomerInfo(name=e.name, amount=e.amount)
            for e in summary.credit_entries
        ],
        names_skipped_duplicate=skipped_dup,
    )
