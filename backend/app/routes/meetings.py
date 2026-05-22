from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from prisma import Prisma

from app.database import get_db
from app.models import generate_meeting_id, generate_passcode
from app.schemas import (
    MeetingCreate,
    MeetingSchedule,
    MeetingUpdate,
    MeetingResponse,
    MeetingListResponse,
    MessageCreate,
    MessageResponse,
    ReactionCreate,
)
from app.config import get_settings
from app.websocket_manager import manager
from app.services.livekit import generate_livekit_token

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
settings = get_settings()


# ── Helper: fetch participants and broadcast ──────────────────────────────────

async def _broadcast_participants(meeting_id: str, db: Prisma):
    """Fetch current active participants and push to all room clients."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        return
    parts = await db.participant.find_many(
        where={"meeting_id": meeting.id, "left_at": None},
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

@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    host_id: int = Query(default=1),
    db: Prisma = Depends(get_db),
):
    """List all upcoming and recent meetings for a user."""
    upcoming = await db.meeting.find_many(
        where={"host_id": host_id, "status": {"in": ["scheduled", "active"]}},
        order={"scheduled_at": "asc"},
        include={"host": True, "participants": True},
    )
    recent = await db.meeting.find_many(
        where={"host_id": host_id, "status": "ended"},
        order={"ended_at": "desc"},
        take=20,
        include={"host": True, "participants": True},
    )
    return MeetingListResponse(upcoming=list(upcoming), recent=list(recent))


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_instant_meeting(
    data: MeetingCreate,
    db: Prisma = Depends(get_db),
):
    """Create a new instant meeting."""
    mid = generate_meeting_id()
    passcode = generate_passcode()
    invite_link = f"{settings.FRONTEND_URL}/meeting/{mid}?passcode={passcode}"

    meeting = await db.meeting.create(
        data={
            "meeting_id": mid,
            "title": data.title,
            "host_id": data.host_id,
            "status": "active",
            "invite_link": invite_link,
            "passcode": passcode,
            "scheduled_at": datetime.now(timezone.utc),
            "duration_minutes": 60,
            "participants": {
                "create": [
                    {
                        "user_id": data.host_id,
                        "display_name": "Dhruv Tiwari",
                        "role": "host",
                        "is_muted": False,
                        "is_video_on": True,
                    }
                ]
            },
        },
        include={"host": True, "participants": True},
    )
    return meeting


@router.post("/schedule", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def schedule_meeting(
    data: MeetingSchedule,
    db: Prisma = Depends(get_db),
):
    """Schedule a future meeting."""
    mid = generate_meeting_id()
    passcode = data.passcode if (data.passcode and len(data.passcode.strip()) > 0) else generate_passcode()
    invite_link = f"{settings.FRONTEND_URL}/meeting/{mid}?passcode={passcode}"

    meeting = await db.meeting.create(
        data={
            "meeting_id": mid,
            "title": data.title,
            "description": data.description,
            "host_id": data.host_id,
            "status": "scheduled",
            "scheduled_at": data.scheduled_at,
            "duration_minutes": data.duration_minutes,
            "invite_link": invite_link,
            "passcode": passcode,
        },
        include={"host": True, "participants": True},
    )
    return meeting


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    db: Prisma = Depends(get_db),
):
    """Get a specific meeting by its meeting ID."""
    meeting = await db.meeting.find_unique(
        where={"meeting_id": meeting_id},
        include={"host": True, "participants": True},
    )
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
    db: Prisma = Depends(get_db),
):
    """Update meeting details or status (start/end)."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] == "ended":
        update_data["ended_at"] = datetime.now(timezone.utc)

    updated = await db.meeting.update(
        where={"meeting_id": meeting_id},
        data=update_data,
        include={"host": True, "participants": True},
    )

    # Broadcast meeting_ended so all clients redirect immediately
    if update_data.get("status") == "ended":
        await manager.broadcast(meeting_id, {"type": "meeting_ended"})

    return updated


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: str,
    db: Prisma = Depends(get_db),
):
    """Delete a meeting."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await db.meeting.delete(where={"meeting_id": meeting_id})


@router.post("/{meeting_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    meeting_id: str,
    data: MessageCreate,
    db: Prisma = Depends(get_db),
):
    """Send a chat message and broadcast it via WebSocket."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    message = await db.message.create(
        data={
            "meeting_id": meeting.id,
            "sender_name": data.sender_name,
            "text": data.text,
        }
    )

    # Broadcast new message to all clients in the room
    await manager.broadcast(
        meeting_id,
        {
            "type": "new_message",
            "data": {
                "id": message.id,
                "meeting_id": message.meeting_id,
                "sender_name": message.sender_name,
                "text": message.text,
                "created_at": message.created_at.isoformat(),
            },
        },
    )
    return message


@router.post("/{meeting_id}/react", status_code=status.HTTP_200_OK)
async def send_reaction(
    meeting_id: str,
    data: ReactionCreate,
    db: Prisma = Depends(get_db),
):
    """Broadcast an emoji reaction to all clients in the meeting room."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await manager.broadcast(
        meeting_id,
        {"type": "reaction", "data": {"emoji": data.emoji, "sender_name": data.sender_name}},
    )
    return {"ok": True}


@router.get("/{meeting_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    meeting_id: str,
    db: Prisma = Depends(get_db),
):
    """List all chat messages in a meeting (used on initial load)."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    messages = await db.message.find_many(
        where={"meeting_id": meeting.id},
        order={"created_at": "asc"},
    )
    return list(messages)


@router.post("/{meeting_id}/token")
async def get_join_token(
    meeting_id: str,
    participant_identity: str = Query(...),
    participant_name: str = Query(...),
    db: Prisma = Depends(get_db),
):
    """Generate an AccessToken for joining a LiveKit room."""
    meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        token = generate_livekit_token(meeting_id, participant_identity, participant_name)
        return {"token": token, "server_url": settings.LIVEKIT_WS_URL}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate access token: {str(e)}"
        )

