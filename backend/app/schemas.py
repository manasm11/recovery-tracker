from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Auth ----
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str


# ---- Reminders ----
class ReminderBase(BaseModel):
    reminder_date: date
    notes: str = ""
    next_date: date | None = None


class ReminderCreate(ReminderBase):
    pass


class ReminderOut(ReminderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    created_at: datetime


# ---- Customers ----
class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(default="", max_length=40)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    deleted_at: datetime | None = None
    balance: float | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    contact_name: str
    phone: str
    created_at: datetime


class ContactCreate(BaseModel):
    contact_name: str = Field(default="", max_length=200)
    phone: str = Field(min_length=1, max_length=40)


class ContactUpdate(BaseModel):
    contact_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, min_length=1, max_length=40)


class CustomerWithReminders(CustomerOut):
    contacts: list[ContactOut] = []
    reminders: list[ReminderOut] = []


class CustomerStatus(CustomerOut):
    """Customer plus a summary of their reminder status (for dashboards / lists)."""

    last_reminder_date: date | None = None
    next_date: date | None = None
    last_notes: str | None = None
    reminders_count: int = 0
    # "due_today", "overdue", "upcoming", "no_followup", "never_contacted"
    status: str


class DeletedCustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    created_at: datetime
    deleted_at: datetime
    balance: float | None = None
    days_until_purge: int = 0


# ---- Dashboard ----
class DashboardStats(BaseModel):
    total_customers: int
    due_today: int
    overdue: int
    never_contacted: int
    no_followup: int


# ---- Import ----
class ImportRequest(BaseModel):
    text: str = Field(min_length=1)


class ImportedCustomerInfo(BaseModel):
    name: str
    amount: float


class ImportResult(BaseModel):
    imported: int
    duplicates: int
    credit_skipped: int
    total_parsed: int
    names_imported: list[ImportedCustomerInfo]
    names_skipped_credit: list[ImportedCustomerInfo]
    names_skipped_duplicate: list[ImportedCustomerInfo]
