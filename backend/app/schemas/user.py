from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class UserBase(BaseModel):
    name: str
    email: str
    avatar_url: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
