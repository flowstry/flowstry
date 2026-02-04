# Flowstry

Flowstry is a comprehensive platform built with a modern tech stack, organized as a monorepo.

## Architecture Overview

The project is divided into the following services:

### Frontend
- **[Flowstry Frontend](./flowstry-frontend)**: The main application interface built with Next.js.
- **[Flowstry Website](./flowstry-website)**: The public-facing marketing website built with Next.js.

### Backend
- **[Flowstry Backend](./flowstry-backend)**: Core API service handling business logic (Go).
- **[Live Collaboration Service](./flowstry-live-collab-service)**: Handles real-time updates and collaboration features (Go).
- **[Feedback Service](./flowstry-feedback-service)**: Manages user feedback data (Go).

## Getting Started

To get started with development, please refer to the [Contributing Guide](./CONTRIBUTING.md).

 each service has its own `README.md` with specific setup instructions.

## Deployment

We use a combination of **Firebase Hosting** (Frontends) and **Google Cloud Run** (Backends).

- **Frontends**: Deployed via Firebase Hosting.
- **Backends**: Containerized and deployed to Cloud Run via GitHub Actions.
