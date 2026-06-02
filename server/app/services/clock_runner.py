import asyncio
from datetime import datetime, timezone

from app.db.mongo import get_database
from app.models.game import GameStatus
from app.services import clock_service
from app.services.game_ws import broadcast_game_protocol


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

_TICK_INTERVAL = 0.25


async def run_clock_loop() -> None:
    while True:
        try:
            await _tick_active_games()
        except Exception:
            pass
        await asyncio.sleep(_TICK_INTERVAL)


async def _tick_active_games() -> None:
    db = get_database()
    cursor = db.games.find(
        {
            "status": GameStatus.ACTIVE.value,
            "clockActiveColor": {"$ne": None},
        },
        {"gameId": 1},
    )
    async for doc in cursor:
        game_id = doc["gameId"]
        full = await db.games.find_one({"gameId": game_id})
        if not full:
            continue
        winner = clock_service.check_timeout(full)
        if not winner:
            continue
        white, black = clock_service.freeze_running_clock(full)
        await db.games.update_one(
            {"gameId": game_id},
            {
                "$set": {
                    "status": GameStatus.FINISHED.value,
                    "result": winner,
                    "resultReason": "timeout",
                    "whiteMsRemaining": white,
                    "blackMsRemaining": black,
                    "clockActiveColor": None,
                    "clockStartedAtMs": None,
                    "updatedAt": _utcnow(),
                }
            },
        )
        loser = "black" if winner == "white" else "white"
        await broadcast_game_protocol(
            game_id,
            "game:timeout",
            {
                "winner": winner,
                "loser": loser,
                "reason": "timeout",
            },
        )
