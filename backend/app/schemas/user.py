"""Auth/user request & response schemas.

`email` is plain `str` (not pydantic EmailStr) to avoid pulling in the
email-validator dependency, which is not part of the locked stack.
"""
from pydantic import BaseModel, ConfigDict


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
