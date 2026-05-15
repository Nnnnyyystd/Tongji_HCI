import json

import pytest

from backend.app.services.deepseek import AiServiceError, _normalize_analysis, _parse_json


def test_parse_json_extracts_fenced_json() -> None:
    raw = json.dumps(
        {
            "identified": "米饭、鸡蛋",
            "score": 80,
            "variety": 25,
            "balance": 25,
            "cooking": 30,
            "comment": "搭配不错",
        },
        ensure_ascii=False,
    )

    assert _parse_json(f"```json\n{raw}\n```")["identified"] == "米饭、鸡蛋"


def test_normalize_analysis_clamps_scores_and_recomputes_total() -> None:
    result = _normalize_analysis(
        {
            "identified": "米饭、鸡蛋",
            "score": 99,
            "variety": 40,
            "balance": 20,
            "cooking": 30,
            "comment": "还可以",
        }
    )

    assert 0 <= result["variety"] <= 35
    assert result["score"] == result["variety"] + result["balance"] + result["cooking"]
    assert result["score"] % 5 != 0


def test_normalize_analysis_keeps_specific_scores() -> None:
    result = _normalize_analysis(
        {
            "identified": "米饭、鸡蛋、青菜",
            "score": 67,
            "variety": 26,
            "balance": 22,
            "cooking": 19,
            "comment": "搭配较清爽",
        }
    )

    assert result["score"] == 67
    assert result["variety"] == 26


def test_parse_json_rejects_invalid_content() -> None:
    with pytest.raises(AiServiceError):
        _parse_json("今天吃得还不错")
