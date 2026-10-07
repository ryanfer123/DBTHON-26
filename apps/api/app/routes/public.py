from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import text

router = APIRouter(tags=["Community"])


class RoleIntroduction(BaseModel):
    id: str
    name: str
    description: str


class CommunityInfo(BaseModel):
    name: str
    roles: list[RoleIntroduction]


class CommunityResponse(BaseModel):
    data: CommunityInfo


@router.get("/community", response_model=CommunityResponse)
def community() -> CommunityResponse:
    """Public introduction, not a listing feed or a simulated transaction."""
    return CommunityResponse(
        data=CommunityInfo(
            name="Second Table",
            roles=[
                RoleIntroduction(
                    id="donor",
                    name="Donors",
                    description="Have food to share? Make it visible to your community, "
                    "with a clear quantity, pickup point, and collection window.",
                ),
                RoleIntroduction(
                    id="receiver",
                    name="Receivers",
                    description="Find nearby surplus that fits your capacity. Claim a listing "
                    "and coordinate collection within its available window.",
                ),
                RoleIntroduction(
                    id="volunteer",
                    name="Volunteers",
                    description="Help close the distance. Collect an accepted donation and "
                    "deliver it to its receiver before the collection window ends.",
                ),
            ],
        )
    )


class PublicImpact(BaseModel):
    delivered_kg: str
    estimated_meals: str
    active_listings: int
    includes_demo_data: bool
    month_start: str
    server_time: str
    meal_weight_kg: str


class PublicImpactResponse(BaseModel):
    data: PublicImpact


@router.get("/public/impact", response_model=PublicImpactResponse)
def public_impact(request: Request) -> PublicImpactResponse:
    with request.app.state.access.transaction("auth") as connection:
        result = connection.execute(text("SELECT dbthon_public_impact()")).scalar_one()
        return PublicImpactResponse(data=PublicImpact.model_validate(result))
