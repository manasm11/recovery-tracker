"""Entry-point shim so the app can be served as ``main:app``."""

from app.main import app

__all__ = ["app"]
