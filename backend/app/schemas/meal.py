from datetime import datetime

from pydantic import BaseModel, Field


class MealCreate(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    meal_type: str = Field(pattern=r"^(breakfast|lunch|dinner|snack)$")
    content: str = Field(min_length=1, max_length=500)
    score: int | None = Field(default=None, ge=0, le=100)
    score_variety: int | None = Field(default=None, ge=0, le=35)
    score_balance: int | None = Field(default=None, ge=0, le=35)
    score_cooking: int | None = Field(default=None, ge=0, le=30)
    score_comment: str | None = Field(default=None, max_length=100)


class MealOut(BaseModel):
    id: int
    date: str
    meal_type: str
    content: str
    score: int | None
    score_variety: int | None
    score_balance: int | None
    score_cooking: int | None
    score_comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalyzeResult(BaseModel):
    identified: str
    score: int
    variety: int
    balance: int
    cooking: int
    comment: str


class WeekDayStat(BaseModel):
    date: str
    day_label: str
    count: int
    avg_score: int | None


class AiSummaryOut(BaseModel):
    summary: str
    created_at: datetime

    model_config = {"from_attributes": True}
