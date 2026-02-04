/**
 * Injects CSS styles into the document head
 * This ensures styles are available when the package is used in other projects
 * without requiring manual CSS imports
 */

const CANVAS_STYLES = `
/**
 * Flowstry Canvas Component Styles
 * These styles are scoped to canvas UI elements using the .flowstry-canvas class
 */


.flowstry-canvas {
  position: relative;
  isolation: isolate;
  z-index: 0;
  overflow: hidden;
}

/* Custom Scrollbar Styles for Canvas UI Elements */
/* For Webkit browsers (Chrome, Safari, Edge) */

/* Base scrollbar - thin and minimal (default/fallback) */
.flowstry-canvas ::-webkit-scrollbar,
.flowstry-canvas::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.flowstry-canvas ::-webkit-scrollbar-track,
.flowstry-canvas::-webkit-scrollbar-track {
  background: transparent;
}

.flowstry-canvas ::-webkit-scrollbar-thumb,
.flowstry-canvas::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.25);
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: padding-box;
  transition: background 0.2s ease;
}

.flowstry-canvas ::-webkit-scrollbar-thumb:hover,
.flowstry-canvas::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.45);
  background-clip: padding-box;
}

.flowstry-canvas ::-webkit-scrollbar-corner,
.flowstry-canvas::-webkit-scrollbar-corner {
  background: transparent;
}

/* Dark theme scrollbar - higher specificity to override base styles */
.flowstry-canvas[data-theme='dark'] ::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='dark']::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='dark'] * ::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='dark'] *::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.2) !important;
  background-clip: padding-box;
}

.flowstry-canvas[data-theme='dark'] ::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='dark']::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='dark'] * ::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='dark'] *::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4) !important;
  background-clip: padding-box;
}

/* Light theme scrollbar - higher specificity to override base styles */
.flowstry-canvas[data-theme='light'] ::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='light']::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='light'] * ::-webkit-scrollbar-thumb,
.flowstry-canvas[data-theme='light'] *::-webkit-scrollbar-thumb {
  background: rgba(107, 114, 128, 0.2) !important;
  background-clip: padding-box;
}

.flowstry-canvas[data-theme='light'] ::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='light']::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='light'] * ::-webkit-scrollbar-thumb:hover,
.flowstry-canvas[data-theme='light'] *::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.35) !important;
  background-clip: padding-box;
}

/* For Firefox - base styles */
.flowstry-canvas,
.flowstry-canvas * {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.25) transparent;
}

/* For Firefox - dark theme (higher specificity) */
.flowstry-canvas[data-theme='dark'],
.flowstry-canvas[data-theme='dark'] * {
  scrollbar-color: rgba(148, 163, 184, 0.2) transparent !important;
}

/* For Firefox - light theme (higher specificity) */
.flowstry-canvas[data-theme='light'],
.flowstry-canvas[data-theme='light'] * {
  scrollbar-color: rgba(107, 114, 128, 0.2) transparent !important;
}

@keyframes flow-animation {
  from {
    stroke-dashoffset: 40px;
  }
  to {
    stroke-dashoffset: 0;
  }
}
`;

const STYLE_ID = 'flowstry-canvas-styles'

/**
 * Injects the canvas styles into the document head
 * This is idempotent - calling it multiple times won't create duplicate style tags
 */
export function injectCanvasStyles(): void {
  if (typeof document === 'undefined') {
    // SSR - styles will be injected on client side
    return
  }

  // Check if styles are already injected
  if (document.getElementById(STYLE_ID)) {
    return
  }

  // Create and inject style element
  const styleElement = document.createElement('style')
  styleElement.id = STYLE_ID
  styleElement.textContent = CANVAS_STYLES
  document.head.appendChild(styleElement)
}
