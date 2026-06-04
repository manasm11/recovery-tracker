from datetime import UTC, date, datetime

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
    DeletedCustomerOut,
    ImportedCustomerInfo,
    ImportRequest,
    ImportResult,
)
from app.services import compute_status

router = APIRouter(prefix="/api/customers", tags=["customers"])

PURGE_DAYS = 365


def _active_query(db: Session):
    return db.query(Customer).filter(Customer.deleted_at.is_(None))


@router.get("/deleted", response_model=list[DeletedCustomerOut])
def list_deleted_customers(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DeletedCustomerOut]:
    customers = (
        db.query(Customer)
        .filter(Customer.deleted_at.isnot(None))
        .order_by(Customer.deleted_at.desc())
        .all()
    )
    now = datetime.now(UTC)
    result = []
    for c in customers:
        days_passed = (now - c.deleted_at).days
        days_left = max(0, PURGE_DAYS - days_passed)
        result.append(
            DeletedCustomerOut(
                id=c.id,
                name=c.name,
                phone=c.phone,
                created_at=c.created_at,
                deleted_at=c.deleted_at,
                balance=c.balance,
                days_until_purge=days_left,
            )
        )
    return result


@router.get("", response_model=list[CustomerStatus])
def list_customers(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CustomerStatus]:
    query = _active_query(db)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter((Customer.name.ilike(like)) | (Customer.phone.ilike(like)))
    customers = query.order_by(Customer.name.asc()).all()
    today = date.today()
    results = [compute_status(c, today) for c in customers]
    if status_filter:
        results = [r for r in results if r.status == status_filter]
    return results


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
    if customer is None or customer.deleted_at is not None:
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
    if customer is None or customer.deleted_at is not None:
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
    if customer.deleted_at is not None:
        return
    customer.deleted_at = datetime.now(UTC)
    db.commit()


@router.post("/{customer_id}/restore", response_model=CustomerStatus)
def restore_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CustomerStatus:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    if customer.deleted_at is None:
        raise HTTPException(status_code=400, detail="Customer is not deleted")
    customer.deleted_at = None
    db.commit()
    db.refresh(customer)
    return compute_status(customer, date.today())


@router.post("/import", response_model=ImportResult)
def import_customers(
    payload: ImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ImportResult:
    summary = parse_ledger(payload.text)

    imported: list[ImportedCustomerInfo] = []
    skipped_dup: list[ImportedCustomerInfo] = []

    existing_customers: dict[str, Customer] = {
        row.name.strip().upper(): row
        for row in _active_query(db).all()
    }

    for entry in summary.debit_entries:
        norm = entry.name.strip().upper()
        if norm in existing_customers:
            existing_customers[norm].balance = entry.amount
            skipped_dup.append(ImportedCustomerInfo(name=entry.name, amount=entry.amount))
            continue
        customer = Customer(
            name=entry.name.strip(),
            phone="",
            created_by=user.id,
            balance=entry.amount,
        )
        db.add(customer)
        existing_customers[norm] = customer
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
