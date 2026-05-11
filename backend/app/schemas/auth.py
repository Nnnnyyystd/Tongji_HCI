from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=32, pattern=r"^[a-zA-Z0-9_\u4e00-\u9fff]+$")
    password: str = Field(min_length=6, max_length=64)
    display_name: str | None = Field(default=None, max_length=40)


class UserLogin(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    id: int
    username: str
    display_name: str

    model_config = {"from_attributes": True}


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
