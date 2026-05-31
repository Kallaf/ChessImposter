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

1. Open http://localhost:5173 and click **Create game** (choose **Standard** or **True King** mode).
2. Copy the **invite link** or room code from the game page.
3. Open a second browser tab (or another device on your network) and **Join** with the room code.
4. **Standard**: White moves first; normal chess rules apply.
5. **True King**: After both players join, each clicks one of their own pieces to designate a secret “true king”. If that piece is captured, they lose. The real king can be captured and the game continues. Your secret king is highlighted in gold on your screen only.

Moves are validated on the server.

Refreshing the page reconnects via WebSocket and restores state from the API.

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
