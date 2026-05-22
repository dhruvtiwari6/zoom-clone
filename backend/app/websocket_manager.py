from fastapi import WebSocket
from typing import Dict, List, Optional


class ConnectionManager:
    """Manages WebSocket connections grouped by meeting room and participant ID."""

    def __init__(self):
        # meeting_id -> list of connected WebSockets
        self.rooms: Dict[str, List[WebSocket]] = {}
        # meeting_id -> participant_id -> list of active WebSockets
        self.active_participants: Dict[str, Dict[int, List[WebSocket]]] = {}

    async def connect(self, meeting_id: str, websocket: WebSocket, participant_id: Optional[int] = None):
        await websocket.accept()
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = []
        self.rooms[meeting_id].append(websocket)

        if participant_id is not None:
            if meeting_id not in self.active_participants:
                self.active_participants[meeting_id] = {}
            if participant_id not in self.active_participants[meeting_id]:
                self.active_participants[meeting_id][participant_id] = []
            self.active_participants[meeting_id][participant_id].append(websocket)

    def disconnect(self, meeting_id: str, websocket: WebSocket, participant_id: Optional[int] = None):
        if meeting_id in self.rooms:
            try:
                self.rooms[meeting_id].remove(websocket)
            except ValueError:
                pass
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]

        if participant_id is not None:
            if meeting_id in self.active_participants:
                if participant_id in self.active_participants[meeting_id]:
                    try:
                        self.active_participants[meeting_id][participant_id].remove(websocket)
                    except ValueError:
                        pass
                    if not self.active_participants[meeting_id][participant_id]:
                        del self.active_participants[meeting_id][participant_id]
                if not self.active_participants[meeting_id]:
                    del self.active_participants[meeting_id]

    def is_participant_connected(self, meeting_id: str, participant_id: int) -> bool:
        """Check if a participant has any active WebSocket connections in the meeting room."""
        return len(self.active_participants.get(meeting_id, {}).get(participant_id, [])) > 0

    async def broadcast(self, meeting_id: str, message: dict, exclude: WebSocket = None):
        """Send a JSON message to every client in the meeting room, optionally excluding one."""
        if meeting_id not in self.rooms:
            return
        dead: List[WebSocket] = []
        for ws in list(self.rooms[meeting_id]):
            if exclude and ws == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(meeting_id, ws)

    def room_size(self, meeting_id: str) -> int:
        return len(self.rooms.get(meeting_id, []))


# Singleton — imported by routers and main
manager = ConnectionManager()
