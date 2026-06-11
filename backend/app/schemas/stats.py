from pydantic import BaseModel


class TopFoodStat(BaseModel):
    name: str
    count: int


class WeekStatsOut(BaseModel):
    days: list[str]
    dates: list[str]
    meal_counts: list[int]
    average_scores: list[int | None]
    top_foods: list[TopFoodStat]
    total_meals: int
    recorded_days: int


class TodaySummaryOut(BaseModel):
    date: str
    meal_count: int
    average_score: int | None
    summary: str
    suggestion: str
    highlights: list[str]
