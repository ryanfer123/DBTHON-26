from decimal import Decimal
from typing import Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    field_validator,
    model_validator,
)

PublicRole = Literal["Donor", "Receiver", "Volunteer"]
Role = Literal["Donor", "Receiver", "Volunteer", "Admin"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(Input):
    email: str = Field(max_length=100, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: SecretStr = Field(min_length=12, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class Registration(Login):
    email: EmailStr = Field(max_length=100)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$")
    zone_id: int = Field(gt=0)
    roles: list[PublicRole] = Field(min_length=1, max_length=3)
    latitude: Decimal = Field(ge=-90, le=90, decimal_places=6)
    longitude: Decimal = Field(ge=-180, le=180, decimal_places=6)
    capacity_kg: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A name is required")
        return value.strip()

    @model_validator(mode="after")
    def receiver_capacity(self) -> Self:
        if len(set(self.roles)) != len(self.roles):
            raise ValueError("Roles must be unique")
        if ("Receiver" in self.roles) != (self.capacity_kg is not None):
            raise ValueError("Capacity is required only for receivers")
        return self


class ProfileUpdate(Input):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^\+[1-9][0-9]{7,14}$")
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    capacity_kg: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)

    @model_validator(mode="after")
    def nonempty_fields(self) -> Self:
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Supply at least one non-null profile field")
        if self.name is not None:
            self.name = Registration.normalize_name(self.name)
        return self


class Verification(Input):
    roles: list[PublicRole] = Field(max_length=3)
    verified: bool
    reason: str = Field(min_length=3, max_length=300)

    @model_validator(mode="after")
    def valid_approval(self) -> Self:
        if len(set(self.roles)) != len(self.roles) or (self.verified and not self.roles):
            raise ValueError("Select unique roles to approve")
        if not self.verified and self.roles:
            raise ValueError("Revocation must have an empty approved-role list")
        self.reason = self.reason.strip()
        if len(self.reason) < 3:
            raise ValueError("A review reason is required")
        return self


class ZoneSelection(Input):
    zone_id: int = Field(gt=0)


class NotificationPreferences(Input):
    sms_enabled: bool
    push_enabled: bool


class NotificationPreferencesData(BaseModel):
    sms_enabled: bool
    push_enabled: bool
    sms_configured: bool
    push_configured: bool


class NotificationPreferencesResponse(BaseModel):
    data: NotificationPreferencesData


class AdminGrant(Input):
    reason: str = Field(min_length=3, max_length=300)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("A grant reason is required")
        return value


class RoleData(BaseModel):
    role: Role
    approved: bool


class UserData(BaseModel):
    user_id: int
    zone_id: int
    name: str
    email: str
    phone: str
    latitude: Decimal
    longitude: Decimal
    verified_status: bool
    active: bool
    roles: list[RoleData]
    capabilities: list[Role]
    capacity_kg: str | None
    zone_review_required: bool = False


class UserResponse(BaseModel):
    data: UserData


class SessionData(BaseModel):
    user: UserData
    csrf_token: str


class SessionResponse(BaseModel):
    data: SessionData


class SessionSnapshotResponse(BaseModel):
    data: SessionData | None


class PageMeta(BaseModel):
    next_cursor: int | None


class UsersResponse(BaseModel):
    data: list[UserData]
    meta: PageMeta


class ZoneData(BaseModel):
    zone_id: int
    zone_name: str
    city: str


class ZonesResponse(BaseModel):
    data: list[ZoneData]
    meta: PageMeta
