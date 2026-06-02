import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.mongo import close_mongo_connection, ensure_indexes
from app.routers import games, lobby, lobby_ws, ws
from app.services.clock_runner import run_clock_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    clock_task = asyncio.create_task(run_clock_loop())
    yield
    clock_task.cancel()
    try:
        await clock_task
    except asyncio.CancelledError:
        pass
    await close_mongo_connection()


app = FastAPI(title="Chess API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(lobby.router)
app.include_router(ws.router)
app.include_router(lobby_ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
