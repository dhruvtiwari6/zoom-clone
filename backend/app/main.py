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
    Clients connect here and receive real-time JSON events.
    Handles heartbeat 'ping' frames and WebRTC json payloads in a single robust loop.
    """
    await manager.connect(meeting_id, websocket)
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
        manager.disconnect(meeting_id, websocket)
    except Exception as e:
        print(f"[WS Endpoint Error] {e}")
        manager.disconnect(meeting_id, websocket)
