# Flowstry AppApp

The **Flowstry App** is the main user interface for the platform, providing the canvas and diagramming tools.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (v16)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State/Logic**: React Hooks & Context
- **Graphics**: [RoughJS](https://roughjs.com/) (Hand-drawn style shapes)
- **Deployment**: Firebase Hosting

## Key Dependencies
- `firebase`: Authentication and hosting.
- `framer-motion`: Animations.
- `lucide-react`: Icon set.
- `pako`: Compression for data storage.

## Project Structure
- **`app/`**: Next.js App Router pages and layouts.
- **`components/`**: Reusable UI components.
- **`lib/`**: Utility functions and helpers.
- **`public/`**: Static assets.

## Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Firebase (prod)
npm run firebase:deploy
```
