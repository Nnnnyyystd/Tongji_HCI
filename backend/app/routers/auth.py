from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.deps import CurrentUser, DbSession, get_bearer_token
from backend.app.schemas.auth import TokenRead, UserCreate, UserLogin, UserRead
from backend.app.schemas.response import ApiResponse, ok
from backend.app.services.auth import (
    authenticate_user,
    create_session,
    create_user,
    get_user_by_username,
    revoke_session,
)


router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/logout", response_model=ApiResponse[dict[str, bool]])
def logout(
    db: DbSession,
    token: Annotated[str, Depends(get_bearer_token)],
) -> ApiResponse[dict[str, bool]]:
    revoked = revoke_session(db, token)
    return ok(message="logout success", data={"revoked": revoked})
