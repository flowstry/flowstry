# Feedback Service

The **Feedback Service** is a microservice dedicated to collecting and managing user feedback and issue reports.

## Tech Stack
- **Language**: Go 1.23
- **Framework**: [Fiber v2](https://github.com/gofiber/fiber)
- **Database**: MongoDB

## API Endpoints

- `POST /api/feedback`: Submit new feedback.
- `GET /api/feedback`: Retrieve feedback (Admin only, requires auth).

## Development

```bash
# Install dependencies
go mod download

# Run server
go run main.go
```
