"""Private saves, exchange coordination, scoped issue review and personal totals."""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import Connection, text

from app.core.errors import DomainError
from app.identity.models import Input
from app.routes.identity import context
from app.workflows.models import Listing, ListingsResponse, Meta
from app.workflows.service import LISTING_COLUMNS, clock, require

router = APIRouter(tags=["Community experience"])
Key = Annotated[
    str,
    Header(alias="Idempotency-Key", min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$"),
]
Cursor = Annotated[int, Query(ge=0)]
Category = Literal["FoodSafety", "NoShow", "MisleadingListing", "AbusiveMessage", "Other"]
Status = Literal["Open", "Reviewing", "Resolved", "Dismissed"]


class CommandData(BaseModel):
    id: int


class CommandResponse(BaseModel):
    data: CommandData


class MessageInput(Input):
    body: str = Field(min_length=1, max_length=1000)


class IssueInput(Input):
    category: Category
    detail: str = Field(min_length=3, max_length=1000)
    claim_id: int | None = Field(default=None, gt=0)
    message_id: int | None = Field(default=None, gt=0)


class ReviewInput(Input):
    status: Literal["Reviewing", "Resolved", "Dismissed"]
    note: str = Field(min_length=3, max_length=500)


class Message(BaseModel):
    message_id: int
    sender_id: int
    body: str
    created_at: datetime


class MessagesResponse(BaseModel):
    data: list[Message]
    meta: Meta
    can_send: bool


class Evidence(BaseModel):
    body: str
    created_at: datetime


class Issue(BaseModel):
    issue_id: int
    reporter_id: int
    zone_id: int
    listing_id: int
    claim_id: int | None
    message_id: int | None
    category: Category
    detail: str
    status: Status
    created_at: datetime
    reviewed_at: datetime | None
    review_note: str | None
    evidence: Evidence | None = None


class IssuesResponse(BaseModel):
    data: list[Issue]
    meta: Meta


class Impact(BaseModel):
    picked_up_kg: str
    delivered_kg: str
    delivered_exchanges: int
    donated_kg: str
    received_kg: str
    transported_kg: str
    estimated_meals: int
    includes_demo_data: bool
    period_start: datetime
    period_end: datetime


class ImpactResponse(BaseModel):
    data: Impact
    meta: Meta


def command(c: Connection, operation: str, target: int, body: Input, key: str) -> CommandResponse:
    result = c.execute(
        text("SELECT dbthon_experience_command(:op,:target,CAST(:body AS jsonb),:key)"),
        {
            "op": operation,
            "target": target,
            "body": body.model_dump_json(exclude_unset=True),
            "key": key,
        },
    ).scalar_one()
    return CommandResponse.model_validate(result)


@router.get("/saved-listings", response_model=ListingsResponse)
def saved(request: Request, cursor: Cursor = 0) -> ListingsResponse:
    with context(request) as c:
        actor = require(c)
        now = clock(c)
        rows = (
            c.execute(
                text(f"""SELECT {LISTING_COLUMNS} FROM saved_listings s
          JOIN food_listings l USING(listing_id) LEFT JOIN users u ON u.user_id=l.donor_id
          WHERE s.user_id=:actor AND l.zone_id=dbthon_actor_zone() AND l.listing_id>:cursor
          AND l.status IN('Available','Claimed') AND l.expiry_window_end>:now
          ORDER BY l.listing_id LIMIT 21"""),
                {"actor": actor, "cursor": cursor, "now": now},
            )
            .mappings()
            .all()
        )
        return ListingsResponse(
            data=[Listing.model_validate(r) for r in rows[:20]],
            meta=Meta(
                server_time=now, next_cursor=rows[19]["listing_id"] if len(rows) > 20 else None
            ),
        )


@router.post("/listings/{listing_id}/save", response_model=CommandResponse)
def save(listing_id: int, body: Input, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return command(c, "bookmark.save", listing_id, body, key)


@router.post("/listings/{listing_id}/unsave", response_model=CommandResponse)
def unsave(listing_id: int, body: Input, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return command(c, "bookmark.remove", listing_id, body, key)


@router.get("/claims/{claim_id}/messages", response_model=MessagesResponse)
def messages(claim_id: int, request: Request, cursor: Cursor = 0) -> MessagesResponse:
    with context(request) as c:
        require(c)
        if not c.execute(
            text("SELECT dbthon_chat_participant(:id)"), {"id": claim_id}
        ).scalar_one():
            raise DomainError("NOT_FOUND", 404, "This conversation is unavailable.")
        rows = (
            c.execute(
                text("""SELECT message_id,sender_id,body,created_at FROM exchange_messages
            WHERE claim_id=:id AND message_id>:cursor ORDER BY message_id LIMIT 51"""),
                {"id": claim_id, "cursor": cursor},
            )
            .mappings()
            .all()
        )
        can_send = c.execute(
            text("""SELECT c.status='Confirmed' AND l.status IN('Claimed','PickedUp')
            AND l.expiry_window_end>clock_timestamp()
            FROM claims c JOIN food_listings l USING(listing_id)
            WHERE c.claim_id=:id"""),
            {"id": claim_id},
        ).scalar_one_or_none()
        if can_send is None:
            raise DomainError("NOT_FOUND", 404, "This conversation is unavailable.")
        return MessagesResponse(
            data=[Message.model_validate(r) for r in rows[:50]],
            can_send=can_send,
            meta=Meta(
                server_time=clock(c), next_cursor=rows[49]["message_id"] if len(rows) > 50 else None
            ),
        )


@router.post("/claims/{claim_id}/messages", response_model=CommandResponse)
def send(claim_id: int, body: MessageInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return command(c, "message.send", claim_id, body, key)


@router.post("/listings/{listing_id}/issues", response_model=CommandResponse)
def report(listing_id: int, body: IssueInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return command(c, "issue.open", listing_id, body, key)


ISSUE_COLUMNS = """i.issue_id,i.reporter_id,i.zone_id,i.listing_id,i.claim_id,i.message_id,
 i.category,i.detail,i.status,i.created_at,i.reviewed_at,i.review_note,
 dbthon_reported_message(i.issue_id) AS evidence"""


def issue_rows(request: Request, cursor: int, admin: bool, status: str | None) -> IssuesResponse:
    with context(request) as c:
        actor = require(c, "Admin" if admin else None)
        # RLS is a backstop; explicitly distinguish my reports from admin review.
        scope = (
            "dbthon_zone_admin(i.zone_id)"
            if admin
            else "i.reporter_id=:actor AND i.zone_id=dbthon_actor_zone()"
        )
        rows = (
            c.execute(
                text(f"""SELECT {ISSUE_COLUMNS} FROM community_issues i WHERE {scope}
            AND i.issue_id>:cursor AND (CAST(:status AS text) IS NULL OR i.status=:status)
            ORDER BY i.issue_id LIMIT 21"""),
                {"actor": actor, "cursor": cursor, "status": status},
            )
            .mappings()
            .all()
        )
        return IssuesResponse(
            data=[Issue.model_validate(r) for r in rows[:20]],
            meta=Meta(
                server_time=clock(c), next_cursor=rows[19]["issue_id"] if len(rows) > 20 else None
            ),
        )


@router.get("/issues/mine", response_model=IssuesResponse)
def my_issues(request: Request, cursor: Cursor = 0) -> IssuesResponse:
    return issue_rows(request, cursor, False, None)


@router.get("/admin/issues", response_model=IssuesResponse)
def admin_issues(
    request: Request, cursor: Cursor = 0, status: Status | None = None
) -> IssuesResponse:
    return issue_rows(request, cursor, True, status)


@router.post("/admin/issues/{issue_id}/review", response_model=CommandResponse)
def review(issue_id: int, body: ReviewInput, request: Request, key: Key) -> CommandResponse:
    with context(request, write=True) as c:
        return command(c, "issue.review", issue_id, body, key)


@router.get("/impact/mine", response_model=ImpactResponse)
def my_impact(request: Request, days: Annotated[int, Query(ge=30, le=365)] = 30) -> ImpactResponse:
    if days not in (30, 90, 365):
        raise DomainError("INVALID_INPUT", 422, "Choose 30, 90 or 365 days.")
    with context(request) as c:
        require(c)
        now = clock(c)
        result = c.execute(
            text("SELECT dbthon_personal_impact(:begins,:ends)"),
            {"begins": now - timedelta(days=days), "ends": now},
        ).scalar_one()
        return ImpactResponse(data=Impact.model_validate(result), meta=Meta(server_time=now))
