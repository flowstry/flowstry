import { DiagramManager } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { ConnectorShape } from '../shapes/connectors/base';
import { ResizeHandle } from '../shapes/SelectionOverlay';
import { DiagramTool } from './base';

// Interface for storing connector endpoint data during resize
interface ConnectorStartData {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  startShapeId: string | null;
  endShapeId: string | null;
}

/**
 * ResizeTool handles resizing shapes via resize handles
 */
export class ResizeTool extends DiagramTool {
  private diagramManager: DiagramManager;
  private isResizing: boolean = false;
  private resizeHandle: ResizeHandle = null;
  private resizeStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private resizeStartBounds: { x: number; y: number; width: number; height: number } | null = null;
  private shapeStartPositions: Map<DiagramShape, { x: number; y: number; width: number; height: number }> = new Map();
  private connectorStartData: Map<ConnectorShape, ConnectorStartData> = new Map();
  
  // Callbacks
  private getContainerElement: (() => HTMLDivElement | null) | null = null;
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null;
  private onResizeComplete: (() => void) | null = null;
  private onRecordHistory: (() => void) | null = null;
  private onResizeStateChange: ((isResizing: boolean) => void) | null = null;

  constructor(
    diagramManager: DiagramManager,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    onResizeComplete?: () => void,
    onRecordHistory?: () => void,
    onResizeStateChange?: (isResizing: boolean) => void
  ) {
    super('Resize', 'resize');
    this.diagramManager = diagramManager;
    this.getContainerElement = getContainerElement || null;
    this.getCanvasTransform = getCanvasTransform || null;
    this.onResizeComplete = onResizeComplete || null;
    this.onRecordHistory = onRecordHistory || null;
    this.onResizeStateChange = onResizeStateChange || null;
  }

  public setCallbacks(
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    onResizeComplete: () => void,
    onRecordHistory: () => void,
    onResizeStateChange?: (isResizing: boolean) => void
  ) {
    this.getContainerElement = getContainerElement;
    this.getCanvasTransform = getCanvasTransform;
    this.onResizeComplete = onResizeComplete;
    this.onRecordHistory = onRecordHistory;
    this.onResizeStateChange = onResizeStateChange || null;
  }

  protected onDeactivate(): void {
    // Clean up any ongoing resize
    if (this.isResizing) {
      this.isResizing = false;
      // Notify resize state change
      if (this.onResizeStateChange) {
        this.onResizeStateChange(false);
      }
    }
    this.resizeHandle = null;
    this.resizeStartBounds = null;
    this.shapeStartPositions.clear();
    this.connectorStartData.clear();
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    // Use container element for bounding rect (events fire on container, not SVG)
    const container = this.getContainerElement ? this.getContainerElement() : null;
    const transform = this.getCanvasTransform ? this.getCanvasTransform() : { scale: 1, translation: { x: 0, y: 0 } };
    
    if (!container) return { x: clientX, y: clientY };

    const rect = container.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const worldX = (screenX - transform.translation.x) / transform.scale;
    const worldY = (screenY - transform.translation.y) / transform.scale;

    return { x: worldX, y: worldY };
  }

  /**
   * Check if we clicked on a resize handle
   */
  public getHandleFromEvent(e: PointerEvent | React.PointerEvent): ResizeHandle {
    const overlay = this.diagramManager.getSelectionOverlay();
    if (!overlay) return null;
    
    const handle = overlay.getHandleFromElement(e.target as Element);
    return handle && handle !== 'move' ? handle : null;
  }

  /**
   * Start resizing
   */
  public startResize(handle: ResizeHandle, worldX: number, worldY: number): void {
    if (!handle || handle === 'move') return;

    const overlay = this.diagramManager.getSelectionOverlay();
    if (!overlay) return;

    this.isResizing = true;
    this.resizeHandle = handle;
    this.resizeStartPoint = { x: worldX, y: worldY };
    this.resizeStartBounds = overlay.getBounds();
    
    // Notify resize state change
    if (this.onResizeStateChange) {
      this.onResizeStateChange(true);
    }
    
    // Store initial positions and sizes of all selected shapes
    // For connectors, use getBBox() to get accurate bounds that match the selection overlay
    this.shapeStartPositions.clear();
    this.connectorStartData.clear();

    this.diagramManager.getSelectedShapes().forEach(shape => {
      if (shape.type === 'connector') {
        const connector = shape as ConnectorShape;
        const bbox = shape.layout.getBBox();
        this.shapeStartPositions.set(shape, {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height
        });
        // Store connector endpoint data for special resize handling
        this.connectorStartData.set(connector, {
          startPoint: { ...connector.startPoint },
          endPoint: { ...connector.endPoint },
          startShapeId: connector.startShapeId,
          endShapeId: connector.endShapeId
        });
      } else {
        this.shapeStartPositions.set(shape, {
          x: shape.layout.x,
          y: shape.layout.y,
          width: shape.layout.width,
          height: shape.layout.height
        });
      }
    });
  }

  /**
   * Update resize
   */
  public updateResize(worldX: number, worldY: number): void {
    if (!this.isResizing || !this.resizeStartBounds) return;

    // Check if any selected shape is a square icon
    let hasSquareIcon = false;
    this.shapeStartPositions.forEach((startState, shape) => {
      if ((shape as any).squareIcon === true) {
        hasSquareIcon = true;
      }
    });

    // Calculate new bounds based on resize handle
    const deltaX = worldX - this.resizeStartPoint.x;
    const deltaY = worldY - this.resizeStartPoint.y;
    
    const newBounds = { ...this.resizeStartBounds };
    
    // For square icons, calculate the size change based on the handle direction
    if (hasSquareIcon) {
      let sizeDelta = 0;
      
      // Calculate size change based on which handle is being dragged
      // For square icons, we need to determine how the size should change
      switch (this.resizeHandle) {
        case 'nw':
          // Top-left: size decreases when dragging up/left, use the larger absolute delta
          sizeDelta = -Math.max(Math.abs(deltaX), Math.abs(deltaY));
          break;
        case 'ne':
          // Top-right: size changes based on X (right) and -Y (up)
          // Use the component that increases size (positive deltaX or negative deltaY)
          sizeDelta = Math.max(deltaX, -deltaY);
          break;
        case 'sw':
          // Bottom-left: size changes based on -X (left) and Y (down)
          // Use the component that increases size (negative deltaX or positive deltaY)
          sizeDelta = Math.max(-deltaX, deltaY);
          break;
        case 'se':
          // Bottom-right: size increases when dragging down/right
          // Use the larger of the two deltas (both should be positive for increase)
          sizeDelta = Math.max(deltaX, deltaY);
          break;
        case 'n':
          // Top: size decreases when dragging up
          sizeDelta = -deltaY;
          break;
        case 's':
          // Bottom: size increases when dragging down
          sizeDelta = deltaY;
          break;
        case 'e':
          // Right: size increases when dragging right
          sizeDelta = deltaX;
          break;
        case 'w':
          // Left: size decreases when dragging left
          sizeDelta = -deltaX;
          break;
      }
      
      // Calculate new square size from the original start size
      const newSize = Math.max(15, this.resizeStartBounds.width + sizeDelta);
      
      // Adjust position based on which handle is being dragged to maintain anchor point
      switch (this.resizeHandle) {
        case 'nw':
          // Top-left: adjust both x and y to keep top-left corner fixed
          newBounds.x = this.resizeStartBounds.x + (this.resizeStartBounds.width - newSize);
          newBounds.y = this.resizeStartBounds.y + (this.resizeStartBounds.height - newSize);
          break;
        case 'n':
          // Top: adjust y and x to keep top edge centered
          newBounds.y = this.resizeStartBounds.y + (this.resizeStartBounds.height - newSize);
          newBounds.x = this.resizeStartBounds.x + (this.resizeStartBounds.width - newSize) / 2;
          break;
        case 'ne':
          // Top-right: adjust y, keep right edge (x stays same)
          newBounds.y = this.resizeStartBounds.y + (this.resizeStartBounds.height - newSize);
          break;
        case 'w':
          // Left: adjust x, keep left edge, center vertically
          newBounds.x = this.resizeStartBounds.x + (this.resizeStartBounds.width - newSize);
          newBounds.y = this.resizeStartBounds.y + (this.resizeStartBounds.height - newSize) / 2;
          break;
        case 'e':
          // Right: keep right edge (x stays same), center vertically
          newBounds.y = this.resizeStartBounds.y + (this.resizeStartBounds.height - newSize) / 2;
          break;
        case 'sw':
          // Bottom-left: adjust x, keep bottom edge (y stays same)
          newBounds.x = this.resizeStartBounds.x + (this.resizeStartBounds.width - newSize);
          break;
        case 's':
          // Bottom: keep bottom edge (y stays same), center horizontally
          newBounds.x = this.resizeStartBounds.x + (this.resizeStartBounds.width - newSize) / 2;
          break;
        case 'se':
          // Bottom-right: keep bottom-right corner (x and y stay same)
          break;
      }
      
      newBounds.width = newSize;
      newBounds.height = newSize;
    } else {
      // Non-square icons: calculate bounds normally
      switch (this.resizeHandle) {
        case 'nw':
          newBounds.x = this.resizeStartBounds.x + deltaX;
          newBounds.y = this.resizeStartBounds.y + deltaY;
          newBounds.width = this.resizeStartBounds.width - deltaX;
          newBounds.height = this.resizeStartBounds.height - deltaY;
          break;
        case 'n':
          newBounds.y = this.resizeStartBounds.y + deltaY;
          newBounds.height = this.resizeStartBounds.height - deltaY;
          break;
        case 'ne':
          newBounds.y = this.resizeStartBounds.y + deltaY;
          newBounds.width = this.resizeStartBounds.width + deltaX;
          newBounds.height = this.resizeStartBounds.height - deltaY;
          break;
        case 'w':
          newBounds.x = this.resizeStartBounds.x + deltaX;
          newBounds.width = this.resizeStartBounds.width - deltaX;
          break;
        case 'e':
          newBounds.width = this.resizeStartBounds.width + deltaX;
          break;
        case 'sw':
          newBounds.x = this.resizeStartBounds.x + deltaX;
          newBounds.y = this.resizeStartBounds.y;
          newBounds.width = this.resizeStartBounds.width - deltaX;
          newBounds.height = this.resizeStartBounds.height + deltaY;
          break;
        case 's':
          newBounds.height = this.resizeStartBounds.height + deltaY;
          break;
        case 'se':
          newBounds.width = this.resizeStartBounds.width + deltaX;
          newBounds.height = this.resizeStartBounds.height + deltaY;
          break;
      }
      
      // Handle flipping (like drawing tool does)
      const minSize = 15; // One grid spacing
      
      // Flip horizontally if width is negative
      if (newBounds.width < 0) {
        newBounds.x = newBounds.x + newBounds.width;
        newBounds.width = Math.abs(newBounds.width);
      }
      // Flip vertically if height is negative
      if (newBounds.height < 0) {
        newBounds.y = newBounds.y + newBounds.height;
        newBounds.height = Math.abs(newBounds.height);
      }
      
      // Ensure minimum size
      newBounds.width = Math.max(minSize, newBounds.width);
      newBounds.height = Math.max(minSize, newBounds.height);
    }
    
    // Calculate scale factors
    const scaleX = newBounds.width / this.resizeStartBounds.width;
    const scaleY = newBounds.height / this.resizeStartBounds.height;
    
    // Resize all selected shapes proportionally
    this.shapeStartPositions.forEach((startState, shape) => {
      // Special handling for connectors: only move free endpoints
      if (shape.type === 'connector') {
        const connector = shape as ConnectorShape;
        const connectorData = this.connectorStartData.get(connector);
        if (!connectorData) return;

        // For each endpoint, calculate new position only if it's free (not connected to a shape)
        // Connected endpoints stay in their original position (they're anchored to shapes)

        if (!connectorData.startShapeId) {
          // Start point is free - move it proportionally with the bounding box
          const startRelX = (connectorData.startPoint.x - this.resizeStartBounds!.x) / this.resizeStartBounds!.width;
          const startRelY = (connectorData.startPoint.y - this.resizeStartBounds!.y) / this.resizeStartBounds!.height;
          const newStartX = newBounds.x + (startRelX * newBounds.width);
          const newStartY = newBounds.y + (startRelY * newBounds.height);
          connector.setStartPoint(newStartX, newStartY);
        }
        // If connected, don't move - it stays where it is (anchored to shape)

        if (!connectorData.endShapeId) {
          // End point is free - move it proportionally with the bounding box
          const endRelX = (connectorData.endPoint.x - this.resizeStartBounds!.x) / this.resizeStartBounds!.width;
          const endRelY = (connectorData.endPoint.y - this.resizeStartBounds!.y) / this.resizeStartBounds!.height;
          const newEndX = newBounds.x + (endRelX * newBounds.width);
          const newEndY = newBounds.y + (endRelY * newBounds.height);
          connector.setEndPoint(newEndX, newEndY);
        }
        // If connected, don't move - it stays where it is (anchored to shape)

        // Trigger re-render to update the path
        connector.state.needsRender = true;
        connector.render();
        return; // Skip the normal resize logic for connectors
      }

      const isSquareIcon = (shape as any).squareIcon === true;
      
      // Calculate relative position within the original bounds
      const relX = (startState.x - this.resizeStartBounds!.x) / this.resizeStartBounds!.width;
      const relY = (startState.y - this.resizeStartBounds!.y) / this.resizeStartBounds!.height;
      
      // Calculate new position and size
      let newX = newBounds.x + (relX * newBounds.width);
      let newY = newBounds.y + (relY * newBounds.height);
      let newWidth = startState.width * scaleX;
      let newHeight = startState.height * scaleY;
      
      // For square icons, use the square size from newBounds and adjust position
      if (isSquareIcon) {
        // Use the square size from the bounding box calculation
        const squareSize = newBounds.width; // width and height are the same for square
        newWidth = squareSize;
        newHeight = squareSize;
        
        // Calculate position based on relative position within bounds
        // For square icons, we maintain the shape's relative position within the square bounding box
        const relX = (startState.x - this.resizeStartBounds!.x) / this.resizeStartBounds!.width;
        const relY = (startState.y - this.resizeStartBounds!.y) / this.resizeStartBounds!.height;
        
        newX = newBounds.x + (relX * squareSize);
        newY = newBounds.y + (relY * squareSize);
      }
      
      // Use snapped resize (ImageShape.resize will enforce square if squareIcon is true)
      this.diagramManager.resizeShapeSnapped(shape, newX, newY, newWidth, newHeight);
      
      // Update text (including text editor if active)
      this.diagramManager.updateShapeText(shape);
    });
    
    // Update selection overlay
    this.diagramManager.updateSelectionOverlay();
  }

  /**
   * End resize
   */
  public endResize(): void {
    if (!this.isResizing) return;

    // Cleanup bent connector collinear points for all resized shapes
    // This removes redundant points after shape resize
    this.shapeStartPositions.forEach((startState, shape) => {
      this.diagramManager.cleanupConnectedConnectors(shape);
    });

    // Check frame containment after resize
    // When a frame is resized, shapes may enter or leave it
    // When a shape is resized, it may enter or leave a frame
    this.shapeStartPositions.forEach((startState, shape) => {
      if (shape.type === 'frame') {
        // Frame was resized - check all shapes for containment updates
        this.diagramManager.updateAllFrameContainments();
      } else {
        // Regular shape was resized - check if it should be in a frame
        this.diagramManager.autoAssignToFrame(shape);
      }
    });

    this.isResizing = false;
    this.resizeHandle = null;
    this.resizeStartBounds = null;
    this.shapeStartPositions.clear();
    this.connectorStartData.clear();

    // Notify resize state change
    if (this.onResizeStateChange) {
      this.onResizeStateChange(false);
    }

    // Record history after resize completes
    if (this.onRecordHistory) {
      this.onRecordHistory();
    }

    if (this.onResizeComplete) {
      this.onResizeComplete();
    }
  }

  /**
   * Cancel resize
   */
  public cancelResize(): void {
    if (!this.isResizing) return;

    // Restore original positions and sizes
    this.shapeStartPositions.forEach((startState, shape) => {
      // Special handling for connectors: restore original endpoints
      if (shape.type === 'connector') {
        const connector = shape as ConnectorShape;
        const connectorData = this.connectorStartData.get(connector);
        if (connectorData) {
          connector.setStartPoint(connectorData.startPoint.x, connectorData.startPoint.y);
          connector.setEndPoint(connectorData.endPoint.x, connectorData.endPoint.y);
          connector.state.needsRender = true;
          connector.render();
        }
      } else {
        shape.layout.resize(startState.x, startState.y, startState.width, startState.height);
        this.diagramManager.updateShapeText(shape);
      }
    });
    
    this.diagramManager.updateSelectionOverlay();
    
    this.isResizing = false;
    this.resizeHandle = null;
    this.resizeStartBounds = null;
    this.shapeStartPositions.clear();
    this.connectorStartData.clear();

    // Notify resize state change
    if (this.onResizeStateChange) {
      this.onResizeStateChange(false);
    }
  }

  public isCurrentlyResizing(): boolean {
    return this.isResizing;
  }

  // Default event handlers (this tool is typically used programmatically by SelectTool)
  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    return false;
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    return false;
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    return false;
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    return false;
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false;
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false;
  }
}

