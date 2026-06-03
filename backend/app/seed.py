"""Create the database tables and seed initial user accounts."""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password

logger = logging.getLogger(__name__)

_MIGRATIONS: list[tuple[str, str, str]] = [
    ("customers", "deleted_at", "ALTER TABLE customers ADD COLUMN deleted_at DATETIME"),
    ("customers", "balance", "ALTER TABLE customers ADD COLUMN balance FLOAT"),
]


def _run_migrations() -> None:
    insp = inspect(engine)
    for table, column, ddl in _MIGRATIONS:
        if table not in insp.get_table_names():
            continue
        cols = {c["name"] for c in insp.get_columns(table)}
        if column not in cols:
            with engine.begin() as conn:
                conn.execute(text(ddl))
            logger.info("Migration: added column %s.%s", table, column)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def seed_users(db: Session) -> None:
    settings = get_settings()
    seeds = [
        (settings.seed_username, settings.seed_password, "employee"),
        (settings.seed_admin_username, settings.seed_admin_password, "admin"),
    ]
    for username, password, role in seeds:
        existing = db.query(User).filter(User.username == username).first()
        if existing is None:
            db.add(
                User(
                    username=username,
                    password_hash=hash_password(password),
                    role=role,
                )
            )
    db.commit()


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()
    print("Database initialized and users seeded.")


if __name__ == "__main__":
    main()
