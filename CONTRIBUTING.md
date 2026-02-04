# Contributing to Flowstry

Thank you for your interest in contributing to Flowstry! We welcome contributions from the community to help make this project better.

## Getting Started

Flowstry is a monorepo containing several services. To get started, you'll need to set up the environment for the specific service you want to work on.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Go](https://go.dev/) (v1.21 or later)
- [Docker](https://www.docker.com/) (optional, for containerized development)

### Project Structure

- **`flowstry-frontend`**: Main Next.js frontend application.
- **`flowstry-website`**: Marketing website (Next.js).
- **`flowstry-backend`**: Core backend service (Go).
- **`flowstry-live-collab-service`**: Real-time collaboration service (Go).
- **`flowstry-feedback-service`**: Feedback handling service (Go).

## Development Workflow

1.  **Fork the repository** on GitHub.
2.  **Clone** your fork locally.
3.  **Create a branch** for your feature or fix: `git checkout -b feature/my-new-feature`.
4.  Navigate to the relevant service directory (e.g., `cd flowstry-frontend`).
5.  Follow the service-specific `README.md` to start the development server.
6.  **Commit** your changes with clear messages.
7.  **Push** to your fork.
8.  **Open a Pull Request** against the `main` branch.

## Code Style

- **Frontend**: We use ESLint and Prettier. Ensure your code passes linting before submitting.
- **Backend**: We follow standard Go conventions (`gofmt`, `go vet`).

## Reporting Issues

If you find a bug or have a feature request, please open an issue in the repository with details about reproduction steps or use cases.

## License

By contributing, you agree that your contributions will be licensed under the project's license.
