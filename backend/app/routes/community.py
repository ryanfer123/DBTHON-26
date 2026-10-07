"""Authenticated zone community needs, editorial updates and pickup agreements."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Query, Request
from pydantic import AwareDatetime, Field, field_validator
from sqlalchemy import text

from app.core.errors import DomainError
from app.identity.models import Input
from app.routes.identity import context
from app.routes.workflows import Key, Limit
from app.workflows import service
from app.workflows.models import Empty, Meta, Reason

router = APIRouter(tags=["Community tools"])
Kind = Literal["Announcement", "PartnerResource"]
Cursor = Annotated[int, Query(ge=0)]


class NeedInput(Input):
    food_type: str = Field(min_length=1, max_length=80)
    category: Literal["Veg", "NonVeg"]
    quantity_kg: Decimal = Field(gt=0, max_digits=8, decimal_places=2)
    needed_by: AwareDatetime
    note: str = Field(default="", max_length=300)

    @field_validator("food_type")
    @classmethod
    def name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A food name is required")
        return value.strip()


class OfferInput(Input):
    listing_id: int = Field(gt=0)


class ScheduleInput(Input):
    version: int = Field(gt=0)
    scheduled_time: AwareDatetime | None = None

    @field_validator("scheduled_time")
    @classmethod
    def non_null(cls, value: datetime | None) -> datetime:
        if value is None:
            raise ValueError("Omit scheduled_time to confirm the current proposal")
        return value


class UpdateInput(Input):
    kind: Kind
    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=1500)
    link: str | None = Field(default=None, max_length=500)
    ends_at: AwareDatetime

    @field_validator("title", "body")
    @classmethod
    def trim(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text is required")
        return value.strip()

    @field_validator("link")
    @classmethod
    def https_only(cls, value: str | None) -> str | None:
        if value is None:
            return value
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or any(ch.isspace() for ch in value)
        ):
            raise ValueError("Use an HTTPS link without embedded credentials")
        return value


class CommunityCommandData(Input):
    id: int


class CommunityCommandResponse(Input):
    data: CommunityCommandData


class Need(Input):
    request_id: int
    receiver_id: int
    receiver_name: str
    food_type: str
    category: str
    quantity_kg: str
    delivered_kg: str
    needed_by: datetime
    note: str
    status: str
    close_reason: str | None
    offer_count: int


class NeedsResponse(Input):
    data: list[Need]
    meta: Meta


class Offer(Input):
    offer_id: int
    listing_id: int
    food_type: str
    quantity_kg: str
    status: str
    donor_name: str


class NeedDetailResponse(Input):
    data: Need
    offers: list[Offer]
    meta: Meta


class Update(Input):
    update_id: int
    kind: Kind
    title: str
    body: str
    link: str | None
    ends_at: datetime
    created_at: datetime
    archived_at: datetime | None


class UpdatesResponse(Input):
    data: list[Update]
    meta: Meta


class Suggestion(Input):
    suggestion_id: int
    author_id: int
    kind: Kind
    title: str
    body: str
    link: str | None
    ends_at: datetime
    status: str
    reason: str | None
    update_id: int | None


class SuggestionsResponse(Input):
    data: list[Suggestion]
    meta: Meta


NEED_COLUMNS = """r.request_id,r.receiver_id,coalesce(u.name,'Community receiver') AS receiver_name,
 r.food_type,r.category,r.quantity_kg::text,r.needed_by,r.note,r.close_reason,
 dbthon_request_status(r.request_id) AS status,
 (SELECT count(*) FROM food_request_offers o WHERE o.request_id=r.request_id) AS offer_count,
 dbthon_request_delivered(r.request_id)::text AS delivered_kg"""
UPDATE_COLUMNS = "update_id,kind,title,body,link,ends_at,created_at,archived_at"
SUGGESTION_COLUMNS = "suggestion_id,author_id,kind,title,body,link,ends_at,status,reason,update_id"


def mutate(
    operation: str, object_id: int | None, body: Input, request: Request, key: str
) -> CommunityCommandResponse:
    with context(request, write=True) as c:
        result = c.execute(
            text("SELECT dbthon_community_command(:op,:id,CAST(:body AS jsonb),:key)"),
            {
                "op": operation,
                "id": object_id,
                "body": body.model_dump_json(exclude_unset=True),
                "key": key,
            },
        ).scalar_one()
        return CommunityCommandResponse.model_validate(result)


@router.get("/requests", response_model=NeedsResponse)
def requests(
    request: Request,
    cursor: Cursor = 0,
    limit: Limit = 20,
    status: Literal["Open", "Closed", "Fulfilled", "Expired"] | None = "Open",
    mine: bool = False,
    q: Annotated[str, Query(max_length=80)] = "",
) -> NeedsResponse:
    with context(request) as c:
        service.require(c)
        needle = q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        rows = (
            c.execute(
                text(f"""SELECT {NEED_COLUMNS} FROM food_requests r
          LEFT JOIN users u ON u.user_id=r.receiver_id
          WHERE r.request_id>:cursor AND (NOT :mine OR r.receiver_id=dbthon_actor_id())
          AND (CAST(:status AS text) IS NULL OR dbthon_request_status(r.request_id)=:status)
          AND r.food_type ILIKE :q ESCAPE '\\' ORDER BY r.request_id LIMIT :limit"""),
                {
                    "cursor": cursor,
                    "limit": limit + 1,
                    "status": status,
                    "mine": mine,
                    "q": "%" + needle + "%",
                },
            )
            .mappings()
            .all()
        )
        return NeedsResponse(
            data=[Need.model_validate(x) for x in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["request_id"] if len(rows) > limit else None,
            ),
        )


@router.post("/requests", response_model=CommunityCommandResponse, status_code=201)
def create_request(body: NeedInput, request: Request, key: Key) -> CommunityCommandResponse:
    return mutate("request.create", None, body, request, key)


@router.get("/requests/{request_id}", response_model=NeedDetailResponse)
def request_detail(request_id: int, request: Request) -> NeedDetailResponse:
    with context(request) as c:
        service.require(c)
        row = (
            c.execute(
                text(
                    f"""SELECT {NEED_COLUMNS} FROM food_requests r
          LEFT JOIN users u ON u.user_id=r.receiver_id WHERE r.request_id=:id"""
                ),
                {"id": request_id},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise DomainError("NOT_FOUND", 404, "This food request was not found.")
        offers = (
            c.execute(
                text("""SELECT o.offer_id,l.listing_id,l.food_type,l.quantity_kg::text,l.status,
          coalesce(u.name,'Community donor') AS donor_name FROM food_request_offers o
          JOIN food_listings l USING(listing_id)
          LEFT JOIN users u ON u.user_id=l.donor_id WHERE o.request_id=:id ORDER BY o.offer_id"""),
                {"id": request_id},
            )
            .mappings()
            .all()
        )
        return NeedDetailResponse(
            data=Need.model_validate(row),
            offers=[Offer.model_validate(x) for x in offers],
            meta=Meta(server_time=service.clock(c)),
        )


@router.post("/requests/{request_id}/close", response_model=CommunityCommandResponse)
def close_request(
    request_id: int, body: Reason, request: Request, key: Key
) -> CommunityCommandResponse:
    return mutate("request.close", request_id, body, request, key)


@router.post(
    "/requests/{request_id}/offers", response_model=CommunityCommandResponse, status_code=201
)
def offer(
    request_id: int, body: OfferInput, request: Request, key: Key
) -> CommunityCommandResponse:
    return mutate("request.offer", request_id, body, request, key)


@router.post(
    "/claims/{claim_id}/pickups/{pickup_id}/schedule", response_model=CommunityCommandResponse
)
def schedule(
    claim_id: int, pickup_id: int, body: ScheduleInput, request: Request, key: Key
) -> CommunityCommandResponse:
    with context(request, write=True) as c:
        result = c.execute(
            text("SELECT dbthon_schedule_command(:claim,:pickup,CAST(:body AS jsonb),:key)"),
            {
                "claim": claim_id,
                "pickup": pickup_id,
                "body": body.model_dump_json(exclude_unset=True),
                "key": key,
            },
        ).scalar_one()
        return CommunityCommandResponse.model_validate(result)


@router.get("/community/updates", response_model=UpdatesResponse)
def updates(
    request: Request, cursor: Cursor = 0, limit: Limit = 20, kind: Kind | None = None
) -> UpdatesResponse:
    with context(request) as c:
        rows = (
            c.execute(
                text(f"""SELECT {UPDATE_COLUMNS} FROM community_updates WHERE update_id>:cursor
          AND archived_at IS NULL AND ends_at>clock_timestamp()
          AND (CAST(:kind AS text) IS NULL OR kind=:kind)
          ORDER BY update_id LIMIT :limit"""),
                {"cursor": cursor, "limit": limit + 1, "kind": kind},
            )
            .mappings()
            .all()
        )
        return UpdatesResponse(
            data=[Update.model_validate(x) for x in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["update_id"] if len(rows) > limit else None,
            ),
        )


@router.post("/community/suggestions", response_model=CommunityCommandResponse, status_code=201)
def suggest(body: UpdateInput, request: Request, key: Key) -> CommunityCommandResponse:
    return mutate("suggestion.create", None, body, request, key)


@router.get("/community/suggestions/mine", response_model=SuggestionsResponse)
def own_suggestions(request: Request, cursor: Cursor = 0, limit: Limit = 20) -> SuggestionsResponse:
    with context(request) as c:
        service.require(c)
        rows = (
            c.execute(
                text(
                    f"""SELECT {SUGGESTION_COLUMNS} FROM community_suggestions
          WHERE author_id=dbthon_actor_id() AND suggestion_id>:cursor
          ORDER BY suggestion_id LIMIT :limit"""
                ),
                {"cursor": cursor, "limit": limit + 1},
            )
            .mappings()
            .all()
        )
        return SuggestionsResponse(
            data=[Suggestion.model_validate(x) for x in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["suggestion_id"] if len(rows) > limit else None,
            ),
        )


@router.get("/admin/community/suggestions", response_model=SuggestionsResponse)
def suggestion_queue(
    request: Request,
    cursor: Cursor = 0,
    limit: Limit = 20,
    status: Literal["Pending", "Published", "Rejected"] = "Pending",
) -> SuggestionsResponse:
    with context(request) as c:
        service.require(c, "Admin")
        rows = (
            c.execute(
                text(
                    f"""SELECT {SUGGESTION_COLUMNS} FROM community_suggestions
          WHERE status=:status AND suggestion_id>:cursor ORDER BY suggestion_id LIMIT :limit"""
                ),
                {"status": status, "cursor": cursor, "limit": limit + 1},
            )
            .mappings()
            .all()
        )
        return SuggestionsResponse(
            data=[Suggestion.model_validate(x) for x in rows[:limit]],
            meta=Meta(
                server_time=service.clock(c),
                next_cursor=rows[limit - 1]["suggestion_id"] if len(rows) > limit else None,
            ),
        )


@router.post("/admin/community/updates", response_model=CommunityCommandResponse, status_code=201)
def publish(body: UpdateInput, request: Request, key: Key) -> CommunityCommandResponse:
    return mutate("update.create", None, body, request, key)


@router.post(
    "/admin/community/updates/{update_id}/archive", response_model=CommunityCommandResponse
)
def archive(update_id: int, body: Empty, request: Request, key: Key) -> CommunityCommandResponse:
    return mutate("update.archive", update_id, body, request, key)


@router.post(
    "/admin/community/suggestions/{suggestion_id}/publish", response_model=CommunityCommandResponse
)
def approve(
    suggestion_id: int, body: Empty, request: Request, key: Key
) -> CommunityCommandResponse:
    return mutate("suggestion.publish", suggestion_id, body, request, key)


@router.post(
    "/admin/community/suggestions/{suggestion_id}/reject", response_model=CommunityCommandResponse
)
def reject(
    suggestion_id: int, body: Reason, request: Request, key: Key
) -> CommunityCommandResponse:
    return mutate("suggestion.reject", suggestion_id, body, request, key)
