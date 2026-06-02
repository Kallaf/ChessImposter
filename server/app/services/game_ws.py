from typing import Any

from fastapi import WebSocket

from app.models.game import doc_to_response
from app.services import clock_service, game_service

_rooms: dict[str, set[WebSocket]] = {}


def get_room(game_id: str) -> set[WebSocket]:
    if game_id not in _rooms:
        _rooms[game_id] = set()
    return _rooms[game_id]


def add_connection(game_id: str, ws: WebSocket) -> None:
    get_room(game_id).add(ws)


def remove_connection(game_id: str, ws: WebSocket) -> bool:
    room = get_room(game_id)
    room.discard(ws)
    if not room:
        _rooms.pop(game_id, None)
        return True
    return False


def build_game_payload(doc: dict, guest_id: str | None) -> dict[str, Any]:
    state = doc_to_response(doc, guest_id).model_dump(by_alias=True, mode="json")
    clocks = clock_service.snapshot_clocks(doc)
    opponent_name = None
    if guest_id:
        if guest_id == doc.get("whiteGuestId"):
            opponent_name = doc.get("blackDisplayName")
        elif guest_id == doc.get("blackGuestId"):
            opponent_name = doc.get("whiteDisplayName")
    return {
        "game": state,
        "clocks": clocks,
        "opponentName": opponent_name,
        "yourDisplayName": (
            doc.get("whiteDisplayName")
            if guest_id == doc.get("whiteGuestId")
            else doc.get("blackDisplayName")
            if guest_id == doc.get("blackGuestId")
            else None
        ),
    }


async def send_to_socket(ws: WebSocket, event_type: str, payload: dict[str, Any]) -> None:
    await ws.send_json({"type": event_type, "payload": payload})


async def broadcast_game_protocol(
    game_id: str,
    event_type: str,
    extra: dict[str, Any] | None = None,
) -> None:
    doc = await game_service.get_game_doc(game_id)
    if not doc:
        return
    room = get_room(game_id)
    dead: list[WebSocket] = []
    for ws in room:
        try:
            guest_id = getattr(ws, "_guest_id", None)
            payload = build_game_payload(doc, guest_id)
            if extra:
                payload.update(extra)
            if event_type == "game:time_sync":
                payload = {
                    **clock_service.snapshot_clocks(doc),
                    "gameId": game_id,
                    **(extra or {}),
                }
            await send_to_socket(ws, event_type, payload)
            if event_type == "game:move":
                await send_to_socket(ws, "game:state", build_game_payload(doc, guest_id))
                await send_to_socket(
                    ws,
                    "game:time_sync",
                    {**clock_service.snapshot_clocks(doc), "gameId": game_id},
                )
        except Exception:
            dead.append(ws)
    for ws in dead:
        room.discard(ws)


async def broadcast_full_state(game_id: str) -> None:
    doc = await game_service.get_game_doc(game_id)
    if not doc:
        return
    room = get_room(game_id)
    dead: list[WebSocket] = []
    for ws in room:
        try:
            guest_id = getattr(ws, "_guest_id", None)
            payload = build_game_payload(doc, guest_id)
            await send_to_socket(ws, "game:state", payload)
            await send_to_socket(
                ws,
                "game:time_sync",
                {**clock_service.snapshot_clocks(doc), "gameId": game_id},
            )
        except Exception:
            dead.append(ws)
    for ws in dead:
        room.discard(ws)
