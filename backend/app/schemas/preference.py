from pydantic import BaseModel, Field


class PreferenceRead(BaseModel):
    goal: str
    taste: str
    reminder_time: str
    avoid_foods: str

    model_config = {"from_attributes": True}


class PreferenceUpdate(BaseModel):
    goal: str | None = Field(default=None, max_length=80)
    taste: str | None = Field(default=None, max_length=120)
    reminder_time: str | None = Field(default=None, max_length=8)
    avoid_foods: str | None = None
