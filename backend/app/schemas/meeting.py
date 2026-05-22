from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from .user import UserResponse

class MeetingCreate(BaseModel):
    """Schema for creating an instant meeting."""
    title: str = Field(default="Zoom Meeting", max_length=500)
    host_id: int = 1

class MeetingSchedule(BaseModel):
    """Schema for scheduling a meeting."""
    title: str = Field(max_length=500)
    description: Optional[str] = None
    host_id: int = 1
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=1440)
    passcode: Optional[str] = None

class MeetingUpdate(BaseModel):
    """Schema for updating a meeting."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None

class ParticipantInMeeting(BaseModel):
    id: int
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    host_id: int
    status: str
    scheduled_at: Optional[datetime] = None
    duration_minutes: int
    invite_link: Optional[str] = None
    passcode: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    host: Optional[UserResponse] = None
    participants: List[ParticipantInMeeting] = []

    class Config:
        from_attributes = True

class MeetingListResponse(BaseModel):
    upcoming: List[MeetingResponse]
    recent: List[MeetingResponse]
