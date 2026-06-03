import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


@dataclass
class Challenge:
    challenge_id: str
    creator_guest_id: str
    creator_name: str
    time_control: str
    side_preference: str
    game_mode: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class LobbyManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}
        self._names: dict[str, str] = {}
        self._challenges: dict[str, Challenge] = {}
        self._lock = asyncio.Lock()

    def register(self, guest_id: str, display_name: str, ws: WebSocket) -> None:
        self._connections[guest_id] = ws
        self._names[guest_id] = display_name

    def unregister(self, guest_id: str) -> None:
        self._connections.pop(guest_id, None)
        self._names.pop(guest_id, None)

    def get_name(self, guest_id: str) -> str:
        return self._names.get(guest_id, "Guest")

    def online_count(self) -> int:
        return len(self._connections)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        message = {"type": event_type, "payload": payload}
        dead: list[str] = []
        for guest_id, ws in list(self._connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(guest_id)
        for guest_id in dead:
            self.unregister(guest_id)

    def challenge_to_dict(self, c: Challenge) -> dict[str, Any]:
        return {
            "challengeId": c.challenge_id,
            "creatorGuestId": c.creator_guest_id,
            "creatorName": c.creator_name,
            "timeControl": c.time_control,
            "sidePreference": c.side_preference,
            "gameMode": c.game_mode,
            "createdAt": c.created_at.isoformat(),
        }

    async def lobby_state_payload(self) -> dict[str, Any]:
        async with self._lock:
            return {
                "challenges": [self.challenge_to_dict(c) for c in self._challenges.values()],
                "onlineCount": len(self._connections),
            }

    async def create_challenge(
        self,
        guest_id: str,
        time_control: str,
        side_preference: str,
        game_mode: str = "standard",
    ) -> Challenge:
        async with self._lock:
            for c in self._challenges.values():
                if c.creator_guest_id == guest_id:
                    del self._challenges[c.challenge_id]
            challenge = Challenge(
                challenge_id=str(uuid.uuid4()),
                creator_guest_id=guest_id,
                creator_name=self.get_name(guest_id),
                time_control=time_control,
                side_preference=side_preference,
                game_mode=game_mode,
            )
            self._challenges[challenge.challenge_id] = challenge
            return challenge

    async def remove_challenge(self, challenge_id: str) -> Challenge | None:
        async with self._lock:
            return self._challenges.pop(challenge_id, None)

    async def get_challenge(self, challenge_id: str) -> Challenge | None:
        async with self._lock:
            return self._challenges.get(challenge_id)


lobby_manager = LobbyManager()
