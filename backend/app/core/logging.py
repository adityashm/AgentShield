import logging
import json
import uuid
import time
from typing import Callable, Any, Dict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class JsonFormatter(logging.Formatter):
    """Formats log records as structured JSON without leaking sensitive data."""
    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "org_id"):
            log_obj["org_id"] = record.org_id
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            # Sanitize extra data
            log_obj["data"] = self._mask_sensitive(record.extra_data)
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

    def _mask_sensitive(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sensitive_keys = {"password", "api_key", "secret", "token", "authorization", "key"}
        clean = {}
        for k, v in data.items():
            if any(s in k.lower() for s in sensitive_keys):
                clean[k] = "[REDACTED]"
            elif isinstance(v, dict):
                clean[k] = self._mask_sensitive(v)
            else:
                clean[k] = v
        return clean

def setup_logging(log_level: str = "INFO"):
    logger = logging.getLogger("agentshield")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    return logger

logger = setup_logging()

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Accept incoming X-Request-ID or generate new UUID
        request_id = request.headers.get("X-Request-ID") or f"req-{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        # Log request summary without secrets or large payloads
        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
            extra={"request_id": request_id, "status": response.status_code, "duration_ms": duration_ms},
        )
        return response
