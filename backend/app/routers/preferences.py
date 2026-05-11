from fastapi import APIRouter

from backend.app.deps import CurrentUser, DbSession
from backend.app.models.preference import Preference
from backend.app.schemas.preference import PreferenceRead, PreferenceUpdate
from backend.app.schemas.response import ApiResponse, ok


router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=ApiResponse[PreferenceRead])
def read_preferences(
    db: DbSession,
    current_user: CurrentUser,
) -> ApiResponse[PreferenceRead]:
    preference = current_user.preference
    if preference is None:
        preference = Preference(user_id=current_user.id)
        db.add(preference)
        db.commit()
        db.refresh(preference)

    return ok(
        message="preferences",
        data=PreferenceRead.model_validate(preference),
    )


@router.put("", response_model=ApiResponse[PreferenceRead])
def update_preferences(
    preference_in: PreferenceUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> ApiResponse[PreferenceRead]:
    preference = current_user.preference
    if preference is None:
        preference = Preference(user_id=current_user.id)
        db.add(preference)
        db.flush()

    updates = preference_in.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is not None:
            setattr(preference, field, value)

    db.commit()
    db.refresh(preference)
    return ok(
        message="preferences updated",
        data=PreferenceRead.model_validate(preference),
    )
