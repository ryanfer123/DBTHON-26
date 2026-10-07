from datetime import datetime, time
from typing import Annotated

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from app.identity.models import Input
from app.routes.identity import context
from app.workflows.service import require

router = APIRouter(tags=["Recurring donations"])


class ScheduleInput(Input):
    template_listing_id: int = Field(gt=0)
    local_time: time
    time_zone: str = Field(default="Asia/Kolkata", min_length=1, max_length=80)
    enabled: bool = True

    @field_validator("local_time")
    @classmethod
    def local_clock(cls, value: time) -> time:
        if value.tzinfo is not None:
            raise ValueError("Supply a local clock time and separate time zone")
        return value


class ScheduleData(BaseModel):
    schedule_id: int
    template_listing_id: int
    food_type: str
    local_time: time
    time_zone: str
    enabled: bool
    next_due_at: datetime


class SchedulesResponse(BaseModel):
    data: list[ScheduleData]
    next_cursor: int | None


@router.get("/donor-schedules", response_model=SchedulesResponse)
def schedules(request: Request, cursor: Annotated[int, Query(ge=0)] = 0) -> SchedulesResponse:
    with context(request) as c:
        require(c, "Donor")
        rows = (
            c.execute(
                text("""
          SELECT s.schedule_id,s.template_listing_id,l.food_type,s.local_time,s.time_zone,
            s.enabled,s.next_due_at FROM donor_schedules s JOIN food_listings l
            ON l.listing_id=s.template_listing_id WHERE s.schedule_id>:cursor
          ORDER BY s.schedule_id LIMIT 11
        """),
                {"cursor": cursor},
            )
            .mappings()
            .all()
        )
        return SchedulesResponse(
            data=[ScheduleData.model_validate(row) for row in rows[:10]],
            next_cursor=rows[9]["schedule_id"] if len(rows) > 10 else None,
        )


@router.put("/donor-schedules")
def save_schedule(body: ScheduleInput, request: Request) -> dict[str, int]:
    with context(request, write=True) as c:
        sid = c.execute(
            text("SELECT dbthon_save_donor_schedule(:listing,:at,:zone,:enabled)"),
            {
                "listing": body.template_listing_id,
                "at": body.local_time,
                "zone": body.time_zone,
                "enabled": body.enabled,
            },
        ).scalar_one()
        return {"schedule_id": sid}
