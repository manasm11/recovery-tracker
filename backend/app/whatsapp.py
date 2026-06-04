"""WhatsApp integration via neonize.

Runs the neonize client in a background thread alongside FastAPI.
Provides helpers for QR pairing, pairing code, and sending messages.
"""

import io
import logging
import threading
import time
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
    pair_code: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock)
    _thread: threading.Thread | None = None
    _db_path: str = "./data/whatsapp.db"
    _ready: bool = False


_state = WhatsAppState()


def get_state() -> WhatsAppState:
    return _state


def _run_client(db_path: str) -> None:
    """Entry point for the neonize background thread."""
    client = NewClient(db_path)
    with _state._lock:
        _state.client = client
        _state._ready = True

    @client.event(ConnectedEv)
    def on_connected(c: NewClient, _ev: ConnectedEv) -> None:
        logger.info("WhatsApp connected")
        with _state._lock:
            _state.connected = True
            _state.qr_data = None
            _state.pair_code = None

    @client.event(PairStatusEv)
    def on_pair(c: NewClient, ev: PairStatusEv) -> None:
        logger.info("WhatsApp paired: %s", ev)
        with _state._lock:
            _state.connected = True
            _state.qr_data = None
            _state.pair_code = None

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
    finally:
        with _state._lock:
            _state._ready = False


def start(db_path: str = "./data/whatsapp.db") -> None:
    """Start the neonize client in a background daemon thread."""
    with _state._lock:
        _state._db_path = db_path
    if _state._thread is not None and _state._thread.is_alive():
        return
    t = threading.Thread(target=_run_client, args=(db_path,), daemon=True)
    t.start()
    _state._thread = t
    logger.info("WhatsApp background thread started")


def logout() -> bool:
    """Log out from WhatsApp (unlink device) and restart with fresh session."""
    import os

    with _state._lock:
        client = _state.client

    # Try to logout gracefully via the WhatsApp protocol
    if client is not None:
        try:
            client.logout()
            logger.info("WhatsApp logout successful")
        except Exception:
            logger.exception("WhatsApp logout call failed — will clear session anyway")

    db_path = _state._db_path

    # Reset state
    with _state._lock:
        _state.connected = False
        _state.qr_data = None
        _state.pair_code = None
        _state._ready = False
        _state.client = None

    # Remove session DB so a fresh pairing is required
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            logger.info("Removed WhatsApp session DB: %s", db_path)
        except OSError:
            logger.warning("Could not remove WhatsApp DB: %s", db_path)

    # Wait for old thread to die
    if _state._thread is not None:
        _state._thread.join(timeout=5)

    # Start fresh client
    t = threading.Thread(target=_run_client, args=(db_path,), daemon=True)
    t.start()
    with _state._lock:
        _state._thread = t
    logger.info("WhatsApp client restarted after logout")
    return True


def restart() -> None:
    """Restart the WhatsApp client (clear session and reconnect)."""
    import os

    db_path = _state._db_path
    # Reset state
    with _state._lock:
        _state.connected = False
        _state.qr_data = None
        _state.pair_code = None
        _state._ready = False
        _state.client = None

    # Remove stale session DB
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            logger.info("Removed stale WhatsApp session DB: %s", db_path)
        except OSError:
            logger.warning("Could not remove WhatsApp DB: %s", db_path)

    # Wait for old thread to die
    if _state._thread is not None:
        _state._thread.join(timeout=5)

    # Start fresh
    t = threading.Thread(target=_run_client, args=(db_path,), daemon=True)
    t.start()
    with _state._lock:
        _state._thread = t
    logger.info("WhatsApp client restarted")


def is_connected() -> bool:
    with _state._lock:
        return _state.connected


def is_ready() -> bool:
    with _state._lock:
        return _state._ready


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


def pair_phone(phone: str) -> str | None:
    """Request a pairing code for the given phone number.

    Returns the pairing code string, or None if the client isn't ready.
    Phone should include country code (e.g. '919876543210').
    """
    with _state._lock:
        client = _state.client
        if client is None or not _state._ready:
            return None

    digits = "".join(c for c in phone if c.isdigit())
    if not digits.startswith("91"):
        digits = "91" + digits

    try:
        # Wait a moment for the client to be fully connected to WA servers
        time.sleep(1)
        code = client.PairPhone(digits, show_push_notification=True)
        logger.info("WhatsApp pairing code generated for %s: %s", digits, code)
        with _state._lock:
            _state.pair_code = code
        return code
    except Exception:
        logger.exception("Failed to generate pairing code for %s", phone)
        return None


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
