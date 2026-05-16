from collections import Counter
from datetime import date, timedelta
import re

from sqlalchemy.orm import Session

from backend.app.models.meal import Meal


DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
_FOOD_SPLIT_RE = re.compile(r"[，,、。；;和与+＋/\\\s]+")
_STOP_WORDS = {
    "",
    "早餐",
    "午餐",
    "晚餐",
    "夜宵",
    "零食",
    "今天",
    "早上",
    "中午",
    "晚上",
    "吃了",
    "喝了",
    "一份",
    "一个",
    "一些",
    "少许",
}


def get_week_stats(db: Session, user_id: int) -> dict:
    today = date.today()
    start = today - timedelta(days=6)
    date_range = [start + timedelta(days=i) for i in range(7)]
    date_strings = [d.strftime("%Y-%m-%d") for d in date_range]

    meals = (
        db.query(Meal)
        .filter(Meal.user_id == user_id, Meal.date >= date_strings[0], Meal.date <= date_strings[-1])
        .order_by(Meal.date, Meal.created_at)
        .all()
    )

    meals_by_date = {date_str: [] for date_str in date_strings}
    for meal in meals:
        meals_by_date.setdefault(meal.date, []).append(meal)

    meal_counts: list[int] = []
    average_scores: list[int | None] = []
    for date_str in date_strings:
        day_meals = meals_by_date.get(date_str, [])
        meal_counts.append(len(day_meals))
        scores = [meal.score for meal in day_meals if meal.score is not None]
        average_scores.append(round(sum(scores) / len(scores)) if scores else None)

    food_counter = Counter()
    for meal in meals:
        food_counter.update(_extract_food_names(meal.content))

    return {
        "days": [DAY_LABELS[d.weekday()] for d in date_range],
        "dates": date_strings,
        "meal_counts": meal_counts,
        "average_scores": average_scores,
        "top_foods": [{"name": name, "count": count} for name, count in food_counter.most_common(5)],
        "total_meals": len(meals),
        "recorded_days": sum(1 for count in meal_counts if count > 0),
    }


def _extract_food_names(content: str) -> list[str]:
    names: list[str] = []
    for raw_part in _FOOD_SPLIT_RE.split(content or ""):
        name = raw_part.strip("：:（）()【】[]“”\"' ")
        name = re.sub(r"^(吃了|喝了|有|点了|记录|大概|约)", "", name)
        name = re.sub(r"(一碗|一杯|一盘|一份|一个|两个|半个|少许|很多|一点)$", "", name)
        if len(name) < 2 or name in _STOP_WORDS:
            continue
        names.append(name[:20])
    return names
