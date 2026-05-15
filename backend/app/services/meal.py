from datetime import date, timedelta

from sqlalchemy.orm import Session

from backend.app.models.ai_summary import AiSummary
from backend.app.models.meal import Meal
from backend.app.schemas.meal import MealCreate, MealUpdate


def get_meals_by_date(db: Session, user_id: int, date: str) -> list[Meal]:
    return (
        db.query(Meal)
        .filter(Meal.user_id == user_id, Meal.date == date)
        .order_by(Meal.created_at)
        .all()
    )


def get_recorded_days(db: Session, user_id: int, year: int, month: int) -> list[int]:
    prefix = f"{year:04d}-{month:02d}-"
    rows = (
        db.query(Meal.date)
        .filter(Meal.user_id == user_id, Meal.date.like(f"{prefix}%"))
        .distinct()
        .all()
    )
    return sorted(int(row.date[8:10]) for row in rows)


def create_meal(db: Session, user_id: int, data: MealCreate) -> Meal:
    meal = Meal(user_id=user_id, **data.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


def get_meal_by_id(db: Session, user_id: int, meal_id: int) -> Meal | None:
    return (
        db.query(Meal)
        .filter(Meal.id == meal_id, Meal.user_id == user_id)
        .first()
    )


def update_meal(db: Session, user_id: int, meal_id: int, data: MealUpdate) -> Meal | None:
    meal = get_meal_by_id(db, user_id, meal_id)
    if not meal:
        return None

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(meal, field, value)

    db.commit()
    db.refresh(meal)
    return meal


def get_week_stats(db: Session, user_id: int) -> list[dict]:
    today = date.today()
    day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    stats = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        meals = get_meals_by_date(db, user_id, date_str)
        scored = [m for m in meals if m.score is not None]
        avg = round(sum(m.score for m in scored) / len(scored)) if scored else None
        stats.append(
            {
                "date": date_str,
                "day_label": day_names[d.weekday()],
                "count": len(meals),
                "avg_score": avg,
            }
        )
    return stats


def get_latest_summary(db: Session, user_id: int) -> AiSummary | None:
    return (
        db.query(AiSummary)
        .filter(AiSummary.user_id == user_id)
        .order_by(AiSummary.created_at.desc())
        .first()
    )


def save_summary(db: Session, user_id: int, content: str) -> AiSummary:
    record = AiSummary(user_id=user_id, content=content)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def delete_meal(db: Session, user_id: int, meal_id: int) -> bool:
    meal = get_meal_by_id(db, user_id, meal_id)
    if not meal:
        return False
    db.delete(meal)
    db.commit()
    return True
