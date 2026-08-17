import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = PROJECT_ROOT / "backend"
DATA_DIR = BACKEND_DIR / "data"
UPLOAD_DIR = BACKEND_DIR / "uploads"
DATABASE_URL = f"sqlite:///{DATA_DIR / 'foodmate.db'}"

APP_NAME = "FoodMate API"
API_PREFIX = "/api"
ACCESS_TOKEN_EXPIRE_HOURS = 24
DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "sk-lovvvvvvvvvvvvvvvvvvvvc9f6c811c00000000000000000000000000000000000000000000a")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
QWEN_API_KEY: str = os.getenv("QWEN_API_KEY", "sk-kkkkkkkkkkkkkkkkkkk")
QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
FRONTEND_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
