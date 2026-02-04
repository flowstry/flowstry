# Flowstry

**Modern. Collaborative. Open Source.**

Flowstry is a modern, collaborative diagramming and whiteboarding platform designed for teams to visualize ideas seamlessly. Built with a unified monorepo architecture, it combines the power of Next.js for a responsive frontend with high-performance Go microservices for real-time interaction.

### 🌐 Live
- **Website**: [flowstry.com](https://flowstry.com)
- **App**: [app.flowstry.com](https://app.flowstry.com)
- **X / Twitter**: [@FlowstryOffical](https://x.com/FlowstryOffical)

## ✨ Key Features
- **Infinite Canvas**: A smooth, infinite workspace for creating flowcharts, diagrams, and sketches using a hand-drawn aesthetic.
- **Real-Time Collaboration**: Multiplayer support allowing multiple users to edit diagrams simultaneously with live cursor tracking.
- **Modern Tech Stack**: Built on Next.js and Go, ensuring high performance and scalability.
- **Feedback System**: Integrated feedback collection service to gather user insights directly from the app.
- **Secure Architecture**: Robust backend handling authentication, workspace management, and data persistence.

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

## License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.
