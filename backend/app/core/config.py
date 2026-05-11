from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = PROJECT_ROOT / "backend"
DATA_DIR = BACKEND_DIR / "data"
DATABASE_URL = f"sqlite:///{DATA_DIR / 'foodmate.db'}"

APP_NAME = "FoodMate API"
API_PREFIX = "/api"
ACCESS_TOKEN_EXPIRE_HOURS = 24
FRONTEND_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
