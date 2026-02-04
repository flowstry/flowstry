// Flowstry Canvas - A feature-rich SVG canvas component
// Styles are automatically injected
import { FullPageLoader } from './components/FullPageLoader';
export { FullPageLoader };

// No manual CSS import is required.
// 
// If you need to import the CSS file separately (e.g., for SSR), you can use:
// import 'flowstry-canvas/styles';
// or
// import 'flowstry-canvas/dist/canvas.css';

export { default as Canvas } from './Canvas';
export * from './consts/canvas';
export * from './consts/svg';

// Core exports
export { InteractionEngine, type CanvasState, type CanvasTransformDetail } from './core';
export { SettingsManager, type CanvasSettings } from './core/SettingsManager';

// Storage exports
export { FileStoragePlugin } from './core/storage/FileStoragePlugin';
export { LocalStoragePlugin } from './core/storage/LocalStoragePlugin';
export { StorageManager } from './core/storage/StorageManager';
export {
    StoragePlugin,
    type DiagramData, type LoadOptions, type SaveOptions, type ShapeData
} from './core/storage/StoragePlugin';

// Shapes and Tools exports
export { DiagramManager } from './shapes';
export * from './shapes/base';

