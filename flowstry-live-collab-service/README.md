# Live Collaboration Service

Real-time collaboration backend for Flowstry enabling Figma-like multiplayer editing experiences.

## Features

- **WebSocket-based real-time communication**
- **Session management** - Create, join, and leave collaboration sessions
- **Anonymous user support** - Users enter display names, auto-assigned colors
- **Presence tracking** - Cursor positions, selections, and viewports
- **Action broadcasting** - Shape operations transmitted to all session participants
- **Graceful shutdown** - Clean connection handling

## Quick Start

### Build

```bash
go build -o bin/server ./cmd/server
```

### Run

```bash
./bin/server
```

The server starts on `http://localhost:8080` by default.

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (Cloud Run) | `8080` |
| `SESSION_MAX_USERS` | Max users per session | `50` |
| `SESSION_TTL_HOURS` | Session expiry time | `24` |
| `PRESENCE_THROTTLE_MS` | Cursor update throttle | `50` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | `*` |
| `LIVE_COLLAB_JWT_SECRET` | JWT secret for join tokens | `` |
| `LIVE_COLLAB_TOKEN_ISSUER` | Expected token issuer | `flowstry-backend` |
| `LIVE_COLLAB_TOKEN_AUDIENCE` | Expected token audience | `live-collab-service` |

## API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ws` | WebSocket endpoint |
| `POST` | `/api/sessions` | Create session (REST) |
| `GET` | `/api/sessions/:id` | Get session info |

### WebSocket Protocol

Connect to `/ws` and send a `join_session` message:

```json
{
  "type": "join_session",
  "payload": {
    "sessionId": "",
    "displayName": "Alice",
    "token": ""
  }
}
```

- **Empty `sessionId`**: Creates a new session
- **With `sessionId`**: Joins existing session

#### Message Types

**Client → Server:**
- `join_session` - Join/create session
- `leave_session` - Leave session
- `action` - Shape operations
- `cursor_move` - Cursor position
- `selection_change` - Selection update
- `viewport_change` - Viewport update
- `ping` - Keep-alive

**Server → Client:**
- `session_created` / `session_joined` - Join confirmation
- `user_joined` / `user_left` - User events
- `action_broadcast` - Shape operation from another user
- `presence_update` - Cursor/selection/viewport updates
- `pong` - Keep-alive response
- `error` - Error message

## Project Structure

```
live-collab-service/
├── cmd/server/main.go        # Entry point
├── internal/
│   ├── config/               # Configuration
│   ├── hub/                  # WebSocket hub
│   ├── message/              # Message types
│   ├── server/               # HTTP server
│   ├── session/              # Session management
│   └── user/                 # User management
└── pkg/id/                   # ID generation
```

## Development

```bash
# Run with live reload (using air)
air

# Run tests
go test ./...

# Format code
go fmt ./...
```
