from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.app.core.config import UPLOAD_DIR
from backend.app.deps import CurrentUser, DbSession, get_bearer_token
from backend.app.schemas.auth import TokenRead, UserCreate, UserLogin, UserRead
from backend.app.schemas.response import ApiResponse, ok
from backend.app.services.auth import (
    authenticate_user,
    create_session,
    create_user,
    get_user_by_username,
    revoke_session,
    update_user_avatar,
)


router = APIRouter(prefix="/auth", tags=["auth"])

_AVATAR_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
_MAX_AVATAR_BYTES = 2 * 1024 * 1024


@router.post("/register", response_model=ApiResponse[TokenRead])
def register(user_in: UserCreate, db: DbSession) -> ApiResponse[TokenRead]:
    if get_user_by_username(db, user_in.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    user = create_user(db, user_in)
    session = create_session(db, user)
    return ok(
        message="register success",
        data=TokenRead(access_token=session.token, user=UserRead.model_validate(user)),
    )


@router.post("/login", response_model=ApiResponse[TokenRead])
def login(user_in: UserLogin, db: DbSession) -> ApiResponse[TokenRead]:
    user = authenticate_user(db, user_in.username, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    session = create_session(db, user)
    return ok(
        message="login success",
        data=TokenRead(access_token=session.token, user=UserRead.model_validate(user)),
    )


@router.get("/me", response_model=ApiResponse[UserRead])
def read_me(current_user: CurrentUser) -> ApiResponse[UserRead]:
    return ok(message="current user", data=UserRead.model_validate(current_user))


@router.post("/avatar", response_model=ApiResponse[UserRead])
async def upload_avatar(
    db: DbSession,
    current_user: CurrentUser,
    image: Annotated[UploadFile, File()],
) -> ApiResponse[UserRead]:
    content_type = image.content_type or ""
    if content_type not in _AVATAR_SUFFIXES:
        raise HTTPException(status_code=400, detail="请上传 JPG、PNG 或 WEBP 头像")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="头像图片不能为空")
    if len(image_bytes) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="头像图片不能超过 2MB")

    avatar_dir = UPLOAD_DIR / "headpic"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{current_user.id}-{uuid4().hex}{_AVATAR_SUFFIXES[content_type]}"
    (avatar_dir / filename).write_bytes(image_bytes)
    user = update_user_avatar(db, current_user, f"/uploads/headpic/{filename}")
    return ok(message="avatar updated", data=UserRead.model_validate(user))


@router.post("/logout", response_model=ApiResponse[dict[str, bool]])
def logout(
    db: DbSession,
    token: Annotated[str, Depends(get_bearer_token)],
) -> ApiResponse[dict[str, bool]]:
    revoked = revoke_session(db, token)
    return ok(message="logout success", data={"revoked": revoked})
