import random
import secrets
import string
import uuid
from datetime import datetime, timezone

from app.db.mongo import get_database
from app.models.game import STARTING_FEN, GameMode, GameStatus
from app.models.time_control import get_time_control
from app.services import clock_service
from app.services.lobby_manager import lobby_manager

ROOM_CODE_LENGTH = 6
ROOM_ALPHABET = string.ascii_uppercase + string.digits


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _generate_room_code() -> str:
    db = get_database()
    for _ in range(20):
        code = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(ROOM_CODE_LENGTH))
        existing = await db.games.find_one({"roomCode": code})
        if not existing:
            return code
    raise RuntimeError("Could not generate unique room code")


def _assign_colors(side_preference: str, creator_id: str, joiner_id: str) -> tuple[str, str, str, str]:
    """Return white_id, black_id, white_name, black_name."""
    creator_name = lobby_manager.get_name(creator_id)
    joiner_name = lobby_manager.get_name(joiner_id)
    pref = side_preference.lower()
    if pref == "white":
        return creator_id, joiner_id, creator_name, joiner_name
    if pref == "black":
        return joiner_id, creator_id, joiner_name, creator_name
    if random.random() < 0.5:
        return creator_id, joiner_id, creator_name, joiner_name
    return joiner_id, creator_id, joiner_name, creator_name


async def create_game_from_challenge(
    challenge_id: str,
    joiner_guest_id: str,
) -> dict:
    challenge = await lobby_manager.get_challenge(challenge_id)
    if not challenge:
        raise ValueError("Challenge not found")
    if challenge.creator_guest_id == joiner_guest_id:
        raise ValueError("Cannot join your own challenge")

    get_time_control(challenge.time_control)

    white_id, black_id, white_name, black_name = _assign_colors(
        challenge.side_preference,
        challenge.creator_guest_id,
        joiner_guest_id,
    )

    game_mode = challenge.game_mode
    status = GameStatus.SETUP.value if game_mode == GameMode.TRUE_KING.value else GameStatus.ACTIVE.value

    game_id = str(uuid.uuid4())
    room_code = await _generate_room_code()
    now = _utcnow()

    doc: dict = {
        "gameId": game_id,
        "roomCode": room_code,
        "gameMode": game_mode,
        "whiteGuestId": white_id,
        "blackGuestId": black_id,
        "whiteDisplayName": white_name,
        "blackDisplayName": black_name,
        "whiteTrueKingSquare": None,
        "blackTrueKingSquare": None,
        "whiteTrueKingOrigin": None,
        "blackTrueKingOrigin": None,
        "whiteTrueKingReady": False,
        "blackTrueKingReady": False,
        "fen": STARTING_FEN,
        "moves": [],
        "status": status,
        "result": None,
        "challengeId": challenge_id,
        "createdAt": now,
        "updatedAt": now,
        **clock_service.init_clock_fields(challenge.time_control),
    }

    if status == GameStatus.ACTIVE.value:
        doc.update(clock_service.start_clocks_for_active_game(doc))

    db = get_database()
    await db.games.insert_one(doc)
    await lobby_manager.remove_challenge(challenge_id)

    return {
        "gameId": game_id,
        "roomCode": room_code,
        "whiteGuestId": white_id,
        "blackGuestId": black_id,
    }
