import csv
import hashlib
import io
import json
from collections.abc import Iterator, Mapping
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import Response
from pydantic import AwareDatetime
from sqlalchemy import text

from app.core.errors import DomainError
from app.routes.identity import context
from app.trust.verify import verify as verify_chain
from app.workflows import service
from app.workflows.models import (
    Category,
    ClaimStatus,
    CommandResponse,
    Empty,
    ExchangeResponse,
    ExchangesResponse,
    ImpactResponse,
    LedgerEntry,
    LedgerResponse,
    LedgerVerificationResponse,
    ListingInput,
    ListingPatch,
    ListingResponse,
    ListingsResponse,
    ListingStatus,
    Meta,
    Notification,
    NotificationsResponse,
    OverviewResponse,
    PickupInput,
    PickupStatus,
    RatingInput,
    Reason,
    Task,
    TasksResponse,
    TrustResponse,
)

router = APIRouter(tags=["Redistribution"])
Key = Annotated[
    str,
    Header(alias="Idempotency-Key", min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$"),
]
Limit = Annotated[int, Query(ge=1, le=100)]
Cursor = Annotated[int, Query(ge=0)]


@router.get("/workspace/overview", response_model=OverviewResponse)
def workspace_overview(request: Request, response: Response) -> OverviewResponse | Response:
    with context(request) as c:
        overview = service.overview(c)
        uid = c.execute(text("SELECT dbthon_actor_id()")).scalar_one()
    canonical = json.dumps(
        {"actor": uid, "data": overview.data.model_dump(mode="json")}, sort_keys=True
    )
    etag = '"' + hashlib.sha256(canonical.encode()).hexdigest() + '"'
    if etag in {token.strip() for token in request.headers.get("If-None-Match", "").split(",")}:
        return Response(
            status_code=304,
            headers={"ETag": etag, "X-Server-Time": overview.meta.server_time.isoformat()},
        )
    response.headers["ETag"] = etag
    return overview


@router.post("/listings", response_model=CommandResponse, status_code=201)
def create_listing(body: ListingInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "listing.create", None, None, body, key)


@router.get("/listings", response_model=ListingsResponse)
def food_feed(
    request: Request,
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_m: Annotated[int, Query(ge=100, le=5000)] = 5000,
    category: Category | None = None,
    cursor: Annotated[str | None, Query(max_length=1024)] = None,
    limit: Limit = 20,
    q: Annotated[str | None, Query(max_length=80)] = None,
    include_over_capacity: bool = False,
) -> ListingsResponse:
    with context(request) as c:
        data, meta = service.feed(
            c, latitude, longitude, radius_m, category, cursor, limit, q, include_over_capacity
        )
        return ListingsResponse(data=data, meta=meta)


@router.get("/listings/mine", response_model=ListingsResponse)
def own_listings(
    request: Request,
    status: ListingStatus | None = None,
    cursor: Cursor = 0,
    limit: Limit = 20,
    q: Annotated[str | None, Query(max_length=80)] = None,
) -> ListingsResponse:
    with context(request) as c:
        data, meta = service.listings_mine(c, status, cursor, limit, q)
        return ListingsResponse(data=data, meta=meta)


@router.get("/listings/{listing_id}", response_model=ListingResponse)
def listing_details(listing_id: int, request: Request) -> ListingResponse:
    with context(request) as c:
        data, meta = service.listing_detail(c, listing_id)
        return ListingResponse(data=data, meta=meta)


@router.patch("/listings/{listing_id}", response_model=CommandResponse)
def edit_listing(
    listing_id: int, body: ListingPatch, request: Request, key: Key
) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "listing.update", listing_id, None, body, key)


@router.post("/listings/{listing_id}/cancel", response_model=CommandResponse)
def cancel_listing(listing_id: int, body: Reason, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "listing.cancel", listing_id, None, body, key)


@router.post("/listings/{listing_id}/claims", response_model=CommandResponse, status_code=201)
def claim_listing(listing_id: int, body: Empty, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "claim.create", listing_id, None, body, key)


@router.get("/claims/mine", response_model=ExchangesResponse)
def own_claims(
    request: Request, status: ClaimStatus | None = None, cursor: Cursor = 0, limit: Limit = 20
) -> ExchangesResponse:
    with context(request) as c:
        data, meta = service.exchanges(c, "claims", status, cursor, limit)
        return ExchangesResponse(data=data, meta=meta)


@router.get("/claims/{claim_id}", response_model=ExchangeResponse)
def claim_details(claim_id: int, request: Request) -> ExchangeResponse:
    with context(request) as c:
        data = service.exchange_detail(c, claim_id)
        return ExchangeResponse(data=data, meta=Meta(server_time=service.clock(c)))


@router.post("/claims/{claim_id}/cancel", response_model=CommandResponse)
def cancel_claim(claim_id: int, body: Reason, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "claim.cancel", claim_id, None, body, key)


@router.get("/pickup-tasks", response_model=TasksResponse)
def pickup_tasks(
    request: Request,
    cursor: Cursor = 0,
    limit: Limit = 20,
    radius_m: Annotated[int, Query(ge=100, le=5000)] = 5000,
) -> TasksResponse:
    with context(request) as c:
        service.require(c, "Volunteer")
        rows = (
            c.execute(
                text(f"""
          SELECT c.claim_id,c.listing_id,l.food_type,l.quantity_kg::text,l.expiry_window_end,
          coalesce(d.name,'Donor unavailable') AS donor_name,l.pickup_lat::text,l.pickup_long::text,
          ST_Distance(l.pickup_location,{service.PROFILE_POINT}) AS distance_m
          FROM claims c JOIN food_listings l USING(listing_id)
          LEFT JOIN users d ON d.user_id=l.donor_id
          WHERE c.claim_id>:cursor AND dbthon_can_view_task(c.claim_id)
            AND ST_DWithin(l.pickup_location,{service.PROFILE_POINT},:radius)
          ORDER BY c.claim_id LIMIT :limit"""),
                {"cursor": cursor, "limit": limit + 1, "radius": radius_m},
            )
            .mappings()
            .all()
        )
        return TasksResponse(
            data=[Task.model_validate(row) for row in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["claim_id"] if len(rows) > limit else None,
            ),
        )


@router.post("/claims/{claim_id}/pickups", response_model=CommandResponse, status_code=201)
def accept_pickup(claim_id: int, body: PickupInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "pickup.accept", claim_id, None, body, key)


@router.get("/pickups/mine", response_model=ExchangesResponse)
def own_pickups(
    request: Request,
    status: PickupStatus | None = None,
    cursor: Annotated[str | None, Query(max_length=80)] = None,
    limit: Limit = 20,
) -> ExchangesResponse:
    with context(request) as c:
        data, meta = service.pickups_mine(c, status, cursor, limit)
        return ExchangesResponse(data=data, meta=meta)


@router.post("/claims/{claim_id}/pickups/{pickup_id}/cancel", response_model=CommandResponse)
def cancel_pickup(
    claim_id: int, pickup_id: int, body: Reason, request: Request, key: Key
) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "pickup.cancel", claim_id, pickup_id, body, key)


@router.post("/claims/{claim_id}/pickups/{pickup_id}/picked-up", response_model=CommandResponse)
def collect_food(
    claim_id: int, pickup_id: int, body: Empty, request: Request, key: Key
) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "pickup.collect", claim_id, pickup_id, body, key)


@router.post("/claims/{claim_id}/pickups/{pickup_id}/delivered", response_model=CommandResponse)
def deliver_food(
    claim_id: int, pickup_id: int, body: Empty, request: Request, key: Key
) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "pickup.deliver", claim_id, pickup_id, body, key)


@router.post("/admin/claims/{claim_id}/fail", response_model=CommandResponse)
def fail_exchange(claim_id: int, body: Reason, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "claim.fail", claim_id, None, body, key)


@router.get("/admin/claims", response_model=ExchangesResponse)
def admin_claims(
    request: Request, status: ClaimStatus | None = None, cursor: Cursor = 0, limit: Limit = 20
) -> ExchangesResponse:
    with context(request) as c:
        data, meta = service.exchanges(c, "admin", status, cursor, limit)
        return ExchangesResponse(data=data, meta=meta)


@router.post("/claims/{claim_id}/ratings", response_model=CommandResponse, status_code=201)
def rate_exchange(claim_id: int, body: RatingInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "rating.create", claim_id, None, body, key)


@router.get("/notifications", response_model=NotificationsResponse)
def inbox(
    request: Request, unread_only: bool = False, cursor: Cursor = 0, limit: Limit = 20
) -> NotificationsResponse:
    with context(request) as c:
        rows = (
            c.execute(
                text("""
          SELECT notification_id,message,type,created_at,sent_at,read_at FROM notifications
          WHERE user_id=dbthon_actor_id() AND sent_at IS NOT NULL AND notification_id>:cursor
            AND (NOT :unread OR read_at IS NULL) ORDER BY notification_id LIMIT :limit"""),
                {"cursor": cursor, "limit": limit + 1, "unread": unread_only},
            )
            .mappings()
            .all()
        )
        return NotificationsResponse(
            data=[Notification.model_validate(row) for row in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["notification_id"] if len(rows) > limit else None,
            ),
        )


@router.post("/notifications/{notification_id}/read", response_model=CommandResponse)
def read_notification(
    notification_id: int, body: Empty, request: Request, key: Key
) -> CommandResponse:
    with context(request, write=True) as c:
        return service.command(c, "inbox.read", notification_id, None, body, key)


@router.get("/users/{user_id}/trust", response_model=TrustResponse)
def user_trust(user_id: int, request: Request) -> TrustResponse:
    with context(request) as c:
        return TrustResponse.model_validate(
            {"data": c.execute(text("SELECT dbthon_trust(:uid)"), {"uid": user_id}).scalar_one()}
        )


def ledger(request: Request, user_id: int | None, cursor: int, limit: int) -> LedgerResponse:
    with context(request) as c:
        uid = c.execute(text("SELECT dbthon_actor_id()")).scalar_one()
        if user_id is not None:
            service.require(c, "Admin")
            if not c.execute(
                text("SELECT 1 FROM users WHERE user_id=:uid AND zone_id=dbthon_actor_zone()"),
                {"uid": user_id},
            ).first():
                raise DomainError("NOT_FOUND", 404, "The requested audit history was not found.")
            uid = user_id
        rows = (
            c.execute(
                text(
                    "SELECT * FROM trust_ledger WHERE user_id=:uid AND sequence>:cursor "
                    "ORDER BY sequence LIMIT :limit"
                ),
                {"uid": uid, "cursor": cursor, "limit": limit + 1},
            )
            .mappings()
            .all()
        )
        return LedgerResponse(
            data=[LedgerEntry.model_validate(row) for row in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["sequence"] if len(rows) > limit else None,
            ),
        )


@router.get("/trust-ledger/mine", response_model=LedgerResponse)
def own_ledger(request: Request, cursor: Cursor = 0, limit: Limit = 20) -> LedgerResponse:
    return ledger(request, None, cursor, limit)


@router.get("/admin/users/{user_id}/trust-ledger", response_model=LedgerResponse)
def admin_ledger(
    user_id: int, request: Request, cursor: Cursor = 0, limit: Limit = 20
) -> LedgerResponse:
    return ledger(request, user_id, cursor, limit)


@router.get("/admin/impact", response_model=ImpactResponse)
def impact_report(
    request: Request,
    start: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    end: Annotated[AwareDatetime | None, Query(alias="to")] = None,
    zone_id: Annotated[int | None, Query(gt=0)] = None,
    city: Annotated[str | None, Query(max_length=60)] = None,
    grouping: Literal["day", "zone", "city"] = "zone",
) -> ImpactResponse:
    with context(request) as c:
        return service.impact(c, start, end, zone_id, city, grouping)


@router.get("/admin/impact/export", response_class=Response)
def export_report(
    request: Request,
    start: Annotated[AwareDatetime | None, Query(alias="from")] = None,
    end: Annotated[AwareDatetime | None, Query(alias="to")] = None,
    zone_id: Annotated[int | None, Query(gt=0)] = None,
    city: Annotated[str | None, Query(max_length=60)] = None,
    grouping: Literal["day", "zone", "city"] = "zone",
) -> Response:
    report = impact_report(request, start, end, zone_id, city, grouping)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    fields = list(type(report.data[0]).model_fields) + [
        "meal_weight_kg",
        "emissions_source",
        "timezone",
    ]
    writer.writerow(fields)
    for row in report.data:
        values = {**row.model_dump(mode="json"), **report.factors.model_dump(mode="json")}
        cells = [values[field] for field in fields]
        writer.writerow(
            [
                "'" + cell
                if isinstance(cell, str) and cell.startswith(("=", "+", "-", "@", "\t", "\r"))
                else cell
                for cell in cells
            ]
        )
    return Response(
        output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="second-table-impact.csv"'},
    )


@router.get("/trust-ledger/mine/verification", response_model=LedgerVerificationResponse)
def verify_own_ledger(request: Request) -> dict[str, object]:
    with context(request) as c:
        rows = (
            c.execution_options(stream_results=True)
            .execute(
                text("SELECT * FROM trust_ledger WHERE user_id=dbthon_actor_id() ORDER BY sequence")
            )
            .mappings()
        )
        head: dict[str, object] = {"head_hash": None, "checked_through_sequence": 0}

        def entries() -> Iterator[Mapping[str, object]]:
            for row in rows:
                head.update(head_hash=row["curr_hash"], checked_through_sequence=row["sequence"])
                yield dict(row)

        try:
            count = verify_chain(entries())
        except ValueError:
            return {
                "data": {
                    "valid": False,
                    "entries_verified": 0,
                    "head_hash": None,
                    "checked_through_sequence": 0,
                    "assurance": "Stored chain is inconsistent.",
                }
            }
    return {
        "data": {
            "valid": True,
            "entries_verified": count,
            **head,
            "assurance": (
                "Internal consistency checked independently. A database owner can rewrite "
                "the full chain; no external checkpoint was checked."
            ),
        }
    }


@router.get("/listings/{listing_id}/photo", response_class=Response)
def listing_photo(listing_id: int, request: Request) -> Response:
    with context(request) as c:
        service.require(c)
        image = c.execute(
            text("SELECT thumbnail FROM listing_photos WHERE listing_id=:id"), {"id": listing_id}
        ).scalar_one_or_none()
        if image is None:
            raise DomainError("NOT_FOUND", 404, "No photo is available for this listing.")
        return Response(
            content=bytes(image),
            media_type="image/jpeg",
            headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
        )


@router.post("/admin/listings/{listing_id}/photo/remove", response_model=CommandResponse)
def remove_listing_photo(
    listing_id: int, request: Request, key: Key, body: Empty
) -> CommandResponse:
    with context(request, write=True) as c:
        service.require(c, "Admin")
        result = c.execute(
            text("SELECT dbthon_set_listing_photo(:id,NULL,:key)"), {"id": listing_id, "key": key}
        ).scalar_one()
        return CommandResponse.model_validate(result)
