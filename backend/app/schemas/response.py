from typing import Generic, TypeVar

from pydantic import BaseModel


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    message: str
    data: T | None = None


def ok(message: str = "success", data: T | None = None) -> ApiResponse[T]:
    return ApiResponse(success=True, message=message, data=data)


def fail(message: str, data: T | None = None) -> ApiResponse[T]:
    return ApiResponse(success=False, message=message, data=data)
