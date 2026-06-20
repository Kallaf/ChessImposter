import secrets
import string
import uuid
from datetime import datetime, timezone

from app.db.mongo import get_database
from app.models.game import (
    STARTING_FEN,
    GameMode,
    GameResult,
    GameStatus,
    doc_to_response,
)
from app.services import chess_engine, clock_service

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


def _initial_status(game_mode: str, has_black: bool) -> str:
    if game_mode == GameMode.TRUE_KING.value and has_black:
        return GameStatus.SETUP.value
    if has_black:
        return GameStatus.ACTIVE.value
    return GameStatus.WAITING.value


async def create_game(
    guest_id: str,
    game_mode: str = GameMode.STANDARD.value,
    display_name: str | None = None,
    time_control: str | None = None,
):
    db = get_database()
    game_id = str(uuid.uuid4())
    room_code = await _generate_room_code()
    now = _utcnow()
    doc = {
        "gameId": game_id,
        "roomCode": room_code,
        "gameMode": game_mode,
        "whiteGuestId": guest_id,
        "blackGuestId": None,
        "whiteDisplayName": display_name or "Guest",
        "blackDisplayName": None,
        "whiteTrueKingSquare": None,
        "blackTrueKingSquare": None,
        "whiteTrueKingOrigin": None,
        "blackTrueKingOrigin": None,
        "whiteTrueKingReady": False,
        "blackTrueKingReady": False,
        "fen": STARTING_FEN,
        "moves": [],
        "status": GameStatus.WAITING.value,
        "result": None,
        "createdAt": now,
        "updatedAt": now,
    }
    if time_control:
        doc.update(clock_service.init_clock_fields(time_control))
    await db.games.insert_one(doc)
    return doc_to_response(doc, guest_id)


async def join_game(
    room_code: str,
    guest_id: str,
    display_name: str | None = None,
):
    db = get_database()
    doc = await db.games.find_one({"roomCode": room_code.upper().strip()})
    if not doc:
        raise ValueError("Room not found")
    if doc.get("status") == GameStatus.FINISHED.value:
        raise ValueError("Game has already finished")
    if guest_id == doc.get("whiteGuestId"):
        return doc_to_response(doc, guest_id)
    if doc.get("blackGuestId") and doc.get("blackGuestId") != guest_id:
        raise ValueError("Room is full")
    if doc.get("blackGuestId") is None:
        now = _utcnow()
        game_mode = doc.get("gameMode", GameMode.STANDARD.value)
        new_status = _initial_status(game_mode, has_black=True)
        update: dict = {
            "blackGuestId": guest_id,
            "blackDisplayName": display_name or "Guest",
            "status": new_status,
            "updatedAt": now,
        }
        if new_status == GameStatus.ACTIVE.value and doc.get("timeControl"):
            doc["blackGuestId"] = guest_id
            doc["status"] = new_status
            update.update(clock_service.start_clocks_for_active_game(doc))
        await db.games.update_one({"gameId": doc["gameId"]}, {"$set": update})
        doc = await db.games.find_one({"gameId": doc["gameId"]})
    return doc_to_response(doc, guest_id)


async def set_true_king(game_id: str, guest_id: str, square: str):
    doc = await get_game_doc(game_id)
    if not doc:
        raise ValueError("Game not found")
    if doc.get("gameMode") != GameMode.TRUE_KING.value:
        raise ValueError("Not a true-king game")
    if doc.get("status") != GameStatus.SETUP.value:
        raise ValueError("True king selection is closed")

    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")
    fen = doc.get("fen", STARTING_FEN)
    square = square.lower().strip()

    if guest_id == white_id:
        err = chess_engine.validate_true_king_selection(fen, square, for_white=True)
        if err:
            raise ValueError(err)
        field = "whiteTrueKingSquare"
    elif guest_id == black_id:
        err = chess_engine.validate_true_king_selection(fen, square, for_white=False)
        if err:
            raise ValueError(err)
        field = "blackTrueKingSquare"
    else:
        raise ValueError("Not a player in this game")

    ready_field = field.replace("Square", "Ready")
    previous_square = doc.get(field)
    now = _utcnow()
    update: dict = {
        field: square,
        ready_field: False,
        "updatedAt": now,
    }
    if previous_square != square:
        origin_field = field.replace("Square", "Origin")
        update[origin_field] = None

    db = get_database()
    await db.games.update_one({"gameId": game_id}, {"$set": update})
    doc = await db.games.find_one({"gameId": game_id})
    return doc_to_response(doc, guest_id)


async def confirm_true_king(game_id: str, guest_id: str):
    doc = await get_game_doc(game_id)
    if not doc:
        raise ValueError("Game not found")
    if doc.get("gameMode") != GameMode.TRUE_KING.value:
        raise ValueError("Not a true-king game")
    if doc.get("status") != GameStatus.SETUP.value:
        raise ValueError("True king selection is closed")

    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")

    if guest_id == white_id:
        if not doc.get("whiteTrueKingSquare"):
            raise ValueError("Choose your secret king first")
        field = "whiteTrueKingSquare"
        ready_field = "whiteTrueKingReady"
        origin_field = "whiteTrueKingOrigin"
    elif guest_id == black_id:
        if not doc.get("blackTrueKingSquare"):
            raise ValueError("Choose your secret king first")
        field = "blackTrueKingSquare"
        ready_field = "blackTrueKingReady"
        origin_field = "blackTrueKingOrigin"
    else:
        raise ValueError("Not a player in this game")

    square = doc.get(field)
    now = _utcnow()
    update = {
        ready_field: True,
        origin_field: square,
        "updatedAt": now,
    }

    db = get_database()
    await db.games.update_one({"gameId": game_id}, {"$set": update})
    doc = await db.games.find_one({"gameId": game_id})

    if (
        doc.get("whiteTrueKingReady")
        and doc.get("blackTrueKingReady")
        and doc.get("status") == GameStatus.SETUP.value
    ):
        active_update: dict = {
            "status": GameStatus.ACTIVE.value,
            "updatedAt": _utcnow(),
        }
        doc = await db.games.find_one({"gameId": game_id})
        if doc and doc.get("timeControl"):
            active_update.update(clock_service.start_clocks_for_active_game(doc))
        await db.games.update_one({"gameId": game_id}, {"$set": active_update})
        doc = await db.games.find_one({"gameId": game_id})

    return doc_to_response(doc, guest_id)


async def get_game(game_id: str, guest_id: str | None = None):
    db = get_database()
    doc = await db.games.find_one({"gameId": game_id})
    if not doc:
        raise ValueError("Game not found")
    return doc_to_response(doc, guest_id)


async def get_game_doc(game_id: str) -> dict | None:
    db = get_database()
    return await db.games.find_one({"gameId": game_id})


async def apply_game_move(game_id: str, guest_id: str, uci: str):
    doc = await get_game_doc(game_id)
    if not doc:
        raise ValueError("Game not found")
    if doc.get("status") == GameStatus.FINISHED.value:
        raise ValueError("Game is finished")
    if doc.get("status") == GameStatus.WAITING.value:
        raise ValueError("Waiting for opponent")
    if doc.get("status") == GameStatus.SETUP.value:
        raise ValueError("Choose your true king before playing")

    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")
    if guest_id not in (white_id, black_id):
        raise ValueError("Not a player in this game")

    fen = doc.get("fen", STARTING_FEN)
    turn = "white" if fen.split()[1] == "w" else "black"
    player_color = "white" if guest_id == white_id else "black"
    if turn != player_color:
        raise ValueError("Not your turn")

    game_mode = doc.get("gameMode", GameMode.STANDARD.value)
    now = _utcnow()
    moves = doc.get("moves", []) + [uci]
    update: dict = {"moves": moves, "updatedAt": now}

    if doc.get("timeControl") and doc.get("status") == GameStatus.ACTIVE.value:
        increment = int(doc.get("incrementMs", 0))
        update.update(clock_service.apply_move_clock(doc, player_color, increment))

    if game_mode == GameMode.TRUE_KING.value:
        white_tk = doc.get("whiteTrueKingSquare")
        black_tk = doc.get("blackTrueKingSquare")
        new_fen, err, winner, new_white_tk, new_black_tk = chess_engine.apply_move_true_king(
            fen, uci, white_tk, black_tk
        )
        if err:
            raise ValueError(err)
        update["fen"] = new_fen
        update["whiteTrueKingSquare"] = new_white_tk
        update["blackTrueKingSquare"] = new_black_tk
        if winner:
            update["status"] = GameStatus.FINISHED.value
            update["result"] = winner
    else:
        new_fen, err = chess_engine.apply_move(fen, uci)
        if err:
            raise ValueError(err)
        update["fen"] = new_fen
        if chess_engine.is_game_over(new_fen):
            update["status"] = GameStatus.FINISHED.value
            result = chess_engine.winner_or_draw(new_fen)
            if result:
                update["result"] = result

    db = get_database()
    await db.games.update_one({"gameId": game_id}, {"$set": update})
    doc = await db.games.find_one({"gameId": game_id})
    return doc_to_response(doc, guest_id)

async def request_draw(game_id: str, guest_id: str) -> None:
    db = get_database()
    # Mark that this specific guest_id has offered a draw
    await db.games.update_one(
        {"gameId": game_id, "status": GameStatus.ACTIVE.value},
        {"$set": {"drawOffer": guest_id}}
    )

async def reject_draw(game_id: str, guest_id: str) -> None:
    db = get_database()
    # Remove the draw offer from the document
    await db.games.update_one(
        {"gameId": game_id},
        {"$unset": {"drawOffer": ""}}
    )

async def accept_draw(game_id: str, guest_id: str) -> None:
    doc = await get_game_doc(game_id)
    if not doc:
        raise ValueError("Game not found")
        
    draw_offer = doc.get("drawOffer")
    
    # Validate that an offer exists and that the player accepting is NOT the one who offered
    if not draw_offer or draw_offer == guest_id:
        raise ValueError("No valid draw offer to accept")
        
    await end_game(game_id, guest_id, "draw")


async def request_rematch(game_id: str, guest_id: str) -> None:
    db = get_database()
    # Mark that this specific guest_id has offered a rematch
    await db.games.update_one(
        {"gameId": game_id, "status": GameStatus.ACTIVE.value},
        {"$set": {"rematchOffer": guest_id}}
    )

async def reject_rematch(game_id: str, guest_id: str) -> None:
    db = get_database()
    # Remove the rematch offer from the document
    await db.games.update_one(
        {"gameId": game_id},
        {"$unset": {"rematchOffer": ""}}
    )

async def accept_rematch(game_id: str, guest_id: str) -> None:
    doc = await get_game_doc(game_id)
    if not doc:
        raise ValueError("Game not found")

    rematch_offer = doc.get("rematchOffer")

    # Validate that an offer exists and that the player accepting is NOT the one who offered
    if not rematch_offer or rematch_offer == guest_id:
        raise ValueError("No valid rematch offer to accept")

    # Reset the game state for a new game
    await reset_game(game_id)


async def end_game(game_id: str, guest_id: str, end_game_type: str) -> None:
    doc = await get_game_doc(game_id)
    if not doc or doc.get("status") not in (
        GameStatus.ACTIVE.value,
        GameStatus.SETUP.value,
    ):
        return
        
    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")
    if guest_id not in (white_id, black_id):
        return

    now = _utcnow()
    update_data = {
        "status": GameStatus.FINISHED.value,
        "updatedAt": now,
        "resultReason": end_game_type,
        "drawOffer": None,  # Clear any existing draw offer
    }

    # Determine the result based on the end_game_type
    if end_game_type in ("abandoned", "resign"):
        # The user who triggered this loses.
        winner = GameResult.BLACK.value if guest_id == white_id else GameResult.WHITE.value
        update_data["result"] = winner
    elif end_game_type in ("abort", "draw"):
        # Aborting usually cancels the game without a winner. 
        # Update this to GameResult.ABORTED.value if your enum has it.
        update_data["result"] = GameResult.DRAW.value
    else:
        # Failsafe for unknown end_game types
        return

    db = get_database()
    await db.games.update_one(
        {"gameId": game_id},
        {
            "$set": update_data
        },
    )

async def reset_game(game_id: str) -> None:
    db = get_database()
    doc = await db.games.find_one({"gameId": game_id})
    if not doc:
        raise ValueError("Game not found")

    game_mode = doc.get("gameMode", GameMode.STANDARD.value)

    # 1. Swap player colors for the rematch
    old_white_id = doc.get("whiteGuestId")
    old_black_id = doc.get("blackGuestId")
    old_white_name = doc.get("whiteDisplayName")
    old_black_name = doc.get("blackDisplayName")

    # 2. Determine initial status for the new game 
    # (Since both players are present, has_black is True)
    new_status = _initial_status(game_mode, has_black=True)
    now = _utcnow()

    update_data = {
        "whiteGuestId": old_black_id,
        "blackGuestId": old_white_id,
        "whiteDisplayName": old_black_name,
        "blackDisplayName": old_white_name,
        "fen": STARTING_FEN,
        "moves": [],
        "status": new_status,
        "result": None,
        "resultReason": None,
        "updatedAt": now,
        
        # Reset True King variables
        "whiteTrueKingSquare": None,
        "blackTrueKingSquare": None,
        "whiteTrueKingOrigin": None,
        "blackTrueKingOrigin": None,
        "whiteTrueKingReady": False,
        "blackTrueKingReady": False,
    }

    # Clear any residual offers
    unset_data = {
        "rematchOffer": "",
        "drawOffer": ""
    }

    # 3. Handle clocks if a time control exists
    if doc.get("timeControl"):
        # Re-initialize the base clock fields
        clock_fields = clock_service.init_clock_fields(doc["timeControl"])
        update_data.update(clock_fields)
        
        # If the game immediately becomes active (e.g., standard mode), start the clocks
        if new_status == GameStatus.ACTIVE.value:
            # Create a mock document with the new clock state to pass into the clock service
            mock_doc = {**doc, **update_data}
            update_data.update(clock_service.start_clocks_for_active_game(mock_doc))

    # 4. Commit the reset to the database
    await db.games.update_one(
        {"gameId": game_id},
        {
            "$set": update_data,
            "$unset": unset_data
        }
    )
