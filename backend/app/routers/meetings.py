from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Meeting, Participant, generate_meeting_id, generate_passcode
from app.schemas import (
    MeetingCreate,
    MeetingSchedule,
    MeetingUpdate,
    MeetingResponse,
    MeetingListResponse,
)
from app.config import get_settings

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
settings = get_settings()


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    host_id: int = Query(default=1),
    db: AsyncSession = Depends(get_db),
):
    """List all upcoming and recent meetings for a user."""
    now = datetime.now(timezone.utc)

    # Upcoming: scheduled meetings in the future or active meetings
    upcoming_query = (
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(
            Meeting.host_id == host_id,
            or_(
                Meeting.status == "scheduled",
                Meeting.status == "active",
            ),
        )
        .order_by(Meeting.scheduled_at.asc().nullsfirst())
    )
    upcoming_result = await db.execute(upcoming_query)
    upcoming = upcoming_result.scalars().all()

    # Recent: ended meetings, last 20
    recent_query = (
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(
            Meeting.host_id == host_id,
            Meeting.status == "ended",
        )
        .order_by(Meeting.ended_at.desc().nullslast())
        .limit(20)
    )
    recent_result = await db.execute(recent_query)
    recent = recent_result.scalars().all()

    return MeetingListResponse(upcoming=list(upcoming), recent=list(recent))


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_instant_meeting(
    data: MeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new instant meeting and return it."""
    mid = generate_meeting_id()
    invite_link = f"{settings.FRONTEND_URL}/meeting/{mid}"

    meeting = Meeting(
        meeting_id=mid,
        title=data.title,
        host_id=data.host_id,
        status="active",
        invite_link=invite_link,
        passcode=generate_passcode(),
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=60,
    )
    db.add(meeting)
    await db.flush()

    # Auto-add host as participant
    host_participant = Participant(
        meeting_id=meeting.id,
        user_id=data.host_id,
        display_name="Dhruv Tiwari",
        role="host",
        is_muted=False,
        is_video_on=True,
    )
    db.add(host_participant)
    await db.flush()

    # Re-fetch with relationships
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(Meeting.id == meeting.id)
    )
    return result.scalar_one()


@router.post("/schedule", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def schedule_meeting(
    data: MeetingSchedule,
    db: AsyncSession = Depends(get_db),
):
    """Schedule a future meeting."""
    mid = generate_meeting_id()
    invite_link = f"{settings.FRONTEND_URL}/meeting/{mid}"

    meeting = Meeting(
        meeting_id=mid,
        title=data.title,
        description=data.description,
        host_id=data.host_id,
        status="scheduled",
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        invite_link=invite_link,
        passcode=generate_passcode(),
    )
    db.add(meeting)
    await db.flush()

    # Re-fetch with relationships
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(Meeting.id == meeting.id)
    )
    return result.scalar_one()


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific meeting by its meeting ID. Used to validate meeting existence."""
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(Meeting.meeting_id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID '{meeting_id}' not found",
        )
    return meeting


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str,
    data: MeetingUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update meeting details or status (start/end)."""
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.host), selectinload(Meeting.participants))
        .where(Meeting.meeting_id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "status" and value == "ended":
            meeting.ended_at = datetime.now(timezone.utc)
        setattr(meeting, key, value)

    await db.flush()
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a meeting."""
    result = await db.execute(
        select(Meeting).where(Meeting.meeting_id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await db.delete(meeting)
