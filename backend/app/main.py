import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import whatsapp
from app.config import get_settings
from app.database import SessionLocal
from app.models import Contact, Customer, Reminder
from app.routers import auth, contacts, customers, dashboard, reminders
from app.routers import whatsapp as whatsapp_router
from app.seed import init_db, seed_users

logger = logging.getLogger(__name__)

settings = get_settings()

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

PURGE_DAYS = 365
PURGE_INTERVAL_HOURS = 24


async def purge_old_deleted_records() -> None:
    while True:
        try:
            db = SessionLocal()
            try:
                cutoff = datetime.now(UTC) - timedelta(days=PURGE_DAYS)
                for model, label in [
                    (Reminder, "reminders"),
                    (Contact, "contacts"),
                    (Customer, "customers"),
                ]:
                    old = (
                        db.query(model)
                        .filter(
                            model.deleted_at.isnot(None),
                            model.deleted_at < cutoff,
                        )
                        .all()
                    )
                    if old:
                        for rec in old:
                            db.delete(rec)
                        db.commit()
                        logger.info("Purged %d %s deleted >%d days ago", len(old), label, PURGE_DAYS)
            finally:
                db.close()
        except Exception:
            logger.exception("Error during purge task")
        await asyncio.sleep(PURGE_INTERVAL_HOURS * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()
    task = asyncio.create_task(purge_old_deleted_records())
    whatsapp.start()
    yield
    task.cancel()


app = FastAPI(title="Recovery Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(contacts.router)
app.include_router(reminders.router)
app.include_router(dashboard.router)
app.include_router(whatsapp_router.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    index_file = STATIC_DIR / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api"):
            raise StarletteHTTPException(status_code=404, detail="Not found")
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_file)
