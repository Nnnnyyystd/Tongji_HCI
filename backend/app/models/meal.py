from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    meal_type: Mapped[str] = mapped_column(String(20))  # breakfast/lunch/dinner/snack
    content: Mapped[str] = mapped_column(Text)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    score_variety: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    score_balance: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    score_cooking: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    score_comment: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
