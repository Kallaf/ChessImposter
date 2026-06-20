from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class GameMode(str, Enum):
    STANDARD = "standard"
    TRUE_KING = "true_king"


class GameStatus(str, Enum):
    WAITING = "waiting"
    SETUP = "setup"
    ACTIVE = "active"
    FINISHED = "finished"


class GameResult(str, Enum):
    WHITE = "white"
    BLACK = "black"
    DRAW = "draw"
    ABANDONED = "abandoned"
class CreateGameRequest(BaseModel):
    guest_id: str = Field(..., alias="guestId")
    game_mode: GameMode = Field(GameMode.STANDARD, alias="gameMode")

    model_config = {"populate_by_name": True}


class JoinGameRequest(BaseModel):
    room_code: str = Field(..., alias="roomCode")
    guest_id: str = Field(..., alias="guestId")

    model_config = {"populate_by_name": True}


class SetTrueKingRequest(BaseModel):
    guest_id: str = Field(..., alias="guestId")
    square: str

    model_config = {"populate_by_name": True}


class ConfirmTrueKingRequest(BaseModel):
    guest_id: str = Field(..., alias="guestId")

    model_config = {"populate_by_name": True}


class GameResponse(BaseModel):
    game_id: str = Field(..., alias="gameId")
    room_code: str = Field(..., alias="roomCode")
    game_mode: GameMode = Field(GameMode.STANDARD, alias="gameMode")
    white_guest_id: str | None = Field(None, alias="whiteGuestId")
    black_guest_id: str | None = Field(None, alias="blackGuestId")
    fen: str
    moves: list[str]
    status: GameStatus
    result: GameResult | None = None
    draw_offer: str | None = Field(None, alias="drawOffer")
    rematch_offer: str | None = Field(None, alias="rematchOffer")
    turn: Literal["white", "black"] | None = None
    your_color: Literal["white", "black"] | None = Field(None, alias="yourColor")
    your_true_king_square: str | None = Field(None, alias="yourTrueKingSquare")
    your_true_king_origin: str | None = Field(None, alias="yourTrueKingOrigin")
    needs_true_king_selection: bool = Field(False, alias="needsTrueKingSelection")
    your_true_king_ready: bool = Field(False, alias="yourTrueKingReady")
    opponent_ready: bool = Field(False, alias="opponentReady")
    time_control: str | None = Field(None, alias="timeControl")
    clocks: dict | None = None
    your_display_name: str | None = Field(None, alias="yourDisplayName")
    opponent_display_name: str | None = Field(None, alias="opponentDisplayName")

    model_config = {"populate_by_name": True, "use_enum_values": True}


def turn_from_fen(fen: str) -> Literal["white", "black"]:
    return "white" if fen.split()[1] == "w" else "black"


def doc_to_response(doc: dict, guest_id: str | None = None) -> GameResponse:
    fen = doc.get("fen", STARTING_FEN)
    white_id = doc.get("whiteGuestId")
    black_id = doc.get("blackGuestId")
    game_mode = doc.get("gameMode", GameMode.STANDARD.value)
    your_color = None
    if guest_id:
        if guest_id == white_id:
            your_color = "white"
        elif guest_id == black_id:
            your_color = "black"

    status = doc.get("status", GameStatus.WAITING)
    turn = turn_from_fen(fen) if status == GameStatus.ACTIVE.value else None

    your_true_king = None
    your_true_king_origin = None
    needs_selection = False
    your_ready = False
    opponent_ready = False

    if game_mode == GameMode.TRUE_KING.value and status == GameStatus.SETUP.value:
        white_tk = doc.get("whiteTrueKingSquare")
        black_tk = doc.get("blackTrueKingSquare")
        white_ready = bool(doc.get("whiteTrueKingReady"))
        black_ready = bool(doc.get("blackTrueKingReady"))
        if your_color == "white":
            your_true_king = white_tk
            needs_selection = white_tk is None
            your_ready = white_ready
            opponent_ready = black_ready
        elif your_color == "black":
            your_true_king = black_tk
            needs_selection = black_tk is None
            your_ready = black_ready
            opponent_ready = white_ready
    elif game_mode == GameMode.TRUE_KING.value and your_color:
        if your_color == "white":
            your_true_king = doc.get("whiteTrueKingSquare")
            your_true_king_origin = doc.get("whiteTrueKingOrigin")
        else:
            your_true_king = doc.get("blackTrueKingSquare")
            your_true_king_origin = doc.get("blackTrueKingOrigin")
    else:
        your_true_king_origin = None

    clocks = None
    if doc.get("timeControl"):
        from app.services import clock_service

        clocks = clock_service.snapshot_clocks(doc)
    your_display_name = None
    opponent_display_name = None
    if guest_id == white_id:
        your_display_name = doc.get("whiteDisplayName")
        opponent_display_name = doc.get("blackDisplayName")
    elif guest_id == black_id:
        your_display_name = doc.get("blackDisplayName")
        opponent_display_name = doc.get("whiteDisplayName")

    return GameResponse(
        gameId=doc["gameId"],
        roomCode=doc["roomCode"],
        gameMode=game_mode,
        whiteGuestId=white_id,
        blackGuestId=black_id,
        fen=fen,
        moves=doc.get("moves", []),
        status=status,
        result=doc.get("result"),
        drawOffer=doc.get("drawOffer"),
        rematchOffer=doc.get("rematchOffer"),
        turn=turn,
        yourColor=your_color,
        yourTrueKingSquare=your_true_king,
        yourTrueKingOrigin=your_true_king_origin,
        needsTrueKingSelection=needs_selection,
        yourTrueKingReady=your_ready,
        opponentReady=opponent_ready,
        timeControl=doc.get("timeControl"),
        clocks=clocks,
        yourDisplayName=your_display_name,
        opponentDisplayName=opponent_display_name,
    )
