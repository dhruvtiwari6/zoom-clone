from fastapi import WebSocket
from typing import Dict, List


class ConnectionManager:
    """Manages WebSocket connections grouped by meeting room."""

    def __init__(self):
        # meeting_id -> list of connected WebSockets
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, meeting_id: str, websocket: WebSocket):
        await websocket.accept()
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = []
        self.rooms[meeting_id].append(websocket)

    def disconnect(self, meeting_id: str, websocket: WebSocket):
        if meeting_id in self.rooms:
            try:
                self.rooms[meeting_id].remove(websocket)
            except ValueError:
                pass
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]

    async def broadcast(self, meeting_id: str, message: dict):
        """Send a JSON message to every client in the meeting room."""
        if meeting_id not in self.rooms:
            return
        dead: List[WebSocket] = []
        for ws in list(self.rooms[meeting_id]):
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
