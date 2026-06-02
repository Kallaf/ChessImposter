from typing import TypedDict


class TimeControlSpec(TypedDict):
    label: str
    category: str
    initial_ms: int
    increment_ms: int


TIME_CONTROLS: dict[str, TimeControlSpec] = {
    "1+0": {"label": "1+0", "category": "bullet", "initial_ms": 60_000, "increment_ms": 0},
    "2+1": {"label": "2+1", "category": "bullet", "initial_ms": 120_000, "increment_ms": 1_000},
    "3+0": {"label": "3+0", "category": "blitz", "initial_ms": 180_000, "increment_ms": 0},
    "3+2": {"label": "3+2", "category": "blitz", "initial_ms": 180_000, "increment_ms": 2_000},
    "5+0": {"label": "5+0", "category": "blitz", "initial_ms": 300_000, "increment_ms": 0},
    "10+0": {"label": "10+0", "category": "rapid", "initial_ms": 600_000, "increment_ms": 0},
    "15+10": {"label": "15+10", "category": "rapid", "initial_ms": 900_000, "increment_ms": 10_000},
}


def get_time_control(key: str) -> TimeControlSpec:
    spec = TIME_CONTROLS.get(key)
    if not spec:
        raise ValueError(f"Unknown time control: {key}")
    return spec
