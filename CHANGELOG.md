# Changelog

All notable changes to this project will be documented in this file.

## v0.2.0 (2026-02-04) - Early Access Release

**Full Changelog**: Opening Flowstry as a public open source project.

### 🚀 What is Flowstry?
Flowstry is a modern, collaborative diagramming and whiteboarding platform designed for teams to visualize ideas seamlessly. Built with a unified monorepo architecture, it combines the power of Next.js for a responsive frontend with high-performance Go microservices for real-time interaction.

### ✨ Key Features
- **Infinite Canvas**: A smooth, infinite workspace for creating flowcharts, diagrams, and sketches using a hand-drawn aesthetic.
- **Real-Time Collaboration**: Multiplayer support allowing multiple users to edit diagrams simultaneously with live cursor tracking.
- **Modern Tech Stack**: Built on Next.js 14 and Go 1.23, ensuring high performance and scalability.
- **Feedback System**: Integrated feedback collection service to gather user insights directly from the app.
- **Secure Architecture**: Robust backend handling authentication, workspace management, and data persistence.

### 🛠 Technical Changes
- **Monorepo Conversion**: Consolidated all services (`flowstry-app`, `flowstry-backend`, etc.) into a single repository for streamlined development.
- **Deployment Pipelines**: Added automated GitHub Actions workflows for deploying frontends to Firebase Hosting and backends to Google Cloud Run.
- **Documentation**: Added comprehensive documentation for all services in the `docs/` directory.

