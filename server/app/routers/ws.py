import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.models.game import GameStatus, doc_to_response
from app.services import game_service

router = APIRouter(prefix="/api/ws", tags=["websocket"])

# gameId -> set of WebSockets
_rooms: dict[str, set[WebSocket]] = {}


def _get_room(game_id: str) -> set[WebSocket]:
    if game_id not in _rooms:
        _rooms[game_id] = set()
    return _rooms[game_id]


async def broadcast_game_state(game_id: str, guest_id: str | None = None) -> None:
    doc = await game_service.get_game_doc(game_id)
    if not doc:
        return
    room = _get_room(game_id)
    dead: list[WebSocket] = []
    for ws in room:
        try:
            gid = getattr(ws, "_guest_id", None)
            state = doc_to_response(doc, gid).model_dump(by_alias=True, mode="json")
            payload = {"type": "game_state", "game": state}
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        room.discard(ws)


async def _send_error(ws: WebSocket, message: str) -> None:
    await ws.send_json({"type": "error", "message": message})


@router.websocket("/games/{game_id}")
async def game_websocket(
    websocket: WebSocket,
    game_id: str,
    guest_id: str = Query(..., alias="guestId"),
):
    doc = await game_service.get_game_doc(game_id)
    if not doc:
        await websocket.close(code=4004, reason="Game not found")
        return

    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")
    if guest_id not in (white_id, black_id):
        await websocket.close(code=4003, reason="Not a player")
        return

    await websocket.accept()
    websocket._guest_id = guest_id  # type: ignore[attr-defined]
    room = _get_room(game_id)
    room.add(websocket)

    try:
        state = doc_to_response(doc, guest_id).model_dump(by_alias=True, mode="json")
        await websocket.send_json({"type": "game_state", "game": state})
        await broadcast_game_state(game_id)

        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await _send_error(websocket, "Invalid JSON")
                continue

            msg_type = data.get("type")
            if msg_type == "move":
                uci = data.get("uci", "")
                try:
                    await game_service.apply_game_move(game_id, guest_id, uci)
                    await broadcast_game_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
            elif msg_type == "set_true_king":
                square = data.get("square", "")
                try:
                    await game_service.set_true_king(game_id, guest_id, square)
                    await broadcast_game_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
            elif msg_type == "confirm_true_king":
                try:
                    await game_service.confirm_true_king(game_id, guest_id)
                    await broadcast_game_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
            else:
                await _send_error(websocket, f"Unknown message type: {msg_type}")
    except WebSocketDisconnect:
        pass
    finally:
        room.discard(websocket)
        if not room:
            _rooms.pop(game_id, None)
            await game_service.mark_abandoned(game_id, guest_id)
        else:
            await broadcast_game_state(game_id)
