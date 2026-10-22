from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from typing import Optional, Dict, Any

class ProblemException(Exception):
    """Base exception for RFC 7807 Problem Details."""
    def __init__(
        self,
        status_code: int,
        title: str,
        detail: str,
        type_: str = "about:blank",
        headers: Optional[Dict[str, str]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.title = title
        self.detail = detail
        self.type_ = type_
        self.headers = headers or {}
        self.extra = extra or {}

class UnauthorizedError(ProblemException):
    def __init__(self, detail: str = "Authentication required or invalid credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Unauthorized",
            detail=detail,
            type_="https://agentshield.dev/errors/unauthorized",
        )

class ForbiddenError(ProblemException):
    def __init__(self, detail: str = "Access forbidden for current role or scope"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Forbidden",
            detail=detail,
            type_="https://agentshield.dev/errors/forbidden",
        )

class NotFoundError(ProblemException):
    def __init__(self, detail: str = "Requested resource not found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Not Found",
            detail=detail,
            type_="https://agentshield.dev/errors/not-found",
        )

class ConflictError(ProblemException):
    def __init__(self, detail: str = "Resource conflict detected"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            title="Conflict",
            detail=detail,
            type_="https://agentshield.dev/errors/conflict",
        )

class RateLimitExceededError(ProblemException):
    def __init__(self, detail: str = "Rate limit exceeded. Please slow down.", retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            title="Too Many Requests",
            detail=detail,
            type_="https://agentshield.dev/errors/rate-limit-exceeded",
            headers={"Retry-After": str(retry_after)},
            extra={"retry_after_seconds": retry_after},
        )

def create_problem_response(
    request: Request,
    status_code: int,
    title: str,
    detail: str,
    type_: str = "about:blank",
    headers: Optional[Dict[str, str]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    body = {
        "type": type_,
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": str(request.url.path),
        "request_id": request_id,
    }
    if extra:
        body.update(extra)

    response_headers = {"Content-Type": "application/problem+json"}
    if headers:
        response_headers.update(headers)

    return JSONResponse(
        status_code=status_code,
        content=body,
        headers=response_headers,
    )

async def problem_exception_handler(request: Request, exc: ProblemException) -> JSONResponse:
    return create_problem_response(
        request=request,
        status_code=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        type_=exc.type_,
        headers=exc.headers,
        extra=exc.extra,
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    title_map = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        405: "Method Not Allowed",
        409: "Conflict",
        422: "Unprocessable Entity",
        429: "Too Many Requests",
        500: "Internal Server Error",
    }
    return create_problem_response(
        request=request,
        status_code=exc.status_code,
        title=title_map.get(exc.status_code, "HTTP Error"),
        detail=str(exc.detail),
        type_=f"https://agentshield.dev/errors/http-{exc.status_code}",
        headers=exc.headers,
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    return create_problem_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Unprocessable Entity",
        detail="Request payload validation failed",
        type_="https://agentshield.dev/errors/validation-error",
        extra={"validation_errors": errors},
    )
