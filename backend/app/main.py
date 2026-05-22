from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime, timezone, timedelta
import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import db
from app.routes import meetings, participants
from app.seed import seed
from app.websocket_manager import manager

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: run startup and shutdown tasks."""
    await db.connect()
    await seed()
    yield
    await db.disconnect()


app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for the Zoom Meeting Clone application",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(meetings.router)
app.include_router(participants.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "zoom-clone-api"}


async def _cleanup_participant(participant_id: int, meeting_id_str: str):
    """Safely mark a participant as left in DB and broadcast updated list on abrupt disconnect."""
    # If the participant has an active connection (e.g. they refreshed the page), do not mark them as left.
    if manager.is_participant_connected(meeting_id_str, participant_id):
        return
    try:
        # Mark participant as left
        await db.participant.update(
            where={"id": participant_id},
            data={"left_at": datetime.now(timezone.utc)}
        )
        # Fetch the meeting DB ID to trigger the broadcast helper from participants route
        meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id_str})
        if meeting:
            from app.routes.participants import _broadcast_participants
            await _broadcast_participants(meeting.id, meeting_id_str, db)
    except Exception as e:
        print(f"[WS Disconnect Cleanup Error] {e}")


async def _reactivate_participant(participant_id: int, meeting_id_str: str):
    """Safely mark a participant as active again (clear left_at) in DB and broadcast updated list on reconnect."""
    try:
        await db.participant.update(
            where={"id": participant_id},
            data={"left_at": None}
        )
        meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id_str})
        if meeting:
            from app.routes.participants import _broadcast_participants
            await _broadcast_participants(meeting.id, meeting_id_str, db)
    except Exception as e:
        print(f"[WS Connect Reactivate Error] {e}")


async def _schedule_meeting_expiration(meeting_id_str: str, delay_seconds: float):
    """Wait for the meeting duration to run out, then end the meeting and broadcast."""
    await asyncio.sleep(delay_seconds)
    try:
        meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id_str})
        if meeting and meeting.status == "active":
            await db.meeting.update(
                where={"meeting_id": meeting_id_str},
                data={"status": "ended", "ended_at": datetime.now(timezone.utc)}
            )
            await manager.broadcast(meeting_id_str, {"type": "meeting_ended"})
    except Exception as e:
        print(f"[Meeting Expiration Task Error] {e}")


@app.websocket("/ws/{meeting_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    meeting_id: str,
    participant_id: Optional[int] = None
):
    """
    WebSocket endpoint — one connection per participant per meeting.
    Clients connect here and receive real-time JSON events.
    Handles heartbeat 'ping' frames and WebRTC json payloads in a single robust loop.
    """
    await manager.connect(meeting_id, websocket, participant_id)

    if participant_id is not None:
        await _reactivate_participant(participant_id, meeting_id)

    # Expiration checker: automatic meeting ending after its given defined duration
    try:
        meeting = await db.meeting.find_unique(where={"meeting_id": meeting_id})
        if meeting and meeting.status == "active" and meeting.scheduled_at:
            now_utc = datetime.now(timezone.utc)
            expiration = meeting.scheduled_at + timedelta(minutes=meeting.duration_minutes)
            remaining = (expiration - now_utc).total_seconds()
            if remaining <= 0:
                # Already expired! End it now and broadcast.
                await db.meeting.update(
                    where={"meeting_id": meeting_id},
                    data={"status": "ended", "ended_at": now_utc}
                )
                await manager.broadcast(meeting_id, {"type": "meeting_ended"})
            else:
                asyncio.create_task(_schedule_meeting_expiration(meeting_id, remaining))
    except Exception as exp_err:
        print(f"[Expiration Check Error] {exp_err}")
    try:
        import json
        while True:
            # Receive frame as plain text to safely distinguish between ping and json payloads
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
                continue

            # Parse WebRTC JSON signaling / reaction messages
            try:
                data = json.loads(message)
                if isinstance(data, dict):
                    await manager.broadcast(meeting_id, data, exclude=websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(meeting_id, websocket, participant_id)
        if participant_id is not None:
            await _cleanup_participant(participant_id, meeting_id)
    except Exception as e:
        print(f"[WS Endpoint Error] {e}")
        manager.disconnect(meeting_id, websocket, participant_id)
        if participant_id is not None:
            await _cleanup_participant(participant_id, meeting_id)
