from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import ACCESS_TOKEN_EXPIRE_HOURS
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.models.auth_session import AuthSession
from backend.app.models.preference import Preference
from backend.app.models.user import User
from backend.app.schemas.auth import UserCreate


def get_user_by_username(db: Session, username: str) -> User | None:
    statement = select(User).where(User.username == username)
    return db.scalars(statement).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(
        username=user_in.username,
        password_hash=hash_password(user_in.password),
        display_name=user_in.display_name or user_in.username,
    )
    db.add(user)
    db.flush()
    user.avatar_url = f"/uploads/headpic/{((user.id - 1) % 5) + 1}.png"

    db.add(Preference(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user: User) -> AuthSession:
    session = AuthSession(
        user_id=user.id,
        token=create_access_token(),
        expires_at=datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session_by_token(db: Session, token: str) -> AuthSession | None:
    statement = select(AuthSession).where(AuthSession.token == token)
    session = db.scalars(statement).first()

    if session and session.expires_at <= datetime.utcnow():
        db.delete(session)
        db.commit()
        return None

    return session


def revoke_session(db: Session, token: str) -> bool:
    session = get_session_by_token(db, token)
    if not session:
        return False

    db.delete(session)
    db.commit()
    return True


def update_user_avatar(db: Session, user: User, avatar_url: str) -> User:
    user.avatar_url = avatar_url
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
