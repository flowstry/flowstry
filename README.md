# Flowstry

Flowstry is a comprehensive platform built with a modern tech stack, organized as a monorepo.

## Architecture & Documentation

The project is divided into the following services. Detailed documentation for each is available in the `docs/` directory:

### Frontend
- **[Flowstry App](./flowstry-app)** ([Docs](./docs/services/app.md)): The main application interface built with Next.js.
- **[Flowstry Website](./flowstry-website)** ([Docs](./docs/services/website.md)): The public-facing marketing website built with Next.js.

### Backend
- **[Flowstry Backend](./flowstry-backend)** ([Docs](./docs/services/backend.md)): Core API service (Go).
- **[Live Collaboration Service](./flowstry-live-collab-service)** ([Docs](./docs/services/live-collab-service.md)): Real-time collab (Go).
- **[Feedback Service](./flowstry-feedback-service)** ([Docs](./docs/services/feedback-service.md)): Feedback management (Go).

## Getting Started / Running Locally

To run the basic local version of the app:

1.  **Navigate to the App directory**:
    ```bash
    cd flowstry-app
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will best available at `http://localhost:3000`.

For full platform development (including backend), please refer to the [Contributing Guide](./CONTRIBUTING.md).


## Deployment

We use a combination of **Firebase Hosting** (Frontends) and **Google Cloud Run** (Backends).

- **Frontends**: Deployed via Firebase Hosting.
- **Backends**: Containerized and deployed to Cloud Run via GitHub Actions.
