import { GRID_SPACING } from '../consts/canvas';
import { EdgePanManager } from '../core/EdgePanManager';
import { DiagramManager } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { ConnectorShape } from '../shapes/connectors';
import { FrameShape } from '../shapes/FrameShape';
import { DiagramTool } from './base';

/**
 * DragTool handles moving/dragging shapes
 */
export class DragTool extends DiagramTool {
  private diagramManager: DiagramManager;
  private isDragging: boolean = false;
  private dragStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private draggedShapes: DiagramShape[] = [];
  private shapeStartPositions: Map<DiagramShape, { x: number; y: number; width: number; height: number }> = new Map();
  // Store original connector points for proper drag handling
  private connectorStartPoints: Map<ConnectorShape, {
    start: { x: number; y: number };
    end: { x: number; y: number };
    customMidpoint?: { x: number; y: number } | null;
  }> = new Map();
  
  // Track last pointer position for edge panning
  // private lastPointerX: number = 0;
  // private lastPointerY: number = 0;
  
  // Callbacks
  private getContainerElement: (() => HTMLDivElement | null) | null = null;
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null;
  private onDragComplete: (() => void) | null = null;
  private getEdgePanManager: (() => EdgePanManager) | null = null;
  private onRecordHistory: (() => void) | null = null;
  private onDragStateChange: ((isDragging: boolean) => void) | null = null;

  constructor(
    diagramManager: DiagramManager,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    onDragComplete?: () => void,
    getEdgePanManager?: () => EdgePanManager,
    onRecordHistory?: () => void,
    onDragStateChange?: (isDragging: boolean) => void
  ) {
    super('Drag', 'move');
    this.diagramManager = diagramManager;
    this.getContainerElement = getContainerElement || null;
    this.getCanvasTransform = getCanvasTransform || null;
    this.onDragComplete = onDragComplete || null;
    this.getEdgePanManager = getEdgePanManager || null;
    this.onRecordHistory = onRecordHistory || null;
    this.onDragStateChange = onDragStateChange || null;
  }

  public setCallbacks(
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    onDragComplete: () => void,
    getEdgePanManager: () => EdgePanManager,
    onRecordHistory: () => void,
    onDragStateChange: (isDragging: boolean) => void
  ) {
    this.getContainerElement = getContainerElement;
    this.getCanvasTransform = getCanvasTransform;
    this.onDragComplete = onDragComplete;
    this.getEdgePanManager = getEdgePanManager;
    this.onRecordHistory = onRecordHistory;
    this.onDragStateChange = onDragStateChange;
  }

  protected onDeactivate(): void {
    // Clean up any ongoing drag - restore original positions
    if (this.isDragging) {
      this.draggedShapes.forEach(shape => {
        const startPos = this.shapeStartPositions.get(shape);
        if (startPos) {
          shape.layout.resize(startPos.x, startPos.y, startPos.width, startPos.height);
          this.diagramManager.updateShapeText(shape);
        }
      });
      this.diagramManager.updateSelectionOverlay();
    }
    
    this.isDragging = false;
    this.draggedShapes = [];
    this.shapeStartPositions.clear();
  }



  private snapToGrid(value: number): number {
    // Only snap if snapToGrid is enabled
    if (!this.diagramManager.getSnapToGrid()) {
      return value;
    }
    // Snap to grid dots which are at GRID_SPACING/2, GRID_SPACING/2 + GRID_SPACING, etc.
    const offset = GRID_SPACING / 2;
    return Math.round((value - offset) / GRID_SPACING) * GRID_SPACING + offset;
  }

  /**
   * Check if we should start dragging (called by other tools like SelectTool)
   */
  public canStartDrag(worldX: number, worldY: number): boolean {
    const selectedShapes = this.diagramManager.getSelectedShapes();
    if (selectedShapes.length === 0) return false;

    // Check if clicking inside selection bounds
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedShapes.forEach(shape => {
      const bbox = shape.layout.getBBox();
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY;
  }

  /**
   * Start dragging selected shapes
   */
  public startDrag(worldX: number, worldY: number, clientX?: number, clientY?: number): void {
    this.isDragging = true;
    this.dragStartPoint = { x: worldX, y: worldY };
    this.draggedShapes = this.diagramManager.getSelectedShapes();
    
    // Store last pointer position
    if (clientX !== undefined && clientY !== undefined) {
      // this.lastPointerX = clientX;
      // this.lastPointerY = clientY;
      
      // Start edge panning
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.start(clientX, clientY);
      }
    }
    
    // Store initial positions
    this.shapeStartPositions.clear();
    this.draggedShapes.forEach(shape => {
      this.shapeStartPositions.set(shape, {
        x: shape.layout.x,
        y: shape.layout.y,
        width: shape.layout.width,
        height: shape.layout.height
      });

      // For connectors, also store the actual startPoint/endPoint and customMidpoint
      if (shape.type === 'connector') {
        const connector = shape as ConnectorShape;
        // Check if this is a curved connector with custom midpoint
        const curvedConnector = connector as any;
        const customMidpoint = curvedConnector.midpointMode === 'custom' && curvedConnector.customMidpoint
          ? { x: curvedConnector.customMidpoint.x, y: curvedConnector.customMidpoint.y }
          : null;

        this.connectorStartPoints.set(connector, {
          start: { x: connector.startPoint.x, y: connector.startPoint.y },
          end: { x: connector.endPoint.x, y: connector.endPoint.y },
          customMidpoint
        });
      }
    });

    if (this.onDragStateChange) {
      this.onDragStateChange(true);
    }
  }

  /**
   * Update pointer position for edge panning
   */
  public updatePointer(clientX: number, clientY: number): void {
    // this.lastPointerX = clientX;
    // this.lastPointerY = clientY;
    
    if (this.isDragging) {
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.updatePointer(clientX, clientY);
      }
    }
  }

  /**
   * Update drag position
   */
  public updateDrag(worldX: number, worldY: number): void {
    if (!this.isDragging) return;

    // Calculate the delta from the start point
    const rawDeltaX = worldX - this.dragStartPoint.x;
    const rawDeltaY = worldY - this.dragStartPoint.y;

    this.draggedShapes.forEach(shape => {
      const startPos = this.shapeStartPositions.get(shape);
      if (startPos) {
        // Calculate new position with delta
        const newX = startPos.x + rawDeltaX;
        const newY = startPos.y + rawDeltaY;
        
        // Snap to grid (but not for freehand shapes - they should move freely)
        const shouldSnap = shape.type !== 'freehand';
        const snappedX = shouldSnap ? this.snapToGrid(newX) : newX;
        const snappedY = shouldSnap ? this.snapToGrid(newY) : newY;
        
        // Calculate delta for connector updates
        const dx = snappedX - shape.layout.x;
        const dy = snappedY - shape.layout.y;
        
        // Handle connectors specially - move their points directly
        // Only move FREE endpoints (not connected to any shape)
        // Connected endpoints will be handled by updateConnectorsForShape()
        // when their connected shapes move
        if (shape.type === 'connector') {
          const connector = shape as ConnectorShape;
          const origPoints = this.connectorStartPoints.get(connector);
          if (origPoints) {
            // Calculate delta from original start position
            const connectorDx = snappedX - startPos.x;
            const connectorDy = snappedY - startPos.y;

            // Check which endpoints are free (not connected to any shape)
            const startFree = !connector.startShapeId;
            const endFree = !connector.endShapeId;

            // Only move free endpoints - connected endpoints stay anchored
            if (startFree) {
              connector.startPoint.x = origPoints.start.x + connectorDx;
              connector.startPoint.y = origPoints.start.y + connectorDy;
            }
            if (endFree) {
              connector.endPoint.x = origPoints.end.x + connectorDx;
              connector.endPoint.y = origPoints.end.y + connectorDy;
            }

            // Also move custom midpoint for curved connectors if at least one endpoint is free
            if (origPoints.customMidpoint && (startFree || endFree)) {
              const curvedConnector = connector as any;
              if (curvedConnector.customMidpoint) {
                curvedConnector.customMidpoint.x = origPoints.customMidpoint.x + connectorDx;
                curvedConnector.customMidpoint.y = origPoints.customMidpoint.y + connectorDy;
              }
            }

            connector.state.needsRender = true;
          }
        } else if (shape.type === 'frame') {
          // For frames, move the frame AND all its children
          const frame = shape as FrameShape;
          frame.layout.resize(snappedX, snappedY, startPos.width, startPos.height);

          // Move frame children using the delta
          this.diagramManager.moveFrameChildren(frame, dx, dy);
        } else {
          // Update shape position directly (no transform needed)
          shape.layout.resize(snappedX, snappedY, startPos.width, startPos.height);

          // Update frame highlight for non-frame shapes
          this.diagramManager.updateFrameHighlightForDrag(shape);
        }

        this.diagramManager.updateShapeText(shape);
        
        // Update connectors attached to this shape (only for non-connectors)
        if (shape.type !== 'connector') {
          this.diagramManager.updateConnectorsForShape(shape, dx, dy);
        }
      }
    });
    
    // Update the selection overlay to match snapped positions
    this.diagramManager.updateSelectionOverlay();
  }

  /**
   * End drag and finalize positions
   */
  public endDrag(worldX: number, worldY: number): void {
    if (!this.isDragging) return;

    // Shapes are already at their final snapped positions from updateDrag
    // Just update the selection overlay one final time
    this.diagramManager.updateSelectionOverlay();
    
    // Handle frame auto-attach/detach for non-frame shapes
    this.draggedShapes.forEach(shape => {
      if (shape.type !== 'connector' && shape.type !== 'frame') {
        // Check if shape should be detached from current frame
        this.diagramManager.detachIfOutside(shape);
        // If not in a frame, check if it should be auto-attached
        if (!shape.parentId) {
          this.diagramManager.autoAssignToFrame(shape);
        }
      } else if (shape.type === 'frame') {
        // Frame was dragged - shapes may enter or leave it
        this.diagramManager.updateAllFrameContainments();
      }
    });

    // Clear frame highlight
    this.diagramManager.clearFrameHighlight();

    // Cleanup bent connector collinear points for all dragged shapes
    // This removes redundant points after shape movement
    this.draggedShapes.forEach(shape => {
      if (shape.type !== 'connector') {
        this.diagramManager.cleanupConnectedConnectors(shape);
      }
    });

    this.isDragging = false;
    this.draggedShapes = [];
    this.shapeStartPositions.clear();
    this.connectorStartPoints.clear();

    // Stop edge panning
    const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
    if (edgePanManager) {
      edgePanManager.stop();
    }

    // Record history after drag completes
    if (this.onRecordHistory) {
      this.onRecordHistory();
    }

    if (this.onDragComplete) {
      this.onDragComplete();
    }

    if (this.onDragStateChange) {
      this.onDragStateChange(false);
    }
  }

  /**
   * Cancel drag without finalizing
   */
  public cancelDrag(): void {
    if (!this.isDragging) return;

    // Restore original positions
    this.draggedShapes.forEach(shape => {
      const startPos = this.shapeStartPositions.get(shape);
      if (startPos) {
        shape.layout.resize(startPos.x, startPos.y, startPos.width, startPos.height);
        this.diagramManager.updateShapeText(shape);
      }
    });
    this.diagramManager.updateSelectionOverlay();
    
    // Clear frame highlight
    this.diagramManager.clearFrameHighlight();

    this.isDragging = false;
    this.draggedShapes = [];
    this.shapeStartPositions.clear();
    this.connectorStartPoints.clear();

    // Stop edge panning
    const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
    if (edgePanManager) {
      edgePanManager.stop();
    }

    if (this.onDragStateChange) {
      this.onDragStateChange(false);
    }
  }

  public isCurrentlyDragging(): boolean {
    return this.isDragging;
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

