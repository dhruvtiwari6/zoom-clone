from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import db
from app.routers import meetings, participants
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


@app.websocket("/ws/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint — one connection per participant per meeting.
    Clients connect here and receive real-time JSON events:
      { type: 'participants', data: [...] }
      { type: 'new_message',  data: {...} }
      { type: 'meeting_ended' }
    The server accepts 'ping' text frames to keep the connection alive.
    """
    await manager.connect(meeting_id, websocket)
    try:
        while True:
            # We can receive either plain text ("ping") or JSON (WebRTC signaling)
            data = await websocket.receive_json()
            if isinstance(data, dict):
                # If it's a signaling or reaction message, broadcast it to the room
                # (but avoid sending it back to the sender if we want, or just broadcast to everyone)
                await manager.broadcast(meeting_id, data)
            elif data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(meeting_id, websocket)
    except Exception:
        # Fallback to text handler if json parsing fails
        try:
            while True:
                text = await websocket.receive_text()
                if text == "ping":
                    await websocket.send_text("pong")
        except Exception:
            pass
        manager.disconnect(meeting_id, websocket)
