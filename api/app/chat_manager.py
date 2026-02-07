from typing import Dict, Set, List, Tuple
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

    def get_top_rooms(self, limit: int = 10) -> List[Tuple[str, int]]:
        """
        Get top rooms by online user count.
        Returns list of (room_id, user_count) tuples sorted by user count descending.
        """
        room_counts = [(room_id, len(connections)) for room_id, connections in self.rooms.items()]
        return sorted(room_counts, key=lambda x: x[1], reverse=True)[:limit]

manager = ChatManager()
