import time
from typing import Any, Literal

from app.models.game import GameResult, GameStatus

Color = Literal["white", "black"]


def now_ms() -> int:
    return int(time.time() * 1000)


def _active_color(doc: dict) -> Color | None:
    return doc.get("clockActiveColor")


def snapshot_clocks(doc: dict) -> dict[str, Any]:
    """Authoritative remaining times at this instant (milliseconds)."""
    white = int(doc.get("whiteMsRemaining", 0))
    black = int(doc.get("blackMsRemaining", 0))
    active = _active_color(doc)
    started_at = doc.get("clockStartedAtMs")

    if (
        doc.get("status") == GameStatus.ACTIVE.value
        and active
        and started_at is not None
    ):
        elapsed = max(0, now_ms() - int(started_at))
        if active == "white":
            white = max(0, white - elapsed)
        else:
            black = max(0, black - elapsed)

    return {
        "whiteMs": white,
        "blackMs": black,
        "activeColor": active,
        "serverNowMs": now_ms(),
    }


def freeze_running_clock(doc: dict) -> tuple[int, int]:
    """Return (whiteMs, blackMs) with elapsed time deducted from active side."""
    snap = snapshot_clocks(doc)
    return snap["whiteMs"], snap["blackMs"]


def init_clock_fields(time_control_key: str) -> dict[str, Any]:
    from app.models.time_control import get_time_control

    spec = get_time_control(time_control_key)
    ms = spec["initial_ms"]
    return {
        "timeControl": time_control_key,
        "initialMs": ms,
        "incrementMs": spec["increment_ms"],
        "whiteMsRemaining": ms,
        "blackMsRemaining": ms,
        "clockActiveColor": None,
        "clockStartedAtMs": None,
    }


def start_clocks_for_active_game(doc: dict) -> dict[str, Any]:
    """Begin white's clock when a timed game becomes active."""
    turn = "white" if doc.get("fen", "").split()[1] == "w" else "black"
    white, black = freeze_running_clock(doc)
    return {
        "whiteMsRemaining": white,
        "blackMsRemaining": black,
        "clockActiveColor": turn,
        "clockStartedAtMs": now_ms(),
    }


def apply_move_clock(
    doc: dict, mover: Color, increment_ms: int
) -> dict[str, Any]:
    white, black = freeze_running_clock(doc)
    if mover == "white":
        white += increment_ms
        next_active: Color | None = "black"
    else:
        black += increment_ms
        next_active = "white"

    return {
        "whiteMsRemaining": white,
        "blackMsRemaining": black,
        "clockActiveColor": next_active,
        "clockStartedAtMs": now_ms() if next_active else None,
    }


def check_timeout(doc: dict) -> Color | None:
    """Return winner color if active clock has hit zero."""
    snap = snapshot_clocks(doc)
    active = snap["activeColor"]
    if not active:
        return None
    if active == "white" and snap["whiteMs"] <= 0:
        return "black"
    if active == "black" and snap["blackMs"] <= 0:
        return "white"
    return None
