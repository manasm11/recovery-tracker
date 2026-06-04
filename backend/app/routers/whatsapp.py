from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app import whatsapp
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


class StatusOut(BaseModel):
    connected: bool
    has_qr: bool


class SendRequest(BaseModel):
    phone: str
    message: str


class SendResult(BaseModel):
    success: bool
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


@router.post("/send", response_model=SendResult)
def wa_send(req: SendRequest, _: User = Depends(get_current_user)) -> SendResult:
    if not whatsapp.is_connected():
        raise HTTPException(503, "WhatsApp not connected — scan QR first")
    ok = whatsapp.send_message(req.phone, req.message)
    if ok:
        return SendResult(success=True, detail="Message sent")
    return SendResult(success=False, detail="Failed to send message")
