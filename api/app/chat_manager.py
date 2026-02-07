from typing import Dict, Set
from fastapi import WebSocket

class ChatManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(room_id, set()).add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                self.rooms.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict):
        if room_id not in self.rooms:
            return
        dead = []
        for ws in self.rooms[room_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room_id, ws)

manager = ChatManager()
