from fastapi import APIRouter
from pydantic import BaseModel

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
