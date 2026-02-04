# Live Collaboration Service

The **Live Collaboration Service** powers the real-time multiplayer features of Flowstry.

## Tech Stack
- **Language**: Go 1.23
- **Router**: [gorilla/mux](https://github.com/gorilla/mux)
- **WebSockets**: [gorilla/websocket](https://github.com/gorilla/websocket)
- **Authentication**: JWT validation (same secret as backend)

## Features
- Real-time cursor tracking.
- Object locking/presence.
- Broadcasts updates to connected clients.

## Architecture
- **`hub`**: Central component that manages active internal clients and broadcasts messages.
- **`client`**: Represents a single websocket connection.
- **`message`**: Defines the protocol for client-server communication.

## Protocol
Communication happens over WebSockets. Messages are JSON payloads with a `type` and `payload`.

Example:
```json
{
  "type": "cursor_move",
  "payload": { "x": 100, "y": 200 }
}
```

## Development

```bash
# Install dependencies
go mod download

# Run server
go run cmd/server/main.go
```
