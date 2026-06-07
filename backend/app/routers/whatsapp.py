from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import whatsapp
from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Reminder, User

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


class StatusOut(BaseModel):
    connected: bool
    has_qr: bool


class SendRequest(BaseModel):
    phone: str
    message: str
    customer_id: int | None = None


class SendResult(BaseModel):
    success: bool
    detail: str


class PairRequest(BaseModel):
    phone: str


class PairResult(BaseModel):
    success: bool
    code: str | None = None
    detail: str


@router.get("/status", response_model=StatusOut)
def wa_status(_: User = Depends(get_current_user)) -> StatusOut:
    return StatusOut(
        connected=whatsapp.is_connected(),
        has_qr=whatsapp.get_qr_text() is not None,
    )


@router.get("/qr")
def wa_qr(_: User = Depends(get_current_user)) -> Response:
    png = whatsapp.get_qr_png()
    if png is None:
        if whatsapp.is_connected():
            raise HTTPException(400, "Already connected — no QR needed")
        raise HTTPException(404, "No QR code available yet — try again shortly")
    return Response(content=png, media_type="image/png")


@router.post("/pair", response_model=PairResult)
def wa_pair(req: PairRequest, _: User = Depends(get_current_user)) -> PairResult:
    """Request a pairing code for the given phone number.

    This is an alternative to QR scanning — the user enters the code
    in WhatsApp (Settings → Linked Devices → Link with phone number).
    """
    if whatsapp.is_connected():
        return PairResult(success=True, code=None, detail="Already connected")

    if not whatsapp.is_ready():
        raise HTTPException(503, "WhatsApp client not ready — please wait a moment")

    code = whatsapp.pair_phone(req.phone)
    if code:
        return PairResult(success=True, code=code, detail="Enter this code in WhatsApp")
    return PairResult(
        success=False,
        code=None,
        detail="Failed to generate pairing code — try again",
    )


@router.post("/logout", response_model=SendResult)
def wa_logout(_: User = Depends(get_current_user)) -> SendResult:
    """Log out from WhatsApp (unlink device) and allow reconnecting with another number."""
    try:
        whatsapp.logout()
        return SendResult(success=True, detail="Logged out — you can now connect with a different number")
    except Exception as e:
        return SendResult(success=False, detail=f"Logout failed: {e}")


@router.post("/restart", response_model=SendResult)
def wa_restart(_: User = Depends(get_current_user)) -> SendResult:
    """Restart the WhatsApp client (clears session, generates fresh QR)."""
    try:
        whatsapp.restart()
        return SendResult(success=True, detail="WhatsApp client restarted — new QR will appear shortly")
    except Exception as e:
        return SendResult(success=False, detail=f"Restart failed: {e}")


@router.post("/send", response_model=SendResult)
def wa_send(
    req: SendRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SendResult:
    if not whatsapp.is_connected():
        raise HTTPException(503, "WhatsApp not connected — scan QR first")
    ok = whatsapp.send_message(req.phone, req.message)
    if ok:
        # Log the reminder in customer history
        if req.customer_id:
            customer = db.get(Customer, req.customer_id)
            if customer and customer.deleted_at is None:
                reminder = Reminder(
                    customer_id=req.customer_id,
                    reminder_date=date.today(),
                    notes=f"[WhatsApp] {req.message}",
                    created_by=user.id,
                )
                db.add(reminder)
                db.commit()
        return SendResult(success=True, detail="Message sent")
    return SendResult(success=False, detail="Failed to send message")
