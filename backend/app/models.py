import random
import string
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_meeting_id() -> str:
    """Generate a Zoom-style 11-digit numeric meeting ID (xxx-xxxx-xxxx)."""
    digits = ''.join(random.choices(string.digits, k=11))
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:11]}"


def generate_passcode() -> str:
    """Generate a 6-character alphanumeric passcode."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=6))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    hosted_meetings = relationship("Meeting", back_populates="host", cascade="all, delete-orphan")
    participations = relationship("Participant", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(14), unique=True, nullable=False, default=generate_meeting_id)
    title = Column(String(500), nullable=False, default="Zoom Meeting")
    description = Column(Text, nullable=True)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(
        SAEnum("scheduled", "active", "ended", name="meeting_status"),
        default="scheduled",
        nullable=False,
    )
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, default=60)
    invite_link = Column(String(500), nullable=True)
    passcode = Column(String(10), nullable=False, default=generate_passcode)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    host = relationship("User", back_populates="hosted_meetings")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    display_name = Column(String(255), nullable=False)
    role = Column(
        SAEnum("host", "co-host", "participant", name="participant_role"),
        default="participant",
        nullable=False,
    )
    is_muted = Column(Boolean, default=False)
    is_video_on = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    left_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")
