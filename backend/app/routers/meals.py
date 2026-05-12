from datetime import date as date_type
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi import Form as FormField

from backend.app.deps import CurrentUser, DbSession
from backend.app.schemas.meal import AiSummaryOut, AnalyzeResult, MealCreate, MealOut, WeekDayStat
from backend.app.schemas.response import ApiResponse, ok
from backend.app.services import deepseek as deepseek_service
from backend.app.services import meal as meal_service


router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("", response_model=ApiResponse[list[MealOut]])
def list_meals(date: str, db: DbSession, current_user: CurrentUser):
    meals = meal_service.get_meals_by_date(db, current_user.id, date)
    return ok(data=[MealOut.model_validate(m) for m in meals])


@router.get("/month", response_model=ApiResponse[dict])
def month_days(year: int, month: int, db: DbSession, current_user: CurrentUser):
    days = meal_service.get_recorded_days(db, current_user.id, year, month)
    return ok(data={"days": days})


@router.get("/week-stats", response_model=ApiResponse[list[WeekDayStat]])
def week_stats(db: DbSession, current_user: CurrentUser):
    stats = meal_service.get_week_stats(db, current_user.id)
    return ok(data=stats)


@router.post("/analyze", response_model=ApiResponse[AnalyzeResult])
async def analyze_meal_image(
    current_user: CurrentUser,
    image: Annotated[UploadFile | None, File()] = None,
    text: Annotated[str | None, FormField()] = None,
):
    if not image and not text:
        raise HTTPException(status_code=400, detail="请提供照片或文字描述")
    try:
        image_bytes = await image.read() if image else None
        result = await deepseek_service.analyze_meal(image_bytes, text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ok(data=result)


@router.get("/ai-summary", response_model=ApiResponse[AiSummaryOut | None])
def get_ai_summary(db: DbSession, current_user: CurrentUser):
    record = meal_service.get_latest_summary(db, current_user.id)
    if not record:
        return ok(data=None)
    return ok(data=AiSummaryOut(summary=record.content, created_at=record.created_at))


@router.post("/ai-summary", response_model=ApiResponse[AiSummaryOut])
async def generate_ai_summary(db: DbSession, current_user: CurrentUser):
    today = date_type.today()
    all_meals = []
    for i in range(7):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        meals = meal_service.get_meals_by_date(db, current_user.id, d)
        all_meals.extend(MealOut.model_validate(m).model_dump() for m in meals)
    summary_text = await deepseek_service.summarize_week(all_meals)
    record = meal_service.save_summary(db, current_user.id, summary_text)
    return ok(data=AiSummaryOut(summary=record.content, created_at=record.created_at))


@router.post("", response_model=ApiResponse[MealOut])
def add_meal(body: MealCreate, db: DbSession, current_user: CurrentUser):
    meal = meal_service.create_meal(db, current_user.id, body)
    return ok(data=MealOut.model_validate(meal))


@router.delete("/{meal_id}", response_model=ApiResponse[None])
def remove_meal(meal_id: int, db: DbSession, current_user: CurrentUser):
    if not meal_service.delete_meal(db, current_user.id, meal_id):
        raise HTTPException(status_code=404, detail="Not found")
    return ok()
