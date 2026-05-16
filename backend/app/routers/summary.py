from fastapi import APIRouter

from backend.app.deps import CurrentUser, DbSession
from backend.app.schemas.response import ApiResponse, ok
from backend.app.schemas.stats import TodaySummaryOut
from backend.app.services import summary_agent


router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/today-summary", response_model=ApiResponse[TodaySummaryOut])
def get_today_summary(db: DbSession, current_user: CurrentUser):
    data = summary_agent.build_today_summary(db, current_user.id)
    return ok(message="today summary", data=TodaySummaryOut.model_validate(data))
