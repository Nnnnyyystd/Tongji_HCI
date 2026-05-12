from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import API_PREFIX, APP_NAME, FRONTEND_ORIGINS
from backend.app.db.init_db import init_db
from backend.app.routers import auth, health, meals, preferences


def create_app() -> FastAPI:
    init_db()

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

    return app


app = create_app()
