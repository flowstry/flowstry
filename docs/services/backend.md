# Flowstry Backend

The **Flowstry Backend** is the core API service responsible for business logic, data persistence, and authentication.

## Tech Stack
- **Language**: Go 1.24
- **Framework**: [Fiber v2](https://github.com/gofiber/fiber) (Fast HTTP web framework)
- **Database**: MongoDB (via `go.mongodb.org/mongo-driver`)
- **Authentication**: JWT (JSON Web Tokens)
- **Storage**: Google Cloud Storage

## Architecture

The project follows a modular structure:

- **`config/`**: Configuration loading and management.
- **`database/`**: Database connection logic (MongoDB).
- **`middleware/`**: Request interceptors (Auth, Rate Limiting).
- **`modules/`**: Feature-based organization (Auth, Workspace).
    - Each module typically contains handlers, services, and models.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | The port the server listens on (default: 8080). |
| `MONGO_URI` | Connection string for MongoDB. |
| `JWT_SECRET` | Secret key for signing tokens. |
| `GCP_PROJECT_ID` | Google Cloud Project ID for storage. |
| `GCP_BUCKET_NAME` | Bucket name for file storage. |

## Development

```bash
# Install dependencies
go mod download

# Run the server
go run main.go
```
