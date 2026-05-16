from collections import Counter
from datetime import date
import re

from sqlalchemy.orm import Session

from backend.app.models.meal import Meal


_MEAL_LABELS = {
    "breakfast": "早餐",
    "lunch": "午餐",
    "dinner": "晚餐",
    "snack": "零食",
}

_FOOD_SPLIT_RE = re.compile(r"[，,、。；;和与+＋/\\\s]+")
_FOOD_CATEGORIES = {
    "主食/碳水": [
        "米饭",
        "饭",
        "面",
        "面条",
        "馒头",
        "包子",
        "粥",
        "粉",
        "饼",
        "土豆",
        "红薯",
        "玉米",
        "蛋糕",
        "面包",
    ],
    "蛋白质": [
        "鸡",
        "牛",
        "猪",
        "羊",
        "鱼",
        "虾",
        "蟹",
        "蛋",
        "豆腐",
        "豆浆",
        "牛奶",
        "酸奶",
        "肉",
        "排骨",
    ],
    "蔬菜水果": [
        "菜",
        "青菜",
        "白菜",
        "生菜",
        "菠菜",
        "西兰花",
        "番茄",
        "黄瓜",
        "胡萝卜",
        "苹果",
        "香蕉",
        "橙",
        "水果",
    ],
    "油脂/甜食": [
        "炸",
        "油",
        "奶茶",
        "甜",
        "糖",
        "薯条",
        "汉堡",
        "披萨",
        "可乐",
        "蛋糕",
        "饼干",
    ],
}


def build_today_summary(db: Session, user_id: int) -> dict:
    today = date.today().strftime("%Y-%m-%d")
    meals = (
        db.query(Meal)
        .filter(Meal.user_id == user_id, Meal.date == today)
        .order_by(Meal.created_at)
        .all()
    )

    scores = [meal.score for meal in meals if meal.score is not None]
    average_score = round(sum(scores) / len(scores)) if scores else None
    meal_count = len(meals)

    if not meals:
        return {
            "date": today,
            "meal_count": 0,
            "average_score": None,
            "summary": "今天还没有饮食记录，可以先用一句话记下最近吃过的一餐。",
            "suggestion": "从最容易的一餐开始记录就很好，不需要一次写得很完整。",
            "highlights": [],
        }

    foods = _extract_food_names(meals)
    category_counts = _count_categories(foods)
    meal_lines = _format_meal_lines(meals)
    structure = _format_structure(category_counts)

    summary = (
        f"今天已记录 {meal_count} 餐：{meal_lines}。"
        f"从记录看，饮食结构大致是：{structure}。"
    )
    if average_score is not None:
        summary += f" 当前有 {len(scores)} 条记录包含 AI 评分，平均约 {average_score} 分。"

    suggestion = _build_suggestion(meals, category_counts, average_score)
    highlights = _build_highlights(meals, category_counts, average_score)

    return {
        "date": today,
        "meal_count": meal_count,
        "average_score": average_score,
        "summary": summary,
        "suggestion": suggestion,
        "highlights": highlights,
    }


def _extract_food_names(meals: list[Meal]) -> list[str]:
    foods: list[str] = []
    for meal in meals:
        for raw_part in _FOOD_SPLIT_RE.split(meal.content or ""):
            name = raw_part.strip("：:（）()【】[]“”\"' ")
            name = re.sub(r"^(吃了|喝了|有|点了|记录|大概|约)", "", name)
            name = re.sub(r"(一碗|一杯|一盘|一份|一个|两个|半个|少许|很多|一点)$", "", name)
            if len(name) >= 2:
                foods.append(name[:20])
    return foods


def _count_categories(foods: list[str]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for food in foods:
        matched = False
        for category, keywords in _FOOD_CATEGORIES.items():
            if any(keyword in food for keyword in keywords):
                counts[category] += 1
                matched = True
        if not matched:
            counts["其他"] += 1
    return counts


def _format_meal_lines(meals: list[Meal]) -> str:
    lines = []
    for meal in meals:
        label = _MEAL_LABELS.get(meal.meal_type, meal.meal_type)
        lines.append(f"{label}吃了{meal.content}")
    return "；".join(lines)


def _format_structure(category_counts: Counter[str]) -> str:
    if not category_counts:
        return "食物种类还不够明确"

    total = sum(category_counts.values())
    parts = []
    for category in ["主食/碳水", "蛋白质", "蔬菜水果", "油脂/甜食", "其他"]:
        count = category_counts.get(category, 0)
        if count:
            parts.append(f"{category}约占 {round(count / total * 100)}%")
    return "，".join(parts)


def _build_suggestion(
    meals: list[Meal],
    category_counts: Counter[str],
    average_score: int | None,
) -> str:
    meal_types = {meal.meal_type for meal in meals}
    suggestions: list[str] = []

    if category_counts.get("蔬菜水果", 0) < max(1, category_counts.get("主食/碳水", 0) // 2):
        suggestions.append("蔬菜水果偏少，下一餐可以加一份绿叶菜、番茄黄瓜或一个水果。")
    if category_counts.get("蛋白质", 0) == 0:
        suggestions.append("蛋白质来源不太明显，可以补一点鸡蛋、鱼虾、豆腐、牛奶或瘦肉。")
    if category_counts.get("油脂/甜食", 0) >= 2:
        suggestions.append("油脂或甜食出现较多，后面一餐可以选蒸煮、清炒或少糖饮品来平衡。")
    if len(meal_types) < 3:
        suggestions.append("今天餐次记录还不完整，补记缺少的一餐会让总结更准确。")
    if average_score is not None and average_score < 70:
        suggestions.append(_build_score_direction(category_counts))

    if not suggestions:
        suggestions.append("今天结构比较均衡，可以继续保持主食、蛋白质和蔬菜都有出现的搭配。")
        suggestions.append("明天可以留意饮水和晚餐清淡度，让记录更完整。")

    return " ".join(suggestions[:3])


def _build_score_direction(category_counts: Counter[str]) -> str:
    if category_counts.get("油脂/甜食", 0) > 0:
        return "今天整体评分还有提升空间，优先方向是把油炸、甜饮或高油菜式换成清蒸、炖煮、少油炒的版本。"
    if category_counts.get("蔬菜水果", 0) <= category_counts.get("蛋白质", 0):
        return "今天整体评分还有提升空间，优先方向是把蔬菜水果比例往上提，让每餐旁边多一份绿叶菜或水果。"
    if category_counts.get("主食/碳水", 0) == 0:
        return "今天整体评分还有提升空间，优先方向是补一点稳定主食，比如米饭、杂粮、玉米或红薯。"
    return "今天整体评分还有提升空间，优先方向是让下一餐更清淡、更完整：主食、蛋白质和蔬菜都保留一点。"


def _build_highlights(
    meals: list[Meal],
    category_counts: Counter[str],
    average_score: int | None,
) -> list[str]:
    highlights = [f"已覆盖 {len({meal.meal_type for meal in meals})} 类餐次"]
    if category_counts.get("主食/碳水"):
        highlights.append("有主食/碳水来源")
    if category_counts.get("蛋白质"):
        highlights.append("有蛋白质来源")
    if category_counts.get("蔬菜水果"):
        highlights.append("有蔬菜水果")

    scored_count = sum(1 for meal in meals if meal.score is not None)
    if scored_count:
        highlights.append(f"{scored_count} 条记录包含 AI 评分")
    if average_score is not None and average_score >= 80:
        highlights.append("今日整体评分较稳定")
    return highlights[:5]
