from fastapi import APIRouter

from backend.app.schemas.response import ApiResponse, ok


router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=ApiResponse[dict[str, str]])
def health_check() -> ApiResponse[dict[str, str]]:
    return ok(
        message="FoodMate backend is running",
        data={
            "service": "foodmate-api",
            "status": "ok",
        },
    )
