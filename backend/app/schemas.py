from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── User Schemas ─────────────────────────────────────────────

class UserBase(BaseModel):
    name: str
    email: str
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Meeting Schemas ──────────────────────────────────────────

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


# ─── Participant Schemas ──────────────────────────────────────

class ParticipantJoin(BaseModel):
    """Schema for joining a meeting."""
    display_name: str = Field(max_length=255)
    user_id: Optional[int] = None


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


# ─── Message Schemas ──────────────────────────────────────────

class MessageCreate(BaseModel):
    sender_name: str
    text: str


class MessageResponse(BaseModel):
    id: int
    meeting_id: int
    sender_name: str
    text: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Reaction Schema ──────────────────────────────────────────

class ReactionCreate(BaseModel):
    emoji: str
    sender_name: str
