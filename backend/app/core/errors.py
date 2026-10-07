import logging

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
        "SAVE_LIMIT": (409, "You can save up to 100 listings. Remove one to save another."),
        "ISSUE_EXISTS": (409, "You already have an open report for this item."),
        "RATE_LIMITED": (429, "Too many messages or reports. Try again later."),
        "REQUEST_CLOSED": (409, "This food request is closed or fulfilled. Refresh the board."),
        "OFFER_EXISTS": (409, "This listing already answers a request. Choose another listing."),
        "STALE_PROPOSAL": (409, "Pickup time changed; refresh to review it."),
        "SCHEDULE_UNCONFIRMED": (409, "All participants must agree before collection."),
        "UNAUTHENTICATED": (401, "Sign in to continue."),
        "INVALID_CREDENTIALS": (401, "Email or password is incorrect."),
        "CSRF_INVALID": (403, "Refresh your session and retry."),
        "ADMIN_REQUIRED": (403, "Zone administrator access is required."),
        "ALREADY_ADMIN": (409, "This member is already an administrator."),
        "ACTIVE_EXCHANGES": (
            409,
            "Finish or cancel your active exchanges before changing community areas.",
        ),
        "NOT_FOUND": (404, "The requested resource was not found."),
        "CAPACITY_REQUIRED": (422, "A positive receiver capacity is required."),
        "RECEIVER_ROLE_REQUIRED": (403, "A Receiver role is required."),
        "ROLE_NOT_REQUESTED": (422, "Only requested roles can be approved."),
        "ROLE_REQUIRED": (422, "Select a role to approve."),
        "INVALID_ROLE": (422, "The supplied role is not permitted."),
        "INVALID_INPUT": (422, "Check the supplied fields."),
        "VERIFICATION_REQUIRED": (403, "An approved community role is required."),
        "LISTING_EXPIRED": (409, "The donor-provided deadline has passed. Refresh this view."),
        "LISTING_UNAVAILABLE": (409, "This food is no longer available. Refresh this view."),
        "TASK_UNAVAILABLE": (409, "Another volunteer accepted this collection. Refresh tasks."),
        "WINDOW_NOT_OPEN": (409, "This collection window has not opened yet."),
        "SELF_CLAIM_FORBIDDEN": (403, "You cannot claim your own food."),
        "SELF_PICKUP_FORBIDDEN": (403, "A volunteer must be separate from the donor and receiver."),
        "CAPACITY_INSUFFICIENT": (409, "This quantity exceeds your declared receiving capacity."),
        "OUTSIDE_PICKUP_RADIUS": (
            409,
            "This pickup is outside the 5 km radius of your saved location.",
        ),
        "DONOR_UNAVAILABLE": (409, "The donor is no longer eligible to share food."),
        "ACTION_NOT_ALLOWED": (
            409,
            "The current exchange state does not allow this action. Refresh this view.",
        ),
        "DELIVERY_REQUIRED": (409, "Ratings become available after successful delivery."),
        "INVALID_RATING_TARGET": (403, "Rate only the other donor or receiver in this exchange."),
        "ALREADY_RATED": (409, "You have already rated this exchange."),
        "IDEMPOTENCY_CONFLICT": (409, "That request key was already used with different details."),
        "INVALID_WINDOW": (
            422,
            "Use ordered collection times, a past prepared time and a deadline within 7 days.",
        ),
    }
    if state == "P0001" and code in mappings:
        status, message = mappings[code]
        return error_response(request, DomainError(code, status, message))
    if state == "23505" and request.url.path.startswith(("/api/v1/listings", "/api/v1/claims")):
        return error_response(
            request,
            DomainError(
                "ALLOCATION_CONFLICT", 409, "The allocation changed. Refresh and try again."
            ),
        )
    if state == "23505":
        return error_response(
            request,
            DomainError("CONTACT_IN_USE", 409, "That email or phone is already registered."),
        )
    if state in {"23502", "23503", "23514", "22003", "22001", "22P02", "22007", "22008"}:
        return error_response(
            request, DomainError("INVALID_INPUT", 422, "Check the supplied fields and zone.")
        )
    logging.getLogger("second_table.database").error(
        "Database command failed with SQLSTATE %s and code %s", state, code
    )
    return error_response(
        request,
        DomainError("SERVICE_UNAVAILABLE", 503, "The service is temporarily unavailable.", 5),
    )
