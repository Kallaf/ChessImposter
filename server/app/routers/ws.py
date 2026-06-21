import json
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import game_service
from app.services.game_ws import (
    add_connection,
    broadcast_full_state,
    build_game_payload,
    remove_connection,
    send_to_socket,
)

router = APIRouter(prefix="/api/ws", tags=["websocket"])


async def _send_error(ws: WebSocket, message: str) -> None:
    await ws.send_json({"type": "error", "payload": {"message": message}})


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
    add_connection(game_id, websocket)

    try:
        payload = build_game_payload(doc, guest_id)
        await send_to_socket(websocket, "game:state", payload)
        from app.services import clock_service

        await send_to_socket(
            websocket,
            "game:time_sync",
            {**clock_service.snapshot_clocks(doc), "gameId": game_id},
        )
        await broadcast_full_state(game_id)

        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await _send_error(websocket, "Invalid JSON")
                continue

            msg_type = data.get("type", "")
            payload_in = data.get("payload") or data

            if msg_type in ("game:move", "move"):
                uci = payload_in.get("uci", "")
                try:
                    await game_service.apply_game_move(game_id, guest_id, uci)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type == "set_true_king":
                square = payload_in.get("square", "")
                try:
                    await game_service.set_true_king(game_id, guest_id, square)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("confirm_true_king", "game:confirm_true_king"):
                try:
                    await game_service.confirm_true_king(game_id, guest_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("resign", "game:resign"):
                try:
                    await game_service.end_game(game_id, guest_id, "resign")
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("abort", "game:abort"):
                try:
                    await game_service.end_game(game_id, guest_id, "abort")
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("request_draw", "game:request_draw"):
                try:
                    await game_service.request_draw(game_id, guest_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
                    
            elif msg_type in ("reject_draw", "game:reject_draw"):
                try:
                    await game_service.reject_draw(game_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("accept_draw", "game:accept_draw"):
                try:
                    await game_service.accept_draw(game_id, guest_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("request_rematch", "game:request_rematch"):
                try:
                    await game_service.request_rematch(game_id, guest_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
                    
            elif msg_type in ("reject_rematch", "game:reject_rematch"):
                try:
                    await game_service.reject_rematch(game_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))

            elif msg_type in ("accept_rematch", "game:accept_rematch"):
                try:
                    await game_service.accept_rematch(game_id, guest_id)
                    await broadcast_full_state(game_id)
                except ValueError as e:
                    await _send_error(websocket, str(e))
                    
            else:
                await _send_error(websocket, f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        pass
    finally:
        room_empty = remove_connection(game_id, websocket)
        if room_empty:
            # --- UPDATED: Call the new end_game function for abandonments ---
            await game_service.end_game(game_id, guest_id, "abandoned")
        else:
            await broadcast_full_state(game_id)