from fastapi import APIRouter

from app.models.time_control import TIME_CONTROLS

router = APIRouter(prefix="/api/lobby", tags=["lobby"])


@router.get("/time-controls")
async def list_time_controls():
    return {
        "controls": [
            {
                "key": key,
                "label": spec["label"],
                "category": spec["category"],
                "initialMs": spec["initial_ms"],
                "incrementMs": spec["increment_ms"],
            }
            for key, spec in TIME_CONTROLS.items()
        ]
    }
