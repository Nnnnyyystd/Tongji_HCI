import base64
import json

import httpx

from backend.app.core.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, QWEN_API_KEY, QWEN_BASE_URL

_MEAL_LABELS = {"breakfast": "早餐", "lunch": "午餐", "dinner": "晚餐", "snack": "零食"}

_SCORE_SYSTEM = (
    "你是专业营养师，负责分析餐食营养情况。"
    "请从三个维度评分（共100分）："
    "①食材多样性（35分）：蔬菜、蛋白质、主食等种类是否丰富；"
    "②营养均衡性（35分）：各类营养素搭配是否合理；"
    "③烹饪健康度（30分）：是否以蒸煮炒为主，少油炸少加工食品。"
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


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


async def analyze_meal(image_bytes: bytes | None, text: str | None) -> dict:
    if not image_bytes and not text:
        raise ValueError("请提供照片或文字描述")

    user_content: list = []

    if image_bytes:
        b64 = base64.b64encode(image_bytes).decode()
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
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
        resp = await client.post(
            f"{QWEN_BASE_URL}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {QWEN_API_KEY}"},
        )
        resp.raise_for_status()

    return _parse_json(resp.json()["choices"][0]["message"]["content"])


async def summarize_week(meals: list[dict]) -> str:
    if not meals:
        return "本周暂无饮食记录，快去记录一餐吧！"

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
        resp = await client.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            json=payload,
            headers=_headers(),
        )
        resp.raise_for_status()

    return resp.json()["choices"][0]["message"]["content"].strip()
