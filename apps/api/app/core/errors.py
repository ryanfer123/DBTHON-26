from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, SQLAlchemyError


class DomainError(Exception):
    def __init__(self, code: str, status: int, message: str, retry_after: int | None = None):
        self.code, self.status, self.message, self.retry_after = code, status, message, retry_after


def error_response(request: Request, error: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={
            "error": {"code": error.code, "message": error.message, "details": {}},
            "request_id": request.state.request_id,
        },
        headers={"Retry-After": str(error.retry_after)} if error.retry_after else None,
    )


async def domain_error_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    return error_response(request, error)


async def validation_error_handler(request: Request, _: Exception) -> JSONResponse:
    # FastAPI's default validation output echoes inputs, including raw passwords.
    return error_response(request, DomainError("INVALID_INPUT", 422, "Check the supplied fields."))


async def database_error_handler(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, SQLAlchemyError)
    state = getattr(error.orig, "sqlstate", None) if isinstance(error, DBAPIError) else None
    diagnostic = getattr(error.orig, "diag", None) if isinstance(error, DBAPIError) else None
    code = str(getattr(diagnostic, "message_primary", "")).strip()
    mappings = {
        "UNAUTHENTICATED": (401, "Sign in to continue."),
        "INVALID_CREDENTIALS": (401, "Email or password is incorrect."),
        "CSRF_INVALID": (403, "Refresh your session and retry."),
        "ADMIN_REQUIRED": (403, "Zone administrator access is required."),
        "NOT_FOUND": (404, "The requested resource was not found."),
        "CAPACITY_REQUIRED": (422, "A positive receiver capacity is required."),
        "RECEIVER_ROLE_REQUIRED": (403, "A Receiver role is required."),
        "ROLE_NOT_REQUESTED": (422, "Only requested roles can be approved."),
        "ROLE_REQUIRED": (422, "Select a role to approve."),
        "INVALID_ROLE": (422, "The supplied role is not permitted."),
        "INVALID_INPUT": (422, "Check the supplied fields."),
    }
    if state == "P0001" and code in mappings:
        status, message = mappings[code]
        return error_response(request, DomainError(code, status, message))
    if state == "23505":
        return error_response(
            request,
            DomainError("CONTACT_IN_USE", 409, "That email or phone is already registered."),
        )
    if state in {"23503", "23514", "22003", "22001", "22P02"}:
        return error_response(
            request, DomainError("INVALID_INPUT", 422, "Check the supplied fields and zone.")
        )
    return error_response(
        request,
        DomainError("SERVICE_UNAVAILABLE", 503, "The service is temporarily unavailable.", 5),
    )
