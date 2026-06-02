import json
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.models.time_control import TIME_CONTROLS
from app.services import lobby_service
from app.services.lobby_manager import lobby_manager

router = APIRouter(prefix="/api/ws", tags=["lobby-ws"])


async def _send_error(ws: WebSocket, message: str) -> None:
    await ws.send_json({"type": "error", "payload": {"message": message}})


@router.websocket("/lobby")
async def lobby_websocket(
    websocket: WebSocket,
    guest_id: str = Query(..., alias="guestId"),
    display_name: str = Query(..., alias="displayName"),
):
    name = display_name.strip()[:32] or "Guest"
    await websocket.accept()
    lobby_manager.register(guest_id, name, websocket)

    try:
        await websocket.send_json(
            {
                "type": "lobby:state",
                "payload": await lobby_manager.lobby_state_payload(),
            }
        )
        await lobby_manager.broadcast(
            "lobby:presence",
            {"onlineCount": lobby_manager.online_count()},
        )

        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await _send_error(websocket, "Invalid JSON")
                continue

            msg_type = data.get("type", "")
            payload = data.get("payload") or {}

            if msg_type == "lobby:chat":
                text = str(payload.get("message", "")).strip()
                if not text:
                    continue
                entry = await lobby_manager.add_chat(guest_id, text)
                await lobby_manager.broadcast(
                    "lobby:chat",
                    lobby_manager.chat_to_dict(entry),
                )

            elif msg_type == "lobby:create_challenge":
                tc = str(payload.get("timeControl", "5+0"))
                side = str(payload.get("sidePreference", "random")).lower()
                mode = str(payload.get("gameMode", "standard"))
                if tc not in TIME_CONTROLS:
                    await _send_error(websocket, "Invalid time control")
                    continue
                if side not in ("white", "black", "random"):
                    await _send_error(websocket, "Invalid side preference")
                    continue
                challenge = await lobby_manager.create_challenge(
                    guest_id, tc, side, mode
                )
                await lobby_manager.broadcast(
                    "lobby:challenge_created",
                    lobby_manager.challenge_to_dict(challenge),
                )

            elif msg_type == "lobby:cancel_challenge":
                cid = str(payload.get("challengeId", ""))
                removed = await lobby_manager.remove_challenge(cid)
                if removed and removed.creator_guest_id == guest_id:
                    await lobby_manager.broadcast(
                        "lobby:challenge_removed",
                        {"challengeId": cid},
                    )

            elif msg_type == "lobby:join_challenge":
                cid = str(payload.get("challengeId", ""))
                try:
                    game_info = await lobby_service.create_game_from_challenge(
                        cid, guest_id
                    )
                except ValueError as e:
                    await _send_error(websocket, str(e))
                    continue

                await lobby_manager.broadcast(
                    "lobby:challenge_removed",
                    {"challengeId": cid},
                )
                await lobby_manager.broadcast(
                    "lobby:game_started",
                    game_info,
                )
                await websocket.send_json(
                    {"type": "lobby:game_started", "payload": game_info}
                )

            else:
                await _send_error(websocket, f"Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        pass
    finally:
        lobby_manager.unregister(guest_id)
        to_remove = [
            cid
            for cid, c in lobby_manager._challenges.items()
            if c.creator_guest_id == guest_id
        ]
        for cid in to_remove:
            await lobby_manager.remove_challenge(cid)
            await lobby_manager.broadcast(
                "lobby:challenge_removed", {"challengeId": cid}
            )
        await lobby_manager.broadcast(
            "lobby:presence",
            {"onlineCount": lobby_manager.online_count()},
        )
