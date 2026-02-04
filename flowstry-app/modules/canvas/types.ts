
import { RefObject } from "react";
import { ContextMenuOption } from "./components/ContextMenu";
import { MenuAction, MenuCategory } from "./components/MainMenu";
import { PropertiesCardData } from "./components/PropertiesCard";
import { CanvasState, InteractionEngine } from "./core";
import { CanvasSettings } from "./core/SettingsManager";
import { ShapeName } from "./shapes/base";
import { ConnectorType } from "./shapes/connectors";
import { FreehandMarkerType } from "./shapes/freehand";
import type { ColorPalette } from "./consts/colorPalettes";

export interface CanvasUIProps {
  // Engine & Core State
  engine: InteractionEngine;
  uiTheme: "light" | "dark";
  containerRef: RefObject<HTMLDivElement | null>;
  
  // Diagram metadata (simplified, no workspace concepts)
  filename: string;
  setFilename: (name: string) => void;
  menuCategories: MenuCategory[];

  // Injectable header components
  renderBreadcrumb?: (props: { theme: "light" | "dark" }) => React.ReactNode;
  renderUserMenu?: (props: { theme: "light" | "dark" }) => React.ReactNode;

  // Injectable menu items
  topMenuItems?: MenuAction[];
  bottomMenuItems?: MenuAction[];

  // Tools & Selection
  activeTool: string | null;
  selectedShapeType: ShapeName;
  selectedConnectorType: ConnectorType;
  selectedMarkerType: FreehandMarkerType;
  setSelectedShapeType: (type: ShapeName) => void;
  setSelectedConnectorType: (type: ConnectorType) => void;

  // Color Palette
  onTogglePalette?: () => void;
  isPaletteOpen?: boolean;
  onApplyPalette?: (palette: ColorPalette) => void;
  activePaletteId?: string;
  
  // Handlers
  handleIconSelect: (iconName: string) => void;
  handlePencilSelect: (markerType: FreehandMarkerType) => void;
  handleServiceCardSelect: () => void;
  handleTodoCardSelect: () => void;
  handleFrameSelect: () => void;
  handleScrollToContent: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  onViewerModeToggle: () => void;
  
  // UI State
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (isOpen: boolean) => void;
  isPropertiesCardOpen: boolean;
  setIsPropertiesCardOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  propertiesData: PropertiesCardData | null;
  canvasSettings: CanvasSettings;
  isContentVisible: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Context Menu & Styling
  contextMenu: { x: number; y: number } | null;
  setContextMenu: (menu: { x: number; y: number } | null) => void;
  contextMenuOptions: ContextMenuOption[];
  containerRect: DOMRect | null;
  canvasState: CanvasState;
  isDragging: boolean;
  isResizing: boolean;
  setShapesVersion: (updater: (v: number) => number) => void;

  // Access Control
  isReadOnly: boolean;
}
