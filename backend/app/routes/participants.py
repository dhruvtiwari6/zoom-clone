from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from prisma import Prisma

from app.database import get_db
from app.schemas import ParticipantJoin, ParticipantUpdate, ParticipantResponse
from app.websocket_manager import manager

router = APIRouter(prefix="/api", tags=["participants"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _broadcast_participants(meeting_db_id: int, meeting_id: str, db: Prisma):
    """Push fresh participant list to all WebSocket clients in the room."""
    parts = await db.participant.find_many(
        where={"meeting_id": meeting_db_id, "left_at": None},
        order={"joined_at": "asc"},
    )
    payload = [
        {
            "id": p.id,
            "meeting_id": p.meeting_id,
            "user_id": p.user_id,
            "display_name": p.display_name,
            "role": p.role,
            "is_muted": p.is_muted,
            "is_video_on": p.is_video_on,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            "left_at": None,
        }
        for p in parts
    ]
    await manager.broadcast(meeting_id, {"type": "participants", "data": payload})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/meetings/{meeting_id}/join",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_meeting(
    meeting_id: str,
    data: ParticipantJoin,
    db: Prisma = Depends(get_db),
):
    """Join a meeting — deduplicates by display_name then broadcasts."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    # Validate passcode if one is configured for the meeting and the user is not the host
    if meeting.passcode and meeting.passcode.strip() != "":
        is_host = data.user_id == meeting.host_id
        if not is_host:
            if not data.passcode or data.passcode.strip() != meeting.passcode.strip():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect meeting passcode"
                )

    if meeting.status == "ended":
        raise HTTPException(status_code=400, detail="This meeting has already ended")

    # Auto-activate scheduled meetings when first participant joins
    if meeting.status == "scheduled":
        from datetime import datetime, timezone
        await db.meeting.update(
            where={"id": meeting.id},
            data={
                "status": "active",
                "scheduled_at": datetime.now(timezone.utc)
            },
        )

    # Deduplication — return existing active participant if same name
    existing = await db.participant.find_first(
        where={
            "meeting_id": meeting.id,
            "display_name": data.display_name,
            "left_at": None,
        }
    )
    if existing:
        await _broadcast_participants(meeting.id, meeting_id, db)
        return existing

    is_host = data.user_id == meeting.host_id if data.user_id else False
    role = "host" if is_host else "waiting"

    participant = await db.participant.create(
        data={
            "meeting_id": meeting.id,
            "user_id": data.user_id,
            "display_name": data.display_name,
            "role": role,
            "is_muted": False,
            "is_video_on": True,
        }
    )

    # Broadcast updated participant list to everyone in the room
    await _broadcast_participants(meeting.id, meeting_id, db)
    return participant


@router.get(
    "/meetings/{meeting_id}/participants",
    response_model=List[ParticipantResponse],
)
async def list_participants(
    meeting_id: str,
    db: Prisma = Depends(get_db),
):
    """List all active participants in a meeting."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participants = await db.participant.find_many(
        where={"meeting_id": meeting.id, "left_at": None},
        order={"joined_at": "asc"},
    )
    return list(participants)


@router.patch("/participants/{participant_id}", response_model=ParticipantResponse)
async def update_participant(
    participant_id: int,
    data: ParticipantUpdate,
    db: Prisma = Depends(get_db),
):
    """Update participant state (mute/unmute, video on/off) and broadcast."""
    participant = await db.participant.find_unique(where={"id": participant_id})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    updated = await db.participant.update(
        where={"id": participant_id},
        data=data.model_dump(exclude_unset=True),
    )

    # Resolve meeting_id string for broadcast
    meeting = await db.meeting.find_unique(where={"id": participant.meeting_id})
    if meeting:
        await _broadcast_participants(meeting.id, meeting.meeting_id, db)

    return updated


@router.delete("/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    participant_id: int,
    db: Prisma = Depends(get_db),
):
    """Remove a participant (host control) and broadcast updated list."""
    participant = await db.participant.find_unique(where={"id": participant_id})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    await db.participant.update(
        where={"id": participant_id},
        data={"left_at": datetime.now(timezone.utc)},
    )

    meeting = await db.meeting.find_unique(where={"id": participant.meeting_id})
    if meeting:
        # Notify the removed participant specifically
        await manager.broadcast(
            meeting.meeting_id,
            {"type": "participant_removed", "participant_id": participant_id},
        )
        await _broadcast_participants(meeting.id, meeting.meeting_id, db)


@router.post("/meetings/{meeting_id}/mute-all", status_code=status.HTTP_200_OK)
async def mute_all_participants(
    meeting_id: str,
    db: Prisma = Depends(get_db),
):
    """Host control: mute all non-host participants and broadcast."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await db.participant.update_many(
        where={
            "meeting_id": meeting.id,
            "left_at": None,
            "NOT": {"role": "host"},
        },
        data={"is_muted": True},
    )

    await _broadcast_participants(meeting.id, meeting_id, db)
    return {"message": "Muted all participants"}
