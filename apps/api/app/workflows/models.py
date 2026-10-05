from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Self

from pydantic import AwareDatetime, Field, model_validator

from app.identity.models import Input

Category = Literal["Veg", "NonVeg"]
ListingStatus = Literal["Available", "Claimed", "PickedUp", "Delivered", "Expired", "Cancelled"]
ClaimStatus = Literal["Confirmed", "Cancelled", "Expired", "Completed"]
PickupStatus = Literal["Scheduled", "PickedUp", "Delivered", "Missed", "Cancelled", "Failed"]


class OverviewItem(Input):
    kind: Literal["exchange", "delivery"]
    claim_id: int
    pickup_id: int | None = None
    food_type: str
    status: str
    expiry_window_end: datetime
    scheduled_time: datetime | None = None


class OverviewData(Input):
    capabilities: list[str]
    unread_count: int
    summaries: dict[str, int]
    upcoming: list[OverviewItem]
    updates: list["Notification"]


class OverviewResponse(Input):
    data: OverviewData
    meta: "Meta"


class ListingInput(Input):
    food_type: str = Field(min_length=1, max_length=80)
    category: Category
    quantity_kg: Decimal = Field(gt=0, max_digits=8, decimal_places=2)
    prepared_at: AwareDatetime
    expiry_window_start: AwareDatetime
    expiry_window_end: AwareDatetime
    pickup_lat: Decimal = Field(ge=-90, le=90, decimal_places=6)
    pickup_long: Decimal = Field(ge=-180, le=180, decimal_places=6)

    @model_validator(mode="after")
    def ordering(self) -> Self:
        if (
            not self.food_type.strip()
            or not self.prepared_at <= self.expiry_window_start < self.expiry_window_end
        ):
            raise ValueError("Food name and ordered collection times are required")
        return self


class ListingPatch(Input):
    food_type: str | None = Field(default=None, min_length=1, max_length=80)
    category: Category | None = None
    quantity_kg: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    prepared_at: AwareDatetime | None = None
    expiry_window_start: AwareDatetime | None = None
    expiry_window_end: AwareDatetime | None = None
    pickup_lat: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    pickup_long: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)

    @model_validator(mode="after")
    def supplied(self) -> Self:
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Provide non-null listing changes")
        return self


class Empty(Input):
    pass


class Reason(Input):
    reason: str = Field(min_length=3, max_length=300)


class PickupInput(Input):
    scheduled_time: AwareDatetime


class RatingInput(Input):
    target_user_id: int = Field(gt=0)
    score: int = Field(ge=1, le=5)
    comments: str | None = Field(default=None, max_length=300)


class Listing(Input):
    listing_id: int
    donor_id: int
    donor_name: str
    zone_id: int
    food_type: str
    category: Category
    quantity_kg: str
    prepared_at: datetime
    expiry_window_start: datetime
    expiry_window_end: datetime
    pickup_lat: str
    pickup_long: str
    status: ListingStatus
    created_at: datetime
    updated_at: datetime
    seconds_remaining: int
    approaching_expiry: bool
    distance_m: float | None = None


class Meta(Input):
    server_time: datetime
    next_cursor: str | int | None = None


class ListingResponse(Input):
    data: Listing
    meta: Meta


class ListingsResponse(Input):
    data: list[Listing]
    meta: Meta


class CommandData(Input):
    listing_id: int | None = None
    claim_id: int | None = None
    pickup_id: int | None = None
    rating_id: int | None = None
    notification_id: int | None = None
    status: str | None = None
    read: bool | None = None


class CommandResponse(Input):
    data: CommandData


class Exchange(Input):
    claim_id: int
    listing_id: int
    status: ClaimStatus
    claimed_at: datetime
    ended_at: datetime | None
    cancellation_reason: str | None
    food_type: str
    category: Category
    quantity_kg: str
    expiry_window_end: datetime
    pickup_lat: str
    pickup_long: str
    donor_id: int
    donor_name: str
    donor_phone: str | None
    receiver_id: int
    receiver_name: str
    receiver_phone: str | None
    receiver_latitude: str | None
    receiver_longitude: str | None
    pickup_id: int | None
    volunteer_id: int | None
    volunteer_name: str | None
    pickup_status: PickupStatus | None
    scheduled_time: datetime | None
    actual_pickup_time: datetime | None
    delivery_time: datetime | None
    my_rating: int | None


class ExchangesResponse(Input):
    data: list[Exchange]
    meta: Meta


class ExchangeResponse(Input):
    data: Exchange
    meta: Meta


class Task(Input):
    claim_id: int
    listing_id: int
    food_type: str
    quantity_kg: str
    expiry_window_end: datetime
    donor_name: str
    pickup_lat: str
    pickup_long: str
    distance_m: float


class TasksResponse(Input):
    data: list[Task]
    meta: Meta


class Notification(Input):
    notification_id: int
    message: str
    type: str
    created_at: datetime
    sent_at: datetime
    read_at: datetime | None


class NotificationsResponse(Input):
    data: list[Notification]
    meta: Meta


class Trust(Input):
    user_id: int
    name: str
    rating_count: int
    average_score: str | None


class TrustResponse(Input):
    data: Trust


class LedgerEntry(Input):
    ledger_id: int
    user_id: int
    sequence: int
    action_type: str
    ref_table: str
    ref_id: int
    claim_id: int | None
    occurred_at: datetime
    payload: dict[str, Any]
    payload_version: int
    prev_hash: str
    curr_hash: str


class LedgerResponse(Input):
    data: list[LedgerEntry]
    meta: Meta


class ImpactRow(Input):
    period: str
    zone_id: int
    zone_name: str
    city: str
    listings_created: int
    confirmed_claims: int
    cancelled_claims: int
    completed_claims: int
    picked_up_kg: str
    delivered_kg: str
    estimated_meals: str
    estimated_co2e_kg: None = None
    active_donors: int
    active_receivers: int
    active_volunteers: int
    claim_latency_seconds: float | None
    claim_latency_count: int


class Factors(Input):
    meal_weight_kg: str = "0.4"
    meal_source: str = "Project estimate; not observed meals served"
    emissions_factor_kg_per_kg: None = None
    emissions_source: str = "No supported emissions factor configured"
    timezone: str = "UTC"


class ImpactResponse(Input):
    data: list[ImpactRow]
    factors: Factors = Field(default_factory=Factors)
    meta: Meta
