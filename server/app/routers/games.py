from fastapi import APIRouter, HTTPException, Query

from app.models.game import (
    ConfirmTrueKingRequest,
    CreateGameRequest,
    JoinGameRequest,
    SetTrueKingRequest,
    GameResponse,
)
from app.services import game_service

router = APIRouter(prefix="/api/games", tags=["games"])


@router.post("", response_model=GameResponse)
async def create_game(body: CreateGameRequest):
    return await game_service.create_game(body.guest_id, body.game_mode.value)


@router.post("/join", response_model=GameResponse)
async def join_game(body: JoinGameRequest):
    try:
        return await game_service.join_game(body.room_code, body.guest_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{game_id}/true-king", response_model=GameResponse)
async def set_true_king(game_id: str, body: SetTrueKingRequest):
    try:
        return await game_service.set_true_king(
            game_id, body.guest_id, body.square
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/{game_id}/true-king/confirm", response_model=GameResponse)
async def confirm_true_king(game_id: str, body: ConfirmTrueKingRequest):
    try:
        return await game_service.confirm_true_king(game_id, body.guest_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: str,
    guest_id: str | None = Query(None, alias="guestId"),
):
    try:
        return await game_service.get_game(game_id, guest_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
