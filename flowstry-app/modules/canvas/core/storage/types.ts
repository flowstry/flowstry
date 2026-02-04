
import { CanvasSettings } from '../SettingsManager';

export interface DiagramData {
  version: string;
  name?: string; // Diagram name
  shapes: ShapeData[];
  groups?: Record<string, { parentId: string | null }>; // Logical groups registry
  settings?: CanvasSettings;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
  };
}

// -----------------------------------------------------------------------------
// 1️⃣ Base Types & Mixins
// -----------------------------------------------------------------------------

export type ShapeType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'triangle-down'
  | 'triangle-right'
  | 'triangle-left'
  | 'hexagon'
  | 'pentagon'
  | 'octagon'
  | 'image'
  | 'connector'
  | 'freehand'
  | 'frame'
  | 'service-card' // Keeping legacy specific names if needed for type matching, or map to 'react'
  | 'todo-card';   // Keeping legacy specific names if needed for type matching, or map to 'react'

export interface BaseShape<TIntent = unknown, TLayout = ShapeLayoutData> {
  id: string;
  type: ShapeType;

  intent: TIntent;    // Logical data (what it is)
  layout: TLayout;    // Spatial data (where it is)
  appearance: ShapeAppearanceData; // Visual styles (how it looks)

  options?: Record<string, any>; // Extensibility
}

export interface ShapeLayoutData {
  x: number;
  y: number;
  width: number;
  height: number;

  parentId?: string | null; // Group ID
  frameId?: string | null;  // Frame ID
}

export interface ShapeAppearanceData extends FillStyle, StrokeStyle, TextStyle {
  opacity?: number; // Global opacity if needed
  fillDrawStyle?: 'standard' | 'handdrawn';
  strokeDrawStyle?: 'standard' | 'handdrawn';
  drawStyle?: 'standard' | 'handdrawn'; // @deprecated Use fillDrawStyle and strokeDrawStyle instead
}

// --- Mixins ---

export interface FillStyle {
  fill?: string;
  fillOpacity?: number;
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none';
}

export interface StrokeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
}

export interface TextStyle {
  text?: string;        // Text content is often inextricably linked to appearance in resizing logic, but ideally fits in Intent. 
  // However, for consistency with the user plan, we'll keep text specific props here if they are purely style.
  // Wait, the user plan had `text` in `TextStyle` mixin but ALSO in `ShapeIntent`.
  // Text content is Intent. Font size/color is Appearance.
  // I will put CONTENT in Intent, and STYLE in Appearance.
  // BUT, to satisfy `TextStyle` mixin request:
  // text?: string;     // <-- Moving actual content to Intent

  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right';
  textJustify?: 'top' | 'middle' | 'bottom';
}

// -----------------------------------------------------------------------------
// 2️⃣ Concrete Shape Intents & Layouts
// -----------------------------------------------------------------------------

// --- Rectangle ---
export interface RectangleIntent {
  text?: string;
  iconKey?: string | null;
  hasIconPlaceholder?: boolean;
  iconContent?: string | null;
}

export type RectangleShape = BaseShape<RectangleIntent, ShapeLayoutData> & {
  type: 'rectangle';
};

// --- Geometric (Ellipse, Diamond, Polygons) ---
// These are simpler than rectangle (no icons usually)
export interface GeometricIntent {
  text?: string;
}

export type GeometricShapeType =
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'triangle-down'
  | 'triangle-right'
  | 'triangle-left'
  | 'hexagon'
  | 'pentagon'
  | 'octagon';

export type GeometricShape = BaseShape<GeometricIntent, ShapeLayoutData> & {
  type: GeometricShapeType;
};

// --- Image ---
export interface ImageIntent {
  imageUrl: string;
  imageName?: string;
  squareIcon?: boolean;
  // text field often reused for title in older model, mapping it here if needed
  text?: string;
}

export type ImageShape = BaseShape<ImageIntent, ShapeLayoutData> & {
  type: 'image';
};

// --- Freehand ---
export interface FreehandIntent {
  points: Array<{ x: number; y: number }>;
  markerType?: 'brush' | 'pen' | 'pencil' | 'highlighter';
}

export type FreehandShape = BaseShape<FreehandIntent, ShapeLayoutData> & {
  type: 'freehand';
};

// --- Frame ---
export interface FrameIntent {
  labelText?: string; // Frames use 'labelText' instead of 'text' usually
  collapsed?: boolean;
  isNestedFrame?: boolean;
  childIds?: string[];
  childFrameIds?: string[];

  iconContent?: string;
  hasIconPlaceholder?: boolean;
}

export type FrameShape = BaseShape<FrameIntent, ShapeLayoutData> & {
  type: 'frame';
};

// --- Connector ---
export type ConnectorType = 'straight' | 'bent' | 'curved';
export type ArrowheadType =
  | 'none'
  | 'open-arrow'
  | 'filled-triangle'
  | 'hollow-triangle'
  | 'hollow-diamond'
  | 'filled-diamond'
  | 'circle'
  | 'filled-circle'
  | 'bar'
  | 'half-arrow-top'
  | 'half-arrow-bottom'
  | 'crows-foot-one'
  | 'crows-foot-many'
  | 'crows-foot-zero-one'
  | 'crows-foot-zero-many'
  | 'crows-foot-one-many';

export interface ConnectorIntent {
  text?: string; // Labels on connectors
  startShapeId?: string | null;
  endShapeId?: string | null;

  startConnectorPoint?: 'top' | 'bottom' | 'left' | 'right' | null;
  endConnectorPoint?: 'top' | 'bottom' | 'left' | 'right' | null;

  startArrowheadType?: ArrowheadType;
  endArrowheadType?: ArrowheadType;

  animated?: boolean;
  labelPosition?: number;
}

// Connector Layout is complex (routing points, etc.)
export interface ConnectorLayout extends ShapeLayoutData {
  connectorType: ConnectorType;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };

// Point arrays for each type (mutually exclusive usually, but stored flat previously)
  pointsStraight?: Array<{ x: number; y: number; fixedX?: boolean; fixedY?: boolean }>;
  pointsBent?: Array<{
    x: number;
    y: number;
    fixedX?: boolean;
    fixedY?: boolean;
    direction?: 'top' | 'bottom' | 'left' | 'right';
    startPrimary?: boolean;
    startSecondary?: boolean;
    endSecondary?: boolean;
    endPrimary?: boolean;
  }>;
  pointsCurved?: Array<{ x: number; y: number } | { x: number; y: number }>;

  // Routing flags
  hasUserModifiedPath?: boolean;
  bentConnectorRoutingMode?: 'auto' | 'manual';
  bentConnectorSegments?: Array<{
    axis: 'x' | 'y';
    value: number;
    start: number;
    end: number;
    locked: boolean;
  }>;

  // Curved specific
  midpointMode?: 'auto' | 'custom';
  midpointRatio?: number;
  midpointOffset?: { dx: number; dy: number };
  customMidpoint?: { x: number; y: number } | null;
}

export type ConnectorShape = BaseShape<ConnectorIntent, ConnectorLayout> & {
  type: 'connector';
};

// --- React (Service Card, etc.) ---
export interface ReactIntent {
  data: Record<string, unknown>;
}

export type ReactShapeType = 'service-card' | 'todo-card' | 'react';

export type ReactShape = BaseShape<ReactIntent, ShapeLayoutData> & {
  type: ReactShapeType;
};

// -----------------------------------------------------------------------------
// 3️⃣ Final Union
// -----------------------------------------------------------------------------

export type ShapeData =
  | RectangleShape
  | GeometricShape
  | ImageShape
  | ConnectorShape
  | FreehandShape
  | FrameShape
  | ReactShape;

export interface SaveOptions {
  autoSave?: boolean;
  metadata?: Record<string, any>;
}

export interface LoadOptions {
  merge?: boolean; // If true, merge with existing shapes instead of replacing
}
