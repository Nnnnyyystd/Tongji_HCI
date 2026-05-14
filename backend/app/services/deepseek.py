import base64
import hashlib
import json
import re

import httpx

from backend.app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, QWEN_API_KEY, QWEN_BASE_URL

_MEAL_LABELS = {"breakfast": "早餐", "lunch": "午餐", "dinner": "晚餐", "snack": "零食"}

_SCORE_SYSTEM = (
    "你是专业营养师，负责分析餐食营养情况。"
    "请从三个维度评分（共100分）："
    "①食材多样性（35分）：蔬菜、蛋白质、主食等种类是否丰富；"
    "②营养均衡性（35分）：各类营养素搭配是否合理；"
    "③烹饪健康度（30分）：是否以蒸煮炒为主，少油炸少加工食品。"
    "总分必须等于三个维度分数相加。"
    "评分要使用具体整数，不要总是使用5的倍数或整十档。"
    "请根据食物种类、搭配完整度、烹饪方式做1到4分的细微区分。"
    "仅返回JSON，格式："
    '{"identified":"识别到的食物（顿号分隔）",'
    '"score":总分整数,"variety":食材多样分,"balance":营养均衡分,"cooking":烹饪健康分,'
    '"comment":"一句话评价（15字以内）"}'
)

_SUMMARY_SYSTEM = (
    "你是营养师，请根据用户一周饮食记录给出温和友好的总结。"
    "包含：本周亮点、需改进之处、2条具体建议。"
    "面向大学生，语气轻松，控制在120字以内。"
)

_STAPLE_KEYWORDS = ("米饭", "饭", "面", "粉", "粥", "馒头", "包子", "饼", "土豆", "红薯", "玉米", "燕麦", "面包", "意面")
_PROTEIN_KEYWORDS = ("鸡", "鸭", "鱼", "虾", "牛", "猪", "羊", "肉", "蛋", "豆腐", "豆", "奶", "酸奶")
_VEGETABLE_KEYWORDS = ("菜", "青菜", "白菜", "菠菜", "生菜", "西兰花", "番茄", "西红柿", "黄瓜", "胡萝卜", "菌菇", "蘑菇", "海带")
_FRUIT_KEYWORDS = ("水果", "苹果", "香蕉", "橙", "梨", "葡萄", "草莓", "蓝莓", "猕猴桃")
_HEALTHY_COOKING_KEYWORDS = ("蒸", "煮", "炖", "清炒", "水煮", "凉拌", "沙拉", "少油", "清淡")
_UNHEALTHY_COOKING_KEYWORDS = ("油炸", "炸", "薯条", "汉堡", "奶茶", "可乐", "甜点", "蛋糕", "烧烤", "烤串", "方便面", "辣条", "培根", "香肠")


class AiServiceError(RuntimeError):
    """Raised when an upstream AI service cannot return a usable result."""


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }


def _require_api_key(api_key: str, name: str) -> None:
    if not api_key.strip():
        raise AiServiceError(f"缺少 {name}，请先在 .env 中配置")


def _parse_json(text: str) -> dict:
    text = text.strip()
    if not text:
        raise AiServiceError("AI 没有返回内容")

    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1].strip()
            if text.lower().startswith("json"):
                text = text[4:].strip()

    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and start < end:
            text = text[start:end + 1]

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AiServiceError("AI 返回格式不是有效 JSON，请重试") from exc

    if not isinstance(data, dict):
        raise AiServiceError("AI 返回格式不完整，请重试")
    return data


def _read_message_content(data: dict) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AiServiceError("AI 返回数据缺少结果内容") from exc

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        chunks = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                chunks.append(item["text"])
        if chunks:
            return "\n".join(chunks)

    raise AiServiceError("AI 返回内容格式不支持")


def _clean_text(value: object, fallback: str, limit: int = 100) -> str:
    text = str(value or "").strip()
    if not text:
        text = fallback
    return text[:limit]


def _to_int(value: object, field_name: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        raise AiServiceError(f"AI 返回的{field_name}不是有效数字")

    if isinstance(value, int | float):
        number = round(value)
    else:
        match = re.search(r"-?\d+", str(value or ""))
        if not match:
            raise AiServiceError(f"AI 返回的{field_name}不是有效数字")
        number = int(match.group())

    return max(minimum, min(maximum, int(number)))


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _food_item_count(text: str) -> int:
    items = [item.strip() for item in re.split(r"[、，,；;+\n\s]+|和|及", text) if item.strip()]
    return len(items)


def _nutrition_group_count(text: str) -> int:
    groups = (
        _STAPLE_KEYWORDS,
        _PROTEIN_KEYWORDS,
        _VEGETABLE_KEYWORDS,
        _FRUIT_KEYWORDS,
    )
    return sum(1 for keywords in groups if _contains_any(text, keywords))


def _add_with_bounds(value: int, delta: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value + delta))


def _apply_stable_nudge(values: tuple[int, int, int], text: str) -> tuple[int, int, int]:
    total = sum(values)
    if total % 5 != 0:
        return values

    bounds = ((0, 35), (0, 35), (0, 30))
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    start_index = digest[0] % len(values)
    preferred_amount = (-2, -1, 1, 2)[digest[1] % 4]
    candidate_amounts = (preferred_amount, -preferred_amount, 1, -1, 2, -2, 3, -3)

    for amount in candidate_amounts:
        for offset in range(len(values)):
            index = (start_index + offset) % len(values)
            minimum, maximum = bounds[index]
            adjusted = _add_with_bounds(values[index], amount, minimum, maximum)
            actual_delta = adjusted - values[index]
            if actual_delta and (total + actual_delta) % 5 != 0:
                next_values = list(values)
                next_values[index] = adjusted
                return tuple(next_values)

    return values


def _fine_tune_coarse_components(variety: int, balance: int, cooking: int, identified: str, comment: str) -> tuple[int, int, int]:
    if any(value % 5 != 0 for value in (variety, balance, cooking)):
        return variety, balance, cooking

    text = f"{identified} {comment}"
    item_count = _food_item_count(identified)
    group_count = _nutrition_group_count(text)

    if item_count >= 5:
        variety_delta = 3
    elif item_count >= 4:
        variety_delta = 2
    elif item_count >= 3:
        variety_delta = 1
    elif item_count <= 1:
        variety_delta = -2
    else:
        variety_delta = 0

    if group_count >= 4:
        balance_delta = 3
    elif group_count >= 3:
        balance_delta = 2
    elif group_count == 1:
        balance_delta = -2
    else:
        balance_delta = 0

    has_healthy_cooking = _contains_any(text, _HEALTHY_COOKING_KEYWORDS)
    has_unhealthy_cooking = _contains_any(text, _UNHEALTHY_COOKING_KEYWORDS)
    if has_unhealthy_cooking:
        cooking_delta = -3
    elif has_healthy_cooking:
        cooking_delta = 2
    else:
        cooking_delta = 0

    tuned = (
        _add_with_bounds(variety, variety_delta, 0, 35),
        _add_with_bounds(balance, balance_delta, 0, 35),
        _add_with_bounds(cooking, cooking_delta, 0, 30),
    )
    return _apply_stable_nudge(tuned, text)


def _normalize_analysis(data: dict) -> dict:
    variety = _to_int(data.get("variety"), "食材多样分", 0, 35)
    balance = _to_int(data.get("balance"), "营养均衡分", 0, 35)
    cooking = _to_int(data.get("cooking"), "烹饪健康分", 0, 30)
    identified = _clean_text(data.get("identified"), "未识别到明确食物", 500)
    comment = _clean_text(data.get("comment"), "结果仅供参考，请按实际餐食调整", 100)
    variety, balance, cooking = _fine_tune_coarse_components(variety, balance, cooking, identified, comment)
    score = variety + balance + cooking

    return {
        "identified": identified,
        "score": score,
        "variety": variety,
        "balance": balance,
        "cooking": cooking,
        "comment": comment,
    }


async def analyze_meal(image_bytes: bytes | None, text: str | None, image_mime: str | None = None) -> dict:
    if not image_bytes and not text:
        raise ValueError("请提供照片或文字描述")
    _require_api_key(QWEN_API_KEY, "QWEN_API_KEY")

    user_content: list = []

    if image_bytes:
        b64 = base64.b64encode(image_bytes).decode()
        mime = image_mime if image_mime and image_mime.startswith("image/") else "image/jpeg"
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"},
        })

    user_content.append({
        "type": "text",
        "text": f"用户补充描述：{text}" if text else "请分析图片中的食物",
    })

    payload = {
        "model": "qwen-vl-plus",
        "messages": [
            {"role": "system", "content": _SCORE_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 300,
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{QWEN_BASE_URL}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {QWEN_API_KEY}"},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {401, 403}:
                raise AiServiceError("通义千问 API Key 无效或没有模型权限") from exc
            raise AiServiceError(f"通义千问服务请求失败（HTTP {exc.response.status_code}）") from exc
        except httpx.RequestError as exc:
            raise AiServiceError("通义千问服务连接失败，请稍后重试") from exc

    try:
        response_data = resp.json()
    except json.JSONDecodeError as exc:
        raise AiServiceError("通义千问返回的响应不是 JSON") from exc

    return _normalize_analysis(_parse_json(_read_message_content(response_data)))


async def summarize_week(meals: list[dict]) -> str:
    if not meals:
        return "本周暂无饮食记录，快去记录一餐吧！"
    _require_api_key(DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY")

    lines = []
    for m in meals:
        label = _MEAL_LABELS.get(m["meal_type"], m["meal_type"])
        score_str = f"（{m['score']}分）" if m.get("score") is not None else ""
        lines.append(f"- {m['date']} {label}：{m['content']}{score_str}")

    prompt = "以下是用户一周的饮食记录：\n" + "\n".join(lines)

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": _SUMMARY_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 300,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                json=payload,
                headers=_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {401, 403}:
                raise AiServiceError("DeepSeek API Key 无效或没有模型权限") from exc
            raise AiServiceError(f"DeepSeek 服务请求失败（HTTP {exc.response.status_code}）") from exc
        except httpx.RequestError as exc:
            raise AiServiceError("DeepSeek 服务连接失败，请稍后重试") from exc

    try:
        response_data = resp.json()
    except json.JSONDecodeError as exc:
        raise AiServiceError("DeepSeek 返回的响应不是 JSON") from exc

    return _read_message_content(response_data).strip()
