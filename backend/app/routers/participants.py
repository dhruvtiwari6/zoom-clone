from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Participant, Meeting
from app.schemas import ParticipantJoin, ParticipantUpdate, ParticipantResponse

router = APIRouter(prefix="/api", tags=["participants"])


@router.post(
    "/meetings/{meeting_id}/join",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_meeting(
    meeting_id: str,
    data: ParticipantJoin,
    db: AsyncSession = Depends(get_db),
):
    """Join a meeting by adding yourself as a participant."""
    # Validate meeting exists and is joinable
    result = await db.execute(
        select(Meeting).where(Meeting.meeting_id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.status == "ended":
        raise HTTPException(status_code=400, detail="This meeting has already ended")

    # If meeting is scheduled, auto-activate it
    if meeting.status == "scheduled":
        meeting.status = "active"

    participant = Participant(
        meeting_id=meeting.id,
        user_id=data.user_id,
        display_name=data.display_name,
        role="participant",
        is_muted=False,
        is_video_on=True,
    )
    db.add(participant)
    await db.flush()
    return participant


@router.get(
    "/meetings/{meeting_id}/participants",
    response_model=List[ParticipantResponse],
)
async def list_participants(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all participants in a meeting."""
    # First get the meeting internal ID
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.meeting_id == meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Participant)
        .where(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None),
        )
        .order_by(Participant.joined_at.asc())
    )
    return list(result.scalars().all())


@router.patch("/participants/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: int,
    data: ParticipantUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update participant state (mute/unmute, video on/off, role change)."""
    result = await db.execute(
        select(Participant).where(Participant.id == participant_id)
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(participant, key, value)

    await db.flush()
    return participant


@router.delete("/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    participant_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove a participant from a meeting (host control)."""
    result = await db.execute(
        select(Participant).where(Participant.id == participant_id)
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Mark as left rather than deleting
    participant.left_at = datetime.now(timezone.utc)
    await db.flush()


@router.post("/meetings/{meeting_id}/mute-all", status_code=status.HTTP_200_OK)
async def mute_all_participants(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Host control: mute all participants in a meeting."""
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.meeting_id == meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Participant).where(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None),
            Participant.role != "host",
        )
    )
    participants = result.scalars().all()
    for p in participants:
        p.is_muted = True

    await db.flush()
    return {"message": f"Muted {len(participants)} participants"}
