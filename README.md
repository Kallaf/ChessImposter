# Chess — Online Guest Play

A basic online chess website: React + Vite frontend, FastAPI + MongoDB backend, real-time moves over WebSockets.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.11+
- [Docker](https://www.docker.com/) (for MongoDB) or a local MongoDB instance

## Quick start

### 1. Start MongoDB

```bash
docker compose up -d
```

### 2. Backend

```bash
cd server
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000  
Health: http://localhost:8000/health

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

App: http://localhost:5173

## How to play

1. Open http://localhost:5173 — enter a **display name** (or accept a generated guest name).
2. In the **Global Lobby**, post in global chat, **Create Game** with a time control and side preference, or **Join** an open challenge.
3. Both players are sent to the game room; **clocks are server-authoritative** (Bullet / Blitz / Rapid presets).
4. **Standard**: normal chess rules; moves validated on the server.
5. **True King** (if selected when creating a challenge): each player picks a secret king piece, confirms, then play proceeds. Losing the secret piece ends the game.

Room codes and invite links still work on the game page for spectators or late joiners. Refreshing reconnects via WebSocket and syncs board + clocks from the server.

### WebSocket protocol (summary)

**Lobby** (`/api/ws/lobby`): `lobby:state`, `lobby:chat`, `lobby:challenge_created`, `lobby:challenge_removed`, `lobby:game_started`  
**Game** (`/api/ws/game/{gameId}`): `game:state`, `game:move`, `game:time_sync`, `game:timeout`  

Client clocks drift-correct when local display differs from `game:time_sync` by more than 500ms.

## Environment variables

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | `chess` | Database name |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

### Client (`client/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | FastAPI base URL (WebSocket uses `ws://` derived from this) |

## Project structure

```
Chess/
  client/          React + Vite + react-chessboard
  server/          FastAPI + motor + python-chess
  docker-compose.yml
```

## Production notes (out of scope for v1)

- Host the API with a process manager and set `CORS_ORIGINS` to your frontend URL.
- Use MongoDB Atlas or a managed MongoDB instance.
- Build the client with `npm run build` and serve static files from CDN or nginx.
- Horizontal scaling of WebSockets requires a shared pub/sub layer (e.g. Redis).
