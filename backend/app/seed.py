"""Create the database tables and seed initial user accounts."""

from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


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
