from fastapi import APIRouter

from backend.app.deps import CurrentUser, DbSession
from backend.app.schemas.response import ApiResponse, ok
from backend.app.schemas.stats import WeekStatsOut
from backend.app.services import stats as stats_service


router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/week", response_model=ApiResponse[WeekStatsOut])
def get_week_stats(db: DbSession, current_user: CurrentUser):
    data = stats_service.get_week_stats(db, current_user.id)
    return ok(message="week stats", data=WeekStatsOut.model_validate(data))
