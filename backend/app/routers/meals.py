from datetime import date as date_type
from datetime import timedelta
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi import Form as FormField

from backend.app.core.config import UPLOAD_DIR
from backend.app.deps import CurrentUser, DbSession
from backend.app.schemas.meal import AiSummaryOut, AnalyzeResult, MealCreate, MealOut, MealUpdate, WeekDayStat
from backend.app.schemas.response import ApiResponse, ok
from backend.app.services import deepseek as deepseek_service
from backend.app.services import meal as meal_service


router = APIRouter(prefix="/meals", tags=["meals"])

_IMAGE_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024


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
        image_mime = image.content_type if image else None
        result = await deepseek_service.analyze_meal(image_bytes, text, image_mime)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except deepseek_service.AiServiceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return ok(data=result)


@router.post("/photo", response_model=ApiResponse[dict[str, str]])
async def upload_meal_photo(
    current_user: CurrentUser,
    image: Annotated[UploadFile, File()],
):
    content_type = image.content_type or ""
    if content_type not in _IMAGE_SUFFIXES:
        raise HTTPException(status_code=400, detail="请上传 JPG、PNG、WEBP 或 GIF 图片")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="图片不能为空")
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="图片不能超过 5MB")

    meal_upload_dir = UPLOAD_DIR / "meals"
    meal_upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{current_user.id}-{uuid4().hex}{_IMAGE_SUFFIXES[content_type]}"
    (meal_upload_dir / filename).write_bytes(image_bytes)
    return ok(data={"image_url": f"/uploads/meals/{filename}"})


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
    try:
        summary_text = await deepseek_service.summarize_week(all_meals)
    except deepseek_service.AiServiceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    record = meal_service.save_summary(db, current_user.id, summary_text)
    return ok(data=AiSummaryOut(summary=record.content, created_at=record.created_at))


@router.post("", response_model=ApiResponse[MealOut])
def add_meal(body: MealCreate, db: DbSession, current_user: CurrentUser):
    meal = meal_service.create_meal(db, current_user.id, body)
    return ok(data=MealOut.model_validate(meal))


@router.get("/{meal_id}", response_model=ApiResponse[MealOut])
def get_meal(meal_id: int, db: DbSession, current_user: CurrentUser):
    meal = meal_service.get_meal_by_id(db, current_user.id, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Not found")
    return ok(data=MealOut.model_validate(meal))


@router.put("/{meal_id}", response_model=ApiResponse[MealOut])
def edit_meal(meal_id: int, body: MealUpdate, db: DbSession, current_user: CurrentUser):
    meal = meal_service.update_meal(db, current_user.id, meal_id, body)
    if not meal:
        raise HTTPException(status_code=404, detail="Not found")
    return ok(data=MealOut.model_validate(meal))


@router.delete("/{meal_id}", response_model=ApiResponse[None])
def remove_meal(meal_id: int, db: DbSession, current_user: CurrentUser):
    if not meal_service.delete_meal(db, current_user.id, meal_id):
        raise HTTPException(status_code=404, detail="Not found")
    return ok()
