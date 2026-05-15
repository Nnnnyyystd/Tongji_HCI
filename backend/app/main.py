from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import API_PREFIX, APP_NAME, FRONTEND_ORIGINS, UPLOAD_DIR
from backend.app.db.init_db import init_db
from backend.app.routers import auth, health, meals, preferences


def create_app() -> FastAPI:
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title=APP_NAME)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(preferences.router, prefix=API_PREFIX)
    app.include_router(meals.router, prefix=API_PREFIX)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

    return app


app = create_app()
