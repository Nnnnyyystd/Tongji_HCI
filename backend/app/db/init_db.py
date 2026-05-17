from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app import models  # noqa: F401
from sqlalchemy import text


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_meal_image_column()
    _ensure_user_avatar_column()


def _ensure_meal_image_column() -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(meals)")).mappings().all()
        column_names = {column["name"] for column in columns}
        if "image_url" not in column_names:
            connection.execute(text("ALTER TABLE meals ADD COLUMN image_url VARCHAR(500)"))


def _ensure_user_avatar_column() -> None:
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(users)")).mappings().all()
        column_names = {column["name"] for column in columns}
        if "avatar_url" not in column_names:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
