"""WhatsApp integration via neonize.

Runs the neonize client in a background thread alongside FastAPI.
Provides helpers for QR pairing and sending messages.
"""

import io
import logging
import threading
from dataclasses import dataclass, field

import qrcode
from neonize.client import NewClient
from neonize.events import ConnectedEv, PairStatusEv
from neonize.utils import build_jid

logger = logging.getLogger(__name__)


@dataclass
class WhatsAppState:
    connected: bool = False
    qr_data: str | None = None
    client: NewClient | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _thread: threading.Thread | None = None


_state = WhatsAppState()


def get_state() -> WhatsAppState:
    return _state


def _run_client(db_path: str) -> None:
    """Entry point for the neonize background thread."""
    client = NewClient(db_path)
    _state.client = client

    @client.event(ConnectedEv)
    def on_connected(c: NewClient, _ev: ConnectedEv) -> None:
        logger.info("WhatsApp connected")
        with _state._lock:
            _state.connected = True
            _state.qr_data = None

    @client.event(PairStatusEv)
    def on_pair(c: NewClient, ev: PairStatusEv) -> None:
        logger.info("WhatsApp paired: %s", ev)
        with _state._lock:
            _state.connected = True
            _state.qr_data = None

    @client.event.qr
    def on_qr(c: NewClient, qr_bytes: bytes) -> None:
        qr_str = qr_bytes.decode("utf-8") if isinstance(qr_bytes, bytes) else str(qr_bytes)
        logger.info("WhatsApp QR received (len=%d)", len(qr_str))
        with _state._lock:
            _state.qr_data = qr_str
            _state.connected = False

    try:
        client.connect()
    except Exception:
        logger.exception("WhatsApp client error")


def start(db_path: str = "./data/whatsapp.db") -> None:
    """Start the neonize client in a background daemon thread."""
    if _state._thread is not None and _state._thread.is_alive():
        return
    t = threading.Thread(target=_run_client, args=(db_path,), daemon=True)
    t.start()
    _state._thread = t
    logger.info("WhatsApp background thread started")


def is_connected() -> bool:
    with _state._lock:
        return _state.connected


def get_qr_png() -> bytes | None:
    """Return the current QR code as a PNG image, or None if unavailable."""
    with _state._lock:
        data = _state.qr_data
    if not data:
        return None
    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def get_qr_text() -> str | None:
    with _state._lock:
        return _state.qr_data


def send_message(phone: str, text: str) -> bool:
    """Send a text message. Phone should be digits only (with country code)."""
    if not _state.client or not is_connected():
        return False
    try:
        digits = "".join(c for c in phone if c.isdigit())
        if not digits.startswith("91"):
            digits = "91" + digits
        jid = build_jid(digits)
        _state.client.send_message(jid, text)
        logger.info("WhatsApp message sent to %s", digits)
        return True
    except Exception:
        logger.exception("Failed to send WhatsApp message to %s", phone)
        return False
