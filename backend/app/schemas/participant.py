from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ParticipantJoin(BaseModel):
    """Schema for joining a meeting."""
    display_name: str = Field(max_length=255)
    user_id: Optional[int] = None
    passcode: Optional[str] = None

class ParticipantUpdate(BaseModel):
    """Schema for updating participant state."""
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None
    role: Optional[str] = None

class ParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: Optional[int] = None
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None

    class Config:
        from_attributes = True
