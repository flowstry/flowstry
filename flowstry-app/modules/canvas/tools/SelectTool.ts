import { EdgePanManager } from '../core/EdgePanManager';
import { DiagramManager, QuickConnectSide } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { ConnectorShape } from '../shapes/connectors';
import { BentConnector } from '../shapes/connectors/bent/BentConnector';
import { FrameShape } from '../shapes/FrameShape';
import { DiagramTool } from './base';
import { ConnectorDragTool } from './ConnectorDragTool';
import { DragTool } from './DragTool';
import { ResizeTool } from './ResizeTool';
import { TextEditTool } from './TextEditTool';

/**
 * SelectTool handles selecting and deselecting shapes via clicking and marquee selection
 */
export class SelectTool extends DiagramTool {
  private diagramManager: DiagramManager;
  
  // Marquee selection
  private isMarqueeSelecting: boolean = false;
  private marqueeStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private marqueeElement: SVGRectElement | null = null;
  
  // Click tracking for text editing
  private clickedShape: DiagramShape | null = null;
  private clickedShapeWasSelected: boolean = false;
  private clickedOnReadyText: boolean = false;
  private clickedOnReadyIcon: boolean = false;
  private clickedOnTextElement: boolean = false; // Track if we actually clicked on the text element (not just the shape)
  private pointerMoved: boolean = false;
  private clickThreshold: number = 5; // pixels to distinguish click from drag
  private initialPointerPos: { x: number; y: number } = { x: 0, y: 0 };
  
  // Double-click tracking for auto-fit text on resize handles
  private clickCount: number = 0;
  private lastClickTime: number = 0;
  private lastClickedHandle: string | null = null;
  private lastClickPosition: { x: number; y: number } | null = null;
  private doubleClickTimeout: number = 300; // milliseconds
  private clickTimeoutId: number | null = null;
  
  // Double-click tracking for bent segment handles (to reset to auto routing)
  private lastBentSegmentClickTime: number = 0;
  private lastBentSegmentConnector: BentConnector | null = null;

  // Double-click tracking for group focus (shift focus to individual shape)
  private lastGroupClickTime: number = 0;
  private lastGroupClickShapeId: string | null = null;

  // Double-click tracking for frame label editing
  private lastFrameLabelClickTime: number = 0;
  private lastFrameLabelFrame: FrameShape | null = null;

  // Track handle click on unselected connector (to start dragging if user moves)
  private pendingHandleDrag: { connector: ConnectorShape; handle: 'start' | 'end' | 'midpoint' } | null = null;
  
  // Track connector label drag
  private pendingLabelDrag: ConnectorShape | null = null;
  private isDraggingLabel: boolean = false;
  private initialLabelPosition: number = 0.5;
  // Track if we clicked on connector text (for deciding if we should edit on pointer up)
  private clickedOnConnectorText: boolean = false;
  private connectorTextWasSelected: boolean = false;

  // Track pending multi-select click (needs resolution on pointer up if no drag)
  private pendingMultiSelectClick: boolean = false;

  // Keyboard quick connect state
  private isKeyboardQuickConnectMode: boolean = false;
  private keyboardQuickConnectSide: QuickConnectSide | null = null;
  private keyboardQuickConnectCount: number = 0;

  // Sub-tools for complex interactions
  private dragTool: DragTool;
  private resizeTool: ResizeTool;
  private textEditTool: TextEditTool;
  private connectorDragTool: ConnectorDragTool;

  // Locked shapes (selected by other users)
  private lockedShapeIds: Set<string> = new Set();

  public setLockedShapeIds(ids: string[]): void {
    this.lockedShapeIds = new Set(ids);
  }

  public getTextEditTool(): TextEditTool {
    return this.textEditTool;
  }
  
  // Callbacks
  private getSvgElement: (() => SVGSVGElement | null) | null = null;
  private getContainerElement: (() => HTMLDivElement | null) | null = null;
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null;
  private getContentLayer: (() => SVGGElement | null) | null = null;
  private onSelectionChange: (() => void) | null = null;
  private getEdgePanManager: (() => EdgePanManager) | null = null;
  private onRecordHistory: (() => void) | null = null;



  constructor(
    diagramManager: DiagramManager,
    getSvgElement?: () => SVGSVGElement | null,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer?: () => SVGGElement | null,
    onSelectionChange?: () => void,
    getEdgePanManager?: () => EdgePanManager,
    onRecordHistory?: () => void
  ) {
    super('Select', 'pointer');
    this.diagramManager = diagramManager;
    this.getSvgElement = getSvgElement || null;
    this.getContainerElement = getContainerElement || null;
    this.getCanvasTransform = getCanvasTransform || null;
    this.getContentLayer = getContentLayer || null;
    this.onSelectionChange = onSelectionChange || null;
    this.getEdgePanManager = getEdgePanManager || null;
    this.onRecordHistory = onRecordHistory || null;
    
    // Initialize sub-tools
    this.dragTool = new DragTool(diagramManager, getContainerElement, getCanvasTransform, onSelectionChange, getEdgePanManager, onRecordHistory);
    this.resizeTool = new ResizeTool(diagramManager, getContainerElement, getCanvasTransform, onSelectionChange, onRecordHistory);
    this.textEditTool = new TextEditTool(diagramManager, onSelectionChange);
    this.connectorDragTool = new ConnectorDragTool(diagramManager, getContainerElement, getCanvasTransform, onRecordHistory);
  }

  public setCallbacks(
    getSvgElement: () => SVGSVGElement | null,
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer: () => SVGGElement | null,
    onSelectionChange: () => void,
    getEdgePanManager: () => EdgePanManager,
    onRecordHistory: () => void,
    onDragStateChange: (isDragging: boolean) => void,
    onResizeStateChange?: (isResizing: boolean) => void
  ) {
    this.getSvgElement = getSvgElement;
    this.getContainerElement = getContainerElement;
    this.getCanvasTransform = getCanvasTransform;
    this.getContentLayer = getContentLayer;
    this.onSelectionChange = onSelectionChange;
    this.getEdgePanManager = getEdgePanManager;
    this.onRecordHistory = onRecordHistory;
    
    // Update sub-tool callbacks
    this.dragTool.setCallbacks(getContainerElement, getCanvasTransform, onSelectionChange, getEdgePanManager, onRecordHistory, onDragStateChange);
    this.resizeTool.setCallbacks(getContainerElement, getCanvasTransform, onSelectionChange, onRecordHistory, onResizeStateChange);
    this.textEditTool.setCallbacks(onSelectionChange);
    this.connectorDragTool.setCallbacks(getContainerElement, getCanvasTransform, getContentLayer, onRecordHistory);
  }

  protected onActivate(): void {
    // Show selection overlay if there are selected shapes
    this.diagramManager.showSelectionOverlay();
  }

  protected onDeactivate(): void {
    // Hide selection overlay when tool is deactivated
    this.diagramManager.hideSelectionOverlay();
    
    // Clear hover state
    this.diagramManager.clearHover();
    
    // Clean up any ongoing interactions
    if (this.isMarqueeSelecting) {
      this.removeMarquee();
      this.isMarqueeSelecting = false;
    }
    
    // Clean up sub-tools
    this.dragTool.cancelDrag();
    this.resizeTool.cancelResize();
    this.connectorDragTool.cancelInteraction();
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
   * Get shape from DOM event target
   * Uses the native SVG event system instead of manual coordinate checking
   */
  private getShapeFromEvent(e: PointerEvent | React.PointerEvent): DiagramShape | null {
    const target = e.target as SVGElement;
    
    // Check if the target or its parent has a shape ID
    let element: Element | null = target;
    while (element && element !== this.getSvgElement?.()) {
      const shapeId = (element as HTMLElement | SVGElement).dataset?.shapeId;
      if (shapeId) {
        const shape = this.diagramManager.getShapeById(shapeId);

        // For connectors, strictly ignore clicks on the group element itself
        // This ensures that even if pointer-events fails, we don't select via the bounding box
        if (shape && shape.type === 'connector' && target === shape.element) {
          return null;
        }

        return shape;
      }
      element = element.parentElement;
    }
    
    return null;
  }

  /**
   * Check if a world position is inside the selection overlay bounds
   */
  private isInsideSelectionOverlay(worldX: number, worldY: number): boolean {
    const selectedShapes = this.diagramManager.getSelectedShapes();
    if (selectedShapes.length === 0) return false;

    // Calculate selection bounds
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

    // Check if point is inside bounds
    // For single connectors, allow dragging from the path itself (not bounding box)
    if (selectedShapes.length === 1 && selectedShapes[0].type === 'connector') {
      // Allow dragging if clicking on the connector path (checked separately in handlePointerDown)
      // But don't allow dragging from bounding box area
      return false;
    }

    return worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY;
  }

  /**
   * Check if a click is on a resize handle (edge or corner)
   * Returns the handle type if clicked on a handle, null otherwise
   */
  private getClickedResizeHandle(e: PointerEvent | React.PointerEvent): string | null {
    const target = e.target as HTMLElement | SVGElement;
    
    // Check if click is on a handle (handles have data-handle attribute)
    const handleElement = target.closest('[data-handle]');
    if (handleElement) {
      const handleType = handleElement.getAttribute('data-handle');
      return handleType;
    }
    
    return null;
  }

  private createMarquee(worldX: number, worldY: number): void {
    const contentLayer = this.getContentLayer ? this.getContentLayer() : null;
    if (!contentLayer) return;

    // Create marquee rectangle
    this.marqueeElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.marqueeElement.setAttribute('fill', 'rgba(59, 130, 246, 0.1)'); // Light blue transparent
    this.marqueeElement.setAttribute('stroke', 'rgb(59, 130, 246)'); // Blue stroke
    this.marqueeElement.setAttribute('stroke-width', '1');
    this.marqueeElement.setAttribute('pointer-events', 'none');
    this.marqueeElement.setAttribute('x', String(worldX));
    this.marqueeElement.setAttribute('y', String(worldY));
    this.marqueeElement.setAttribute('width', '0');
    this.marqueeElement.setAttribute('height', '0');

    contentLayer.appendChild(this.marqueeElement);
  }

  private updateMarquee(currentWorldX: number, currentWorldY: number): void {
    if (!this.marqueeElement) return;

    const startX = this.marqueeStartPoint.x;
    const startY = this.marqueeStartPoint.y;

    // Calculate rectangle bounds (handle dragging in any direction)
    const x = Math.min(startX, currentWorldX);
    const y = Math.min(startY, currentWorldY);
    const width = Math.abs(currentWorldX - startX);
    const height = Math.abs(currentWorldY - startY);

    this.marqueeElement.setAttribute('x', String(x));
    this.marqueeElement.setAttribute('y', String(y));
    this.marqueeElement.setAttribute('width', String(width));
    this.marqueeElement.setAttribute('height', String(height));
  }

  private removeMarquee(): void {
    if (this.marqueeElement) {
      this.marqueeElement.remove();
      this.marqueeElement = null;
    }
  }

  private selectShapesInMarquee(marqueeX: number, marqueeY: number, marqueeWidth: number, marqueeHeight: number, additive: boolean): void {
    const shapes = this.diagramManager.getShapes();
    
    shapes.forEach(shape => {
      const bbox = shape.layout.getBBox();
      
      // Check if shape's bounding box intersects with marquee
      const shapeLeft = bbox.x;
      const shapeRight = bbox.x + bbox.width;
      const shapeTop = bbox.y;
      const shapeBottom = bbox.y + bbox.height;
      
      const marqueeLeft = marqueeX;
      const marqueeRight = marqueeX + marqueeWidth;
      const marqueeTop = marqueeY;
      const marqueeBottom = marqueeY + marqueeHeight;
      
      // Check if there's any overlap
      let overlaps = false;

      if (shape.type === 'connector') {
        overlaps = (shape as ConnectorShape).intersectsRect({
          x: marqueeLeft,
          y: marqueeTop,
          width: marqueeWidth,
          height: marqueeHeight
        });
      } else {
        overlaps = !(
          shapeRight < marqueeLeft ||
          shapeLeft > marqueeRight ||
          shapeBottom < marqueeTop ||
          shapeTop > marqueeBottom
        );
      }
      
      if (overlaps) {
        if (!shape.state.selected && !this.lockedShapeIds.has(shape.id)) {
          this.diagramManager.selectShape(shape);
        }
      } else if (!additive) {
        // If not additive selection, deselect shapes not in marquee
        this.diagramManager.deselectShape(shape);
      }
    });

    // If any shape in a group is selected, ensure all shapes in that group are selected
    this.diagramManager.expandSelectionToIncludeFullGroups();
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isActive() || e.button !== 0) return false;

    this.clickedOnReadyIcon = false;

    // Reset icon editing state for all shapes on any click (unless we hit the icon itself, handled later)
    // We do this first to ensure clean state
    const allShapes = this.diagramManager.getShapes();
    let madeChange = false;
    allShapes.forEach(s => {
      if ((s.type === 'rectangle' || s.type === 'frame') && (s as any).isIconEditing) {
        (s as any).isIconEditing = false;
        s.render();
        madeChange = true;
      }
    });

    // Check if we're clicking on the text editor FIRST (before preventDefault)
    const target = e.target as HTMLElement;
    if (target.closest('[data-text-editor]')) {
      // Clicking inside text editor - do nothing, let browser handle text selection
      // DON'T call preventDefault so textarea can handle the event normally
      return false; // Let the event bubble normally
    }

    // Check if we're clicking on a quick connect dot
    // These handle their own click events for the quick connect feature
    if (target.closest('[data-quick-connect]')) {
      // Let the quick connect dot handle the event
      return false;
    }

    // Check if clicking on icon placeholder OR existing icon hit area
    if (target.classList.contains('icon-placeholder-hit') || target.closest('.icon-placeholder-hit') ||
      target.classList.contains('icon-hit-area') || target.closest('.icon-hit-area') ||
      target.classList.contains('icon-element') || target.closest('.icon-element')) {
      // Find the shape associated with this placeholder/icon
      // The placeholder is inside the shape's group, so we can walk up/use getShapeFromEvent
      // But getShapeFromEvent might rely on the main shape hit test.
      // Let's rely on the fact that we clicked the placeholder which is part of the shape's DOM.
      let element: Element | null = target;
      let shapeId: string | null = null;
      while (element && element !== this.getSvgElement?.()) {
        if ((element as HTMLElement).dataset?.shapeId) {
          shapeId = (element as HTMLElement).dataset.shapeId!;
          break;
        }
        element = element.parentElement;
      }

      if (shapeId) {
        const shape = this.diagramManager.getShapeById(shapeId);
        if (shape && (shape.type === 'rectangle' || shape.type === 'frame')) {
          // Only mark as ready for icon editing if ALREADY selected
          // If not selected, standard logic will select it
          if (shape.state.selected) {
            this.clickedOnReadyIcon = true;
          }
        }
      }
    }

    // Check if we're clicking on interactive elements inside a ServiceCard
    // This includes buttons, inputs, and other clickable elements within the React component
    const serviceCardForeignObject = target.closest('foreignObject');
    if (serviceCardForeignObject) {
      // Check if clicking on an interactive element (button, input, or within icon picker)
      const isInteractiveElement =
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.closest('button') !== null ||
        target.closest('input') !== null ||
        target.closest('[data-icon-picker]') !== null;

      if (isInteractiveElement) {
        // Let the React component handle these interactions
        // Don't prevent default or capture the pointer
        return false;
      }
    }

    // Check if we're clicking on a frame label (double-click to edit)
    const frameLabelElement = target.closest('[data-frame-label]');
    if (frameLabelElement) {
      // Find the frame shape
      let element: Element | null = frameLabelElement;
      let frameShape: FrameShape | null = null;
      while (element && element !== this.getSvgElement?.()) {
        const shapeId = (element as HTMLElement | SVGElement).dataset?.shapeId;
        if (shapeId) {
          const shape = this.diagramManager.getShapeById(shapeId);
          if (shape && shape.type === 'frame') {
            frameShape = shape as FrameShape;
            break;
          }
        }
        element = element.parentElement;
      }

      if (frameShape) {
        const currentTime = Date.now();
        const isDoubleClick = (currentTime - this.lastFrameLabelClickTime) < this.doubleClickTimeout &&
          this.lastFrameLabelFrame === frameShape;

        this.lastFrameLabelClickTime = currentTime;
        this.lastFrameLabelFrame = frameShape;

        // Check if double click was on text element specifically
        const isTextElement = target.classList.contains('frame-label-text');

        if (isDoubleClick) {
          if (!frameShape.isLabelEditing() && !this.clickedOnReadyIcon && isTextElement) {
            // Double-click on frame LABEL TEXT - start text editing
            e.preventDefault();
            frameShape.startLabelEditing(() => {
              // On stop, record history
              if (this.onRecordHistory) {
                this.onRecordHistory();
              }
              if (this.onSelectionChange) {
                this.onSelectionChange();
              }
            });
            return true;
          } else if (this.clickedOnReadyIcon) {
            // Double-click on frame ICON - start icon editing (open library)
            const shape = frameShape as any;

            // Just open the library - no need to set explicit editing mode
            // update logic handles generic selection now

            window.dispatchEvent(new CustomEvent('open-library', {
              detail: {
                shapeId: frameShape.id,
                section: 'Frameworks'
              }
            }));

            e.preventDefault();
            return true;
          }
        }

        // Single click - select the frame if not already selected
        if (!frameShape.state.selected) {
          if (!(e.shiftKey || e.ctrlKey)) {
            this.diagramManager.deselectAllShapes();
          }
          this.diagramManager.selectShape(frameShape);
          this.diagramManager.updateSelectionOverlay();
          if (this.onSelectionChange) {
            this.onSelectionChange();
          }
        }

        // Ensure tool state is updated even though we return early
        this.clickedShape = frameShape;
        this.clickedShapeWasSelected = true; // It is selected now

        e.preventDefault();
        return true;
      }
    }

    // Check if we're clicking on text that's ready for editing
    const readyTextElement = target.closest('[data-ready-for-editing]');
    let clickedOnReadyText = !!readyTextElement;
    const clickedOnTextElement = !!readyTextElement; // Track if we actually clicked on the text element

    // If clicking on ready text, DON'T prevent default to allow focus/keyboard interactions
    if (!clickedOnReadyText) {
      e.preventDefault();
    }
    element.setPointerCapture(e.pointerId);
    
    // Get world position
    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    
    // Check if clicked on a shape using DOM event target
    let clickedShape = this.getShapeFromEvent(e);

    // Filter out locked shapes (selected by other users)
    if (clickedShape && this.lockedShapeIds.has(clickedShape.id)) {
      clickedShape = null;
    }

    // Track if shape was found via bbox fallback (for connector drag handling)
    let shapeFoundViaBboxFallback = false;

    // Check if click is on a resize handle
    const clickedHandle = this.getClickedResizeHandle(e);

    // If no shape found from event but click is inside selection overlay,
    // find which selected shape contains the click position (for multi-select resolution)
    // ONLY do this if we didn't click a handle (handles should take precedence)
    if (!clickedShape && !clickedHandle && this.isInsideSelectionOverlay(worldPos.x, worldPos.y)) {
      const selectedShapes = this.diagramManager.getSelectedShapes();
      // Find the topmost shape that contains the click point
      for (let i = selectedShapes.length - 1; i >= 0; i--) {
        const shape = selectedShapes[i];

        // Skip locked shapes
        if (this.lockedShapeIds.has(shape.id)) continue;

        const bbox = shape.layout.getBBox();
        if (worldPos.x >= bbox.x && worldPos.x <= bbox.x + bbox.width &&
          worldPos.y >= bbox.y && worldPos.y <= bbox.y + bbox.height) {
          clickedShape = shape;
          shapeFoundViaBboxFallback = true; // Mark that we found via bbox, not direct click
          break;
        }
      }
    }

    this.clickedShape = clickedShape;

    const selectedShapes = this.diagramManager.getSelectedShapes();
    
    if (clickedShape) {
      this.clickedShapeWasSelected = clickedShape.state.selected;
    } else {
      // If no shape found but we're clearly INSIDE a selected shape (not on the stroke), use that shape
      // This handles clicking on empty areas inside the shape or on text
      if (selectedShapes.length === 1) {
        const selectedShape = selectedShapes[0];

        // Only if not locked
        if (!this.lockedShapeIds.has(selectedShape.id)) {
          // Use a threshold to exclude clicks near the stroke/edge
          // This ensures clicking on the stroke triggers resize, not text editing
          const strokeThreshold = 15; // Pixels from edge to consider "on stroke"
          const innerX = selectedShape.layout.x + strokeThreshold;
          const innerY = selectedShape.layout.y + strokeThreshold;
          const innerWidth = selectedShape.layout.width - (strokeThreshold * 2);
          const innerHeight = selectedShape.layout.height - (strokeThreshold * 2);

          const isInsideInnerBounds =
            innerWidth > 0 && innerHeight > 0 &&
            worldPos.x >= innerX && worldPos.x <= innerX + innerWidth &&
            worldPos.y >= innerY && worldPos.y <= innerY + innerHeight;

          if (isInsideInnerBounds) {
            clickedShape = selectedShape;
            this.clickedShape = clickedShape;
            this.clickedShapeWasSelected = true;
          }
        }
      }
    }

    // Verify icon click via geometry (handles selection overlay z-index issues)
    if (clickedShape && clickedShape.state.selected && (clickedShape.type === 'rectangle' || clickedShape.type === 'frame')) {
      const shape = clickedShape as any;
      if (typeof shape.isPointOverIcon === 'function' && shape.isPointOverIcon(worldPos.x, worldPos.y)) {
        this.clickedOnReadyIcon = true;
      }
    }

    // If clicked on an image shape that was already selected, treat it like clicking on ready text
    // This allows text editing to start when clicking on an already selected image shape
    // (same behavior as other shapes - second click on selected shape starts text editing)
    if (clickedShape && clickedShape.type === 'image' && this.clickedShapeWasSelected) {
      clickedOnReadyText = true;
      // Note: clickedOnTextElement remains false if we clicked on the image element itself
    }
    
    // Clear hover state during interactions (but not when clicking ready text or actively editing)
    const isEditingText = this.textEditTool.isEditingText();
    if (!clickedOnReadyText && !isEditingText) {
      this.diagramManager.clearHover();
    }
    
    // Reset pointer moved flag and store initial position
    this.pointerMoved = false;
    this.clickedOnReadyText = clickedOnReadyText && !this.clickedOnReadyIcon;
    this.clickedOnTextElement = clickedOnTextElement;
    this.initialPointerPos = { x: e.clientX, y: e.clientY };
    
    // Check if click is on a resize handle


    // IMPORTANT: If we clicked on a shape (clickedShape is set), we're clicking INSIDE the shape,
    // not on the stroke/handles. In this case, skip ALL resize/double-click logic.
    // The resize/double-click logic only applies to clicks on the selection overlay handles.
    if (clickedHandle && !clickedShape) {
      // Clicking on a resize handle (selection overlay) - handle resize/double-click logic
      const selectedShapes = this.diagramManager.getSelectedShapes();
      if (selectedShapes.length === 1) {
        clickedShape = selectedShapes[0];
        this.clickedShape = clickedShape;
        this.clickedShapeWasSelected = true; // Shape was already selected (that's why we see the overlay)
      }
      
      // Track double-clicks on resize handles for fitToText
      const currentTime = Date.now();
      const timeSinceLastClick = currentTime - this.lastClickTime;
      
      // If too much time has passed, reset the counter
      if (timeSinceLastClick > this.doubleClickTimeout) {
        this.clickCount = 1;
      } else {
        this.clickCount++;
      }
      
      this.lastClickTime = currentTime;
      this.lastClickedHandle = clickedHandle;
      this.lastClickPosition = worldPos;

      if (this.clickTimeoutId !== null) {
        clearTimeout(this.clickTimeoutId);
        this.clickTimeoutId = null;
      }

      this.clickTimeoutId = window.setTimeout(() => {
        this.clickCount = 0;
        this.lastClickedHandle = null;
        this.clickTimeoutId = null;
      }, this.doubleClickTimeout);
      
      // Handle double-click on resize handle (for fitToText)
      if (this.clickCount === 2) {
        // This is a double-click on resize handle - don't start resize
        // The fitToText will be handled in handlePointerUp
        return true;
      }
      
      // Single click on resize handle - start resize
      const isCornerHandle = clickedHandle === 'nw' || clickedHandle === 'ne' || 
                             clickedHandle === 'sw' || clickedHandle === 'se';
      if (isCornerHandle || clickedHandle === 'n' || clickedHandle === 's' || 
          clickedHandle === 'e' || clickedHandle === 'w') {
        this.resizeTool.startResize(clickedHandle as any, worldPos.x, worldPos.y);
        return true;
      }
    } else {
      // Clicking on shape body or empty space - reset double-click tracking
      this.clickCount = 0;
      this.lastClickedHandle = null;
      if (this.clickTimeoutId !== null) {
        clearTimeout(this.clickTimeoutId);
        this.clickTimeoutId = null;
      }
    }
    
    // Check if we're editing text and clicked outside the shape being edited
    // Or clicked on the same connector's stroke (not text) - should stop editing
    if (this.textEditTool.isEditingText()) {
      const editingShape = this.textEditTool.getEditingShape();
      const targetElement = e.target as Element;
      const isClickOnText = targetElement.closest('foreignObject') !== null ||
        targetElement.closest('[data-ready-for-editing]') !== null ||
        targetElement.closest('.text-block') !== null;

      // If clicked outside the editing shape, stop editing
      if (clickedShape !== editingShape) {
        this.textEditTool.stopTextEditing();

        // If clicked on empty space (not another shape), deselect all
        if (!clickedShape) {
          this.diagramManager.deselectAllShapes();
          this.diagramManager.updateSelectionOverlay();
        }

        if (this.onSelectionChange) {
          this.onSelectionChange();
        }

        // If clicked on another shape, continue processing to select it
        if (!clickedShape) {
          return true;
        }
      } else if (clickedShape === editingShape && clickedShape?.type === 'connector' && !isClickOnText) {
        // Clicked on the same connector's stroke (not text) - stop editing but keep selected
        this.textEditTool.stopTextEditing();

        if (this.onSelectionChange) {
          this.onSelectionChange();
        }

        // Don't return - continue to handle potential drag
      }
    }
    
    // If we get here, we're clicking on a shape body (not on resize handles)
    // Continue to selection/text editing logic below

    // Check if clicked on a connector handle (either directly or near handle center)
    let handleClicked = target.classList.contains('connector-handle');
    let handleType: 'start' | 'end' | 'midpoint' | null = null;
    let connectorForHandle: ConnectorShape | null = null;

    if (handleClicked) {
      // Direct click on handle
      if (target.classList.contains('start-handle')) {
        handleType = 'start';
      } else if (target.classList.contains('end-handle')) {
        handleType = 'end';
      } else if (target.classList.contains('midpoint-handle')) {
        handleType = 'midpoint';
      }
    } else if (clickedShape && clickedShape.type === 'connector') {
      // Check if click is near a handle center (in case path stroke overlaps handle)
      const connectorShape = clickedShape as ConnectorShape;
      const handleRadius = 6 / (this.getCanvasTransform?.()?.scale || 1); // Account for zoom
      const handleHitDistance = handleRadius * 2; // Allow some tolerance
      
      const startHandleDist = Math.sqrt(
        Math.pow(worldPos.x - connectorShape.startPoint.x, 2) + 
        Math.pow(worldPos.y - connectorShape.startPoint.y, 2)
      );
      const endHandleDist = Math.sqrt(
        Math.pow(worldPos.x - connectorShape.endPoint.x, 2) + 
        Math.pow(worldPos.y - connectorShape.endPoint.y, 2)
      );

      if (startHandleDist < handleHitDistance) {
        handleClicked = true;
        handleType = 'start';
        connectorForHandle = connectorShape;
      } else if (endHandleDist < handleHitDistance) {
        handleClicked = true;
        handleType = 'end';
        connectorForHandle = connectorShape;
      } else if (connectorShape.connectorType === 'curved') {
        // Check midpoint handle for curved connectors
        const midpoint = connectorShape.getCurvedMidpoint();
        const midpointDist = Math.sqrt(
          Math.pow(worldPos.x - midpoint.x, 2) +
          Math.pow(worldPos.y - midpoint.y, 2)
        );
        if (midpointDist < handleHitDistance) {
          handleClicked = true;
          handleType = 'midpoint';
          connectorForHandle = connectorShape;
        }
      }
    }

    if (handleClicked) {
      // Traverse up to find shape ID if not already found
      if (!connectorForHandle) {
        let element: Element | null = target;
        let shapeId: string | undefined;

        while (element && element !== this.getSvgElement?.()) {
          shapeId = (element as HTMLElement | SVGElement).dataset?.shapeId;
          if (shapeId) break;
          element = element.parentElement;
        }

        if (shapeId) {
          const shape = this.diagramManager.getShapeById(shapeId);
          if (shape && shape.type === 'connector') {
            connectorForHandle = shape as ConnectorShape;
          }
        }
      }

      if (connectorForHandle && handleType) {
        // Only allow dragging handles if the connector is already selected
        // If not selected, just select it without starting drag
        if (connectorForHandle.state.selected) {
          this.connectorDragTool.startDrag(connectorForHandle, handleType, e.clientX, e.clientY);
          return true;
        } else {
          // Connector not selected - select it and prepare to start dragging if user moves
          // Shift/Ctrl-click for multi-selection
          if (e.shiftKey || e.ctrlKey) {
            this.diagramManager.selectShape(connectorForHandle);
          } else {
            this.diagramManager.deselectAllShapes();
            this.diagramManager.selectShape(connectorForHandle);
          }
          this.diagramManager.updateSelectionOverlay();
          if (this.onSelectionChange) {
            this.onSelectionChange();
          }
          // Store handle info so we can start dragging if user moves pointer
          this.pendingHandleDrag = { connector: connectorForHandle, handle: handleType };
          return true;
        }
      }
    }

    // Check if clicked on a bent segment handle
    const bentSegmentHandle = target.closest('.bent-segment-handle');
    if (bentSegmentHandle) {
      const segmentIndexAttr = bentSegmentHandle.getAttribute('data-segment-index');
      if (segmentIndexAttr !== null) {
        const segmentIndex = parseInt(segmentIndexAttr, 10);

        // Find the connector that owns this handle
        let handleConnector: BentConnector | null = null;
        let element: Element | null = bentSegmentHandle;
        while (element && element !== this.getSvgElement?.()) {
          const shapeId = (element as HTMLElement | SVGElement).dataset?.shapeId;
          if (shapeId) {
            const shape = this.diagramManager.getShapeById(shapeId);
            if (shape instanceof BentConnector) {
              handleConnector = shape;
              break;
            }
          }
          element = element.parentElement;
        }

        // If we couldn't find via parent traversal, check if clicked shape is a bent connector
        if (!handleConnector && clickedShape instanceof BentConnector) {
          handleConnector = clickedShape;
        }

        if (handleConnector && handleConnector.state.selected) {
          // Check for double-click on bent segment handle to reset to auto routing
          const currentTime = Date.now();
          const timeSinceLastClick = currentTime - this.lastBentSegmentClickTime;

          if (timeSinceLastClick < this.doubleClickTimeout && this.lastBentSegmentConnector === handleConnector) {
            // Double-click detected - reset to auto routing
            handleConnector.resetToAutoRouting();
            handleConnector.render();
            this.diagramManager.updateSelectionOverlay();

            if (this.onRecordHistory) {
              this.onRecordHistory();
            }

            // Reset tracking
            this.lastBentSegmentClickTime = 0;
            this.lastBentSegmentConnector = null;

            return true;
          }

          // Track this click for potential double-click
          this.lastBentSegmentClickTime = currentTime;
          this.lastBentSegmentConnector = handleConnector;

          // Start segment drag (single click)
          this.connectorDragTool.startSegmentDrag(handleConnector, segmentIndex, e.clientX, e.clientY);
          return true;
        }
      }
    }

      if (clickedShape) {
        // === GROUP-AWARE SELECTION ===
        const currentTime = Date.now();
        const groupId = this.diagramManager.getTopmostGroupId(clickedShape);

        // Check for double-click: same shape, OR clicking within currently selected/focused group
        const selectedShapes = this.diagramManager.getSelectedShapes();
        const focusedGroup = this.diagramManager.getFocusedGroup();

        // Check if clicked shape is within the current selection context
        const currentGroupSelected = groupId && selectedShapes.length > 0 &&
          selectedShapes.every(s => this.diagramManager.getTopmostGroupId(s) === groupId);

        // Also allow double-click if clicking within the focused group
        const clickedWithinFocusedGroup = focusedGroup &&
          this.diagramManager.getAllShapesInGroupRecursive(focusedGroup).includes(clickedShape);

        const isDoubleClick = (currentTime - this.lastGroupClickTime) < this.doubleClickTimeout &&
          (this.lastGroupClickShapeId === clickedShape.id || currentGroupSelected || clickedWithinFocusedGroup);

        // Update tracking for next click
        this.lastGroupClickTime = currentTime;
        this.lastGroupClickShapeId = clickedShape.id;

        if (e.shiftKey || e.ctrlKey) {
          // Shift/Ctrl-click for multi-selection
          if (groupId) {
            // Shape is in a group - select/deselect entire group
            const groupShapes = this.diagramManager.getShapesInGroup(groupId);
            const anySelected = groupShapes.some(s => s.state.selected);
            if (anySelected) {
              // Deselect entire group
              groupShapes.forEach(s => this.diagramManager.deselectShape(s));
            } else {
              // Select entire group
              this.diagramManager.selectAllShapesInGroup(groupId);
            }
          } else {
            // Ungrouped shape - toggle individual selection
            if (clickedShape.state.selected) {
              this.diagramManager.deselectShape(clickedShape);
            } else {
              this.diagramManager.selectShape(clickedShape);
            }
          }
        } else {
          // Regular click (no modifier)
          if (groupId) {
            // Shape is in a group
            const focusedGroup = this.diagramManager.getFocusedGroup();
            const immediateParent = clickedShape.parentId;

            if (isDoubleClick) {
              // Double-click: drill into the CURRENTLY SELECTED group
              // Find the smallest group that contains all selected shapes - that's our current context
              const selectedGroup = this.diagramManager.findSmallestContainingGroup(selectedShapes);

              // Use the selected group as target level, fall back to focusedGroup or topmost
              const targetLevel = selectedGroup ?? focusedGroup ?? groupId;

              // Find the child of targetLevel that contains the clicked shape
              let target: string | null = clickedShape.parentId;
              let targetIsShape = true;

              // Walk up the hierarchy until we find something directly inside targetLevel
              while (target && target !== targetLevel) {
                const parentOfTarget = this.diagramManager.getGroupParentId(target);
                if (parentOfTarget === targetLevel) {
                  // target is directly inside targetLevel - it's an inner group
                  targetIsShape = false;
                  break;
                }
                target = parentOfTarget;
              }

              // If shape is direct child of targetLevel
              if (clickedShape.parentId === targetLevel) {
                // Select the shape directly
                this.diagramManager.setFocusedGroup(targetLevel);
                this.diagramManager.deselectAllShapes();
                this.diagramManager.selectShape(clickedShape);
              } else if (target && !targetIsShape) {
                // Select the inner group that's directly inside targetLevel
                // Set focus to the SELECTED group (target) so we can drill into it next
                this.diagramManager.setFocusedGroup(target);
                this.diagramManager.deselectAllShapes();
                this.diagramManager.selectAllShapesInGroup(target);
              }
              // Prevent text editing from triggering - we just drilled in
              this.clickedShapeWasSelected = false;
            } else if (clickedShape.state.selected) {
              // Shape is already selected (part of currently selected group)
              // Check if this is a multi-select scenario - mark for resolution on pointer up
              const selectedShapes = this.diagramManager.getSelectedShapes();
              if (selectedShapes.length > 1) {
                // Multiple items selected - will resolve to just this group on pointer up
                this.pendingMultiSelectClick = true;
              }
              // Otherwise just let drag logic handle it (preserves selection for dragging)
            } else {
              // Single click on unselected shape: select the entire topmost group
              this.diagramManager.setFocusedGroup(null); // Clear any focus
              this.diagramManager.deselectAllShapes();
              this.diagramManager.selectAllShapesInGroup(groupId);
            }
          } else {
            // Shape is not in a group - normal selection
            this.diagramManager.setFocusedGroup(null); // Clear any focus
            if (!clickedShape.state.selected) {
              this.diagramManager.deselectAllShapes();
              this.diagramManager.selectShape(clickedShape);
            } else {
              // Already selected in multi-select - mark for resolution on pointer up
              const selectedShapes = this.diagramManager.getSelectedShapes();
              if (selectedShapes.length > 1) {
                this.pendingMultiSelectClick = true;
              }
            }
          }
      }

      // Check if clicked on a connector path (not handle) - allow dragging both points
      // BUT only if both points are disconnected (not attached to shapes)
      if (clickedShape.type === 'connector') {
        const connectorShape = clickedShape as ConnectorShape;
        const isPathElement = target.tagName === 'path' && 
          ((target as any) === clickedShape.shapeElement ||
            (target as any) === connectorShape.hitPathElement);
        
        // Only allow dragging from stroke if BOTH points are disconnected
        const bothDisconnected = !connectorShape.startShapeId && !connectorShape.endShapeId;
        
        // Check if clicking on connector's text element (foreignObject)
        const targetElement = e.target as Element;
        const isTextElement = targetElement.closest('foreignObject') !== null ||
          targetElement.closest('[data-ready-for-editing]') !== null;

        if (isTextElement && clickedShape.state.selected) {
          // Clicked on connector label that was already selected
          // Prepare for label drag, and potentially text editing on pointer up
          this.pendingLabelDrag = connectorShape;
          this.initialLabelPosition = connectorShape.labelPosition;
          this.clickedOnConnectorText = true;
          this.connectorTextWasSelected = this.clickedShapeWasSelected;

          // Ensure selection overlay is visible
          this.diagramManager.updateSelectionOverlay();

          // Don't start text editing yet - wait for pointer up without move
          // Text editing only happens if connector was ALREADY selected before this click
          return true;
        } else if (isTextElement && !clickedShape.state.selected) {
          // Clicked on connector text but connector wasn't selected
          // Select the connector first, then prepare for potential label drag
          if (!e.shiftKey && !e.ctrlKey) {
            this.diagramManager.deselectAllShapes();
          }
          this.diagramManager.selectShape(clickedShape);
          this.diagramManager.updateSelectionOverlay();

          this.clickedOnConnectorText = true;
          this.connectorTextWasSelected = false;
          this.pendingLabelDrag = connectorShape;
          this.initialLabelPosition = connectorShape.labelPosition;

          if (this.onSelectionChange) {
            this.onSelectionChange();
          }

          // Return early - we've handled selection, don't fall through
          return true;
        }

        // Check if in multi-select (more than just this connector selected)
        const isMultiSelect = this.diagramManager.getSelectedShapes().length > 1;

        // Allow dragging if:
        // 1. Clicked on path element AND both points are disconnected (solo connector drag), OR
        // 2. Found via bbox fallback in multi-select (clicking in connector's empty bbox area)
        if (clickedShape.state.selected && !clickedOnReadyText) {
          if ((isPathElement && bothDisconnected) || (shapeFoundViaBboxFallback && isMultiSelect)) {
            // Allow dragging from the connector path or from bbox area in multi-select
            this.dragTool.startDrag(worldPos.x, worldPos.y, e.clientX, e.clientY);
          }
        }
      } else {
        // Start dragging selected shapes (only if clicked shape is selected AND not clicking ready text)
        // For ready text, we wait to see if user moves before starting drag
        if (clickedShape.state.selected && !clickedOnReadyText) {
          this.dragTool.startDrag(worldPos.x, worldPos.y, e.clientX, e.clientY);
        }
      }
      
      // Update selection overlay
      this.diagramManager.updateSelectionOverlay();
    } else if (this.isInsideSelectionOverlay(worldPos.x, worldPos.y)) {
      // Clicked inside selection overlay (but not on a shape) - start dragging all selected shapes
      this.dragTool.startDrag(worldPos.x, worldPos.y, e.clientX, e.clientY);
    } else {
      // Clicked on empty space outside selection - start marquee selection
        // IMPORTANT: Clear focused group when clicking elsewhere
        this.diagramManager.setFocusedGroup(null);
      if (!e.shiftKey && !e.ctrlKey) {
        this.diagramManager.deselectAllShapes();
        this.diagramManager.updateSelectionOverlay();
      }
      
      this.isMarqueeSelecting = true;
      this.marqueeStartPoint = worldPos;
      this.createMarquee(worldPos.x, worldPos.y);
      
      // Start edge panning for marquee selection
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.start(e.clientX, e.clientY);
      }
    }

    if (this.onSelectionChange) {
      this.onSelectionChange();
    }

    return true;
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    // If we're interacting with text editor, let browser handle it
    const target = e.target as HTMLElement;
    if (target.closest('[data-text-editor]')) {
      return false; // Let the event bubble normally for text selection
    }

    // Cancel all drags if text editing is active
    const isEditingText = this.textEditTool.isEditingText();
    if (isEditingText) {
      // Cancel any ongoing or pending drags
      this.dragTool.cancelDrag();
      this.connectorDragTool.handlePointerUp(e, document.documentElement as HTMLElement);
      this.pendingLabelDrag = null;
      this.isDraggingLabel = false;
      this.pendingHandleDrag = null;
      return false;
    }

    // Track if pointer moved beyond threshold for click detection
    if (this.clickedShape && !this.pointerMoved) {
      const dx = e.clientX - this.initialPointerPos.x;
      const dy = e.clientY - this.initialPointerPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.clickThreshold) {
        this.pointerMoved = true;

        if (this.clickCount > 0) {
          this.clickCount = 0;
          this.lastClickedHandle = null;
          if (this.clickTimeoutId !== null) {
            clearTimeout(this.clickTimeoutId);
            this.clickTimeoutId = null;
          }
        }
        
        // If we clicked on ready-for-editing text and moved, NOW start dragging
        if (this.clickedOnReadyText && this.clickedShape) {
          const worldPos = this.screenToWorld(e.clientX, e.clientY);
          this.dragTool.startDrag(worldPos.x, worldPos.y, e.clientX, e.clientY);
        }
        
        // If we clicked on a handle of an unselected connector and moved, start dragging the handle
        if (this.pendingHandleDrag) {
          this.connectorDragTool.startDrag(
            this.pendingHandleDrag.connector,
            this.pendingHandleDrag.handle,
            e.clientX,
            e.clientY
          );
          this.pendingHandleDrag = null;
          // Continue to handle the drag in this same event
        }

        // If we clicked on a connector label and moved, start dragging the label
        if (this.pendingLabelDrag) {
          this.isDraggingLabel = true;
          // Don't nullify pendingLabelDrag yet - we need it for the drag
        }
      }
    }
    
    // Handle connector label dragging
    if (this.isDraggingLabel && this.pendingLabelDrag) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      const newPosition = this.pendingLabelDrag.getClosestPositionOnPath(worldPos);
      this.pendingLabelDrag.setLabelPosition(newPosition);
      this.pendingLabelDrag.render();
      this.diagramManager.updateShapeText(this.pendingLabelDrag);
      return true;
    }

    // Check if we need to handle dragging (including if we just started it)
    if (!this.dragTool.isCurrentlyDragging() && !this.isMarqueeSelecting && !this.resizeTool.isCurrentlyResizing() && !this.connectorDragTool.isActive()) {
      // Track hover state when not actively interacting (or when actively editing text)
      const isEditingText = this.textEditTool.isEditingText();
      if (!isEditingText) {
        const hoveredShape = this.getShapeFromEvent(e);
        this.diagramManager.setHoveredShape(hoveredShape);
      }
      return false;
    }

    e.preventDefault();

    const worldPos = this.screenToWorld(e.clientX, e.clientY);

    if (this.resizeTool.isCurrentlyResizing()) {
      this.resizeTool.updateResize(worldPos.x, worldPos.y);
    } else if (this.connectorDragTool.isActive()) {
      this.connectorDragTool.handlePointerMove(e);
    } else if (this.dragTool.isCurrentlyDragging()) {
      this.dragTool.updatePointer(e.clientX, e.clientY);
      this.dragTool.updateDrag(worldPos.x, worldPos.y);
    } else if (this.isMarqueeSelecting) {
      // Update edge panning with current pointer position
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.updatePointer(e.clientX, e.clientY);
      }
      
      // Update marquee selection rectangle
      this.updateMarquee(worldPos.x, worldPos.y);
      
      // Real-time selection: Update selected shapes as marquee is being drawn
      const startX = this.marqueeStartPoint.x;
      const startY = this.marqueeStartPoint.y;
      const x = Math.min(startX, worldPos.x);
      const y = Math.min(startY, worldPos.y);
      const width = Math.abs(worldPos.x - startX);
      const height = Math.abs(worldPos.y - startY);
      
      // Select/deselect shapes in real-time
      const additive = e.shiftKey || e.ctrlKey;
      this.selectShapesInMarquee(x, y, width, height, additive);
      
      // Update selection overlay in real-time
      this.diagramManager.updateSelectionOverlay();
      
      if (this.onSelectionChange) {
        this.onSelectionChange();
      }
    }

    return true;
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // If we're interacting with text editor, let browser handle it
    const target = e.target as HTMLElement;
    if (target.closest('[data-text-editor]')) {
      return false; // Let the event bubble normally
    }

    const shouldHandleReadyText = this.clickedOnReadyText && this.clickedShape && !this.pointerMoved;

    // Check for double-click on resize handle to auto-fit text
    // This needs to happen BEFORE other handlers to prevent interference
    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    
    // Check if we have a double-click (clickCount === 2) on a resize handle
    // Use lastClickedHandle since pointer capture changes the target
    // Only if mouse didn't move (no drag/resize happened)
    if (this.clickCount === 2 && this.lastClickedHandle && !this.pointerMoved) {
      const selectedShapes = this.diagramManager.getSelectedShapes();

      if (selectedShapes.length === 1) {
        const shape = selectedShapes[0];

        if (shape.text && shape.text.trim()) {
          const success = shape.shapeText.fitToText(this.lastClickedHandle);
          
          if (success) {
            shape.render();
            this.diagramManager.updateShapeText(shape);
            this.diagramManager.updateConnectedConnectorsOnResize(shape);
            this.diagramManager.updateSelectionOverlay();
            
            if (this.onRecordHistory) {
              this.onRecordHistory();
            }
            if (this.onSelectionChange) {
              this.onSelectionChange();
            }
          }
        }
      }
      
      // Reset all tracking and prevent further handling
      this.clickCount = 0;
      this.lastClickTime = 0;
      this.lastClickedHandle = null;
      this.lastClickPosition = null;
      if (this.clickTimeoutId !== null) {
        clearTimeout(this.clickTimeoutId);
        this.clickTimeoutId = null;
      }
      
      // Clear click tracking to prevent drag/resize from triggering
      this.clickedShape = null;
      this.clickedShapeWasSelected = false;
      this.clickedOnReadyText = false;
      this.clickedOnTextElement = false;
      this.pointerMoved = false;
      this.pendingHandleDrag = null;
      
      // Cancel any active resize
      this.resizeTool.cancelResize();
      
      // Release pointer capture
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
      
      return true; // Prevent other handlers from running
    }

    // Handle connector label drag end
    if (this.isDraggingLabel && this.pendingLabelDrag) {
      // Record history if position changed
      if (this.pendingLabelDrag.labelPosition !== this.initialLabelPosition) {
        if (this.onRecordHistory) {
          this.onRecordHistory();
        }
      }
      this.isDraggingLabel = false;
      this.pendingLabelDrag = null;
      this.clickedOnConnectorText = false;
      this.connectorTextWasSelected = false;

      // Cancel any other drag that might have been started
      this.dragTool.cancelDrag();

      // Clear all click state to prevent further handling
      this.clickedShape = null;
      this.clickedShapeWasSelected = false;
      this.pointerMoved = false;

      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
      return true;
    }

    // Handle connector label click without move - enter text editing ONLY if text was already selected
    if (this.pendingLabelDrag && !this.pointerMoved) {
      const connector = this.pendingLabelDrag;
      const wasAlreadySelected = this.connectorTextWasSelected;

      this.pendingLabelDrag = null;
      this.isDraggingLabel = false;
      this.clickedOnConnectorText = false;
      this.connectorTextWasSelected = false;

      // Only start text editing if the connector was ALREADY selected before this click
      if (wasAlreadySelected) {
        // Cancel any pending drags before starting text edit
        this.dragTool.cancelDrag();
        this.connectorDragTool.handlePointerUp(e, element);

        const clickX = e.clientX;
        const clickY = e.clientY;
        this.textEditTool.startTextEditing(connector, true, { x: clickX, y: clickY });
      }
      // If not already selected, the selection happened in pointer down - just finish

      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
      return true;
    }

    // Clear pending label drag state
    this.pendingLabelDrag = null;
    this.isDraggingLabel = false;
    this.clickedOnConnectorText = false;
    this.connectorTextWasSelected = false;

    if (!this.dragTool.isCurrentlyDragging() && !this.isMarqueeSelecting && !this.resizeTool.isCurrentlyResizing() && !shouldHandleReadyText && !this.connectorDragTool.isActive()) return false;

    // Only prevent default if we're NOT handling text editing
    if (!shouldHandleReadyText) {
      e.preventDefault();
    }
    try {
      element.releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }

    if (this.resizeTool.isCurrentlyResizing()) {
      // End resize
      this.resizeTool.endResize();
    } else if (this.connectorDragTool.isActive()) {
      this.connectorDragTool.handlePointerUp(e, element);
    } else if (this.dragTool.isCurrentlyDragging()) {
      // End shape dragging
      // If we didn't move beyond threshold, it's a click -> check for text editor
      if (this.clickedShape && !this.pointerMoved) {
        // Check if we're clicking on the shape that's currently being edited
        // If so, toggle editing off (but only if not clicking on the text-block itself)
        if (this.textEditTool.isEditingText() && 
          this.clickedShape === this.textEditTool.getEditingShape()) {
          this.textEditTool.stopTextEditing();
        }
        // Multi-select click resolution: when multiple shapes are selected and 
        // user clicks on one without dragging -> select just that one item/group
        // This MUST come BEFORE text editing check
        else if (this.pendingMultiSelectClick) {
          const groupId = this.diagramManager.getTopmostGroupId(this.clickedShape);
          this.diagramManager.deselectAllShapes();
          if (groupId) {
            // Grouped shape: select the entire group
            this.diagramManager.setFocusedGroup(null);
            this.diagramManager.selectAllShapesInGroup(groupId);
          } else {
            // Ungrouped shape: select just that shape
            this.diagramManager.selectShape(this.clickedShape);
          }
          this.diagramManager.updateSelectionOverlay();
          this.pendingMultiSelectClick = false;
        }
        else if (this.clickedOnReadyIcon && this.clickedShape.type === 'rectangle') {
          // Open library for Rectangle icon click (Single Click)
          const shape = this.clickedShape as any;

          // Just open the library - no need to set explicit editing mode

          // Dispatch event to open library
          window.dispatchEvent(new CustomEvent('open-library', {
            detail: {
              shapeId: this.clickedShape.id,
              section: 'Frameworks' // Default section
            }
          }));
        } else if (this.textEditTool.shouldStartTextEditing(this.clickedShape, this.clickedShapeWasSelected)) {
          const clickX = e.clientX;
          const clickY = e.clientY;
          this.textEditTool.startTextEditing(this.clickedShape, true, { x: clickX, y: clickY });
        }
      }
      
      // Always end the drag (even if we're opening text editor)
      this.dragTool.endDrag(worldPos.x, worldPos.y);
    } else if (this.clickedOnReadyText && this.clickedShape) {
      if (!this.pointerMoved) {
        if (this.clickedOnTextElement) {
          const clickX = e.clientX;
          const clickY = e.clientY;
          this.textEditTool.startTextEditing(this.clickedShape, true, { x: clickX, y: clickY });
        } else {
          this.textEditTool.startTextEditing(this.clickedShape, true);
        }
      }
      // If moved, drag already happened in pointerMove
    } else if (this.isMarqueeSelecting) {
      // End marquee selection - select shapes within bounds
      
      // Calculate marquee bounds
      const startX = this.marqueeStartPoint.x;
      const startY = this.marqueeStartPoint.y;
      const x = Math.min(startX, worldPos.x);
      const y = Math.min(startY, worldPos.y);
      const width = Math.abs(worldPos.x - startX);
      const height = Math.abs(worldPos.y - startY);
      
      // Select shapes within marquee
      const additive = e.shiftKey || e.ctrlKey;
      this.selectShapesInMarquee(x, y, width, height, additive);
      
      // Update selection overlay
      this.diagramManager.updateSelectionOverlay();
      
      this.removeMarquee();
      this.isMarqueeSelecting = false;
      
      // Stop edge panning when marquee ends
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.stop();
      }
      
      if (this.onSelectionChange) {
        this.onSelectionChange();
      }
    }
    
    // Clear click tracking
    this.clickedShape = null;
    this.clickedShapeWasSelected = false;
    this.clickedOnReadyText = false;
    this.clickedOnTextElement = false;
    this.pointerMoved = false;
    this.pendingHandleDrag = null;
    
    // Note: Don't reset double-click tracking here - let it persist for the second click
    // It will be reset on mouse move or after timeout

    return true;
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    return false;
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Handle Delete/Backspace to delete selected shapes
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // If we are editing text, do NOT delete the shape
      if (this.textEditTool.isEditingText()) {
        return false;
      }

      // Check if any selected frame is currently editing its label
      const selectedShapes = this.diagramManager.getSelectedShapes();
      const isEditingFrameLabel = selectedShapes.some(shape =>
        shape.type === 'frame' && (shape as FrameShape).isLabelEditing()
      );
      if (isEditingFrameLabel) {
        return false;
      }
      if (selectedShapes.length === 0) return false;
      
      // Remove the shapes
      selectedShapes.forEach(shape => {
        this.diagramManager.removeShape(shape);
      });
      
      // Always deselect and hide selection overlay after deletion
      this.diagramManager.deselectAllShapes();
      this.diagramManager.hideSelectionOverlay();
      
      // Record history after deletion
      if (this.onRecordHistory) {
        this.onRecordHistory();
      }
      
      if (this.onSelectionChange) {
        this.onSelectionChange();
      }
      
      return true;
    }

    // Handle Enter to start text editing (delegate to TextEditTool)
    if (e.key === 'Enter') {
      return this.textEditTool.handleKeyDown(e);
    }

    // Handle Escape to cancel keyboard quick connect
    if (e.key === 'Escape' && this.isKeyboardQuickConnectMode) {
      this.diagramManager.cancelKeyboardQuickConnect();
      this.isKeyboardQuickConnectMode = false;
      this.keyboardQuickConnectSide = null;
      this.keyboardQuickConnectCount = 0;
      return true;
    }

    // Handle Command/Meta + Arrow keys for keyboard quick connect
    if (e.metaKey || e.ctrlKey) {
      // Ignore if editing text
      if (this.textEditTool.isEditingText()) {
        return false;
      }

      // Check if any selected frame is currently editing its label
      const selectedShapes = this.diagramManager.getSelectedShapes();
      const isEditingFrameLabel = selectedShapes.some(shape =>
        shape.type === 'frame' && (shape as FrameShape).isLabelEditing()
      );
      if (isEditingFrameLabel) {
        return false;
      }

      let side: QuickConnectSide | null = null;

      switch (e.key) {
        case 'ArrowUp':
          side = 'top';
          break;
        case 'ArrowDown':
          side = 'bottom';
          break;
        case 'ArrowLeft':
          side = 'left';
          break;
        case 'ArrowRight':
          side = 'right';
          break;
      }

      if (side) {
        e.preventDefault(); // Prevent page scrolling

        if (!this.isKeyboardQuickConnectMode) {
          // Start keyboard quick connect with count 1
          this.keyboardQuickConnectCount = 1;
          const started = this.diagramManager.startKeyboardQuickConnect(side, this.keyboardQuickConnectCount);
          if (started) {
            this.isKeyboardQuickConnectMode = true;
            this.keyboardQuickConnectSide = side;
          }
        } else if (side === this.keyboardQuickConnectSide) {
          // Same direction - increment count
          this.keyboardQuickConnectCount++;
          this.diagramManager.updateKeyboardQuickConnect(side, this.keyboardQuickConnectCount);
        } else {
          // Different direction - reset count to 1 and change direction
          this.keyboardQuickConnectCount = 1;
          this.diagramManager.updateKeyboardQuickConnect(side, this.keyboardQuickConnectCount);
          this.keyboardQuickConnectSide = side;
        }

        return true;
      }
    }

    return false;
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Commit keyboard quick connect when Command/Meta key is released
    if ((e.key === 'Meta' || e.key === 'Control') && this.isKeyboardQuickConnectMode) {
      const committed = this.diagramManager.commitKeyboardQuickConnect();
      this.isKeyboardQuickConnectMode = false;
      this.keyboardQuickConnectSide = null;
      this.keyboardQuickConnectCount = 0;

      if (committed) {
        // Record history after quick connect
        if (this.onRecordHistory) {
          this.onRecordHistory();
        }

        if (this.onSelectionChange) {
          this.onSelectionChange();
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Cancel any ongoing interactions (marquee selection, dragging, etc.)
   * Called when interaction is interrupted (context menu, blur, etc.)
   */
  public cancelInteraction(): void {
    // Cancel marquee selection
    if (this.isMarqueeSelecting) {
      this.removeMarquee();
      this.isMarqueeSelecting = false;
      
      // Stop edge panning
      const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
      if (edgePanManager) {
        edgePanManager.stop();
      }
    }
    
    // Cancel drag and resize operations
    this.dragTool.cancelDrag();
    this.resizeTool.cancelResize();
    
    // Reset click tracking
    this.clickedShape = null;
    this.clickedShapeWasSelected = false;
    this.clickedOnReadyText = false;
    this.clickedOnTextElement = false;
    this.pointerMoved = false;
    this.pendingHandleDrag = null;
    
    // Reset double-click tracking
    this.clickCount = 0;
    this.lastClickedHandle = null;
    if (this.clickTimeoutId !== null) {
      clearTimeout(this.clickTimeoutId);
      this.clickTimeoutId = null;
    }

    // Cancel keyboard quick connect
    if (this.isKeyboardQuickConnectMode) {
      this.diagramManager.cancelKeyboardQuickConnect();
      this.isKeyboardQuickConnectMode = false;
      this.keyboardQuickConnectSide = null;
      this.keyboardQuickConnectCount = 0;
    }
  }

  /**
   * Handle edge pan updates - called continuously while edge panning
   * Updates drag/marquee to follow the mouse smoothly as canvas pans
   */
  public handleEdgePanUpdate(): void {
    const edgePanManager = this.getEdgePanManager ? this.getEdgePanManager() : null;
    if (!edgePanManager) return;

    // Get current pointer position in screen space
    const clientX = edgePanManager.getLastPointerX();
    const clientY = edgePanManager.getLastPointerY();

    // Convert to world coordinates with updated translation
    const worldPos = this.screenToWorld(clientX, clientY);

    // Update drag or marquee with new world position
    if (this.dragTool.isCurrentlyDragging()) {
      this.dragTool.updateDrag(worldPos.x, worldPos.y);
    } else if (this.isMarqueeSelecting) {
      this.updateMarquee(worldPos.x, worldPos.y);
    }
  }

  /**
   * Check if shapes are currently being dragged
   */
  public isShapeDragging(): boolean {
    return this.dragTool.isCurrentlyDragging();
  }

  /**
   * Start dragging a connector's endpoint for quick connect.
   * Called by DiagramManager when user drags from a quick connect button.
   * @param connector The connector to drag
   * @param side The side of the original shape where the connector starts
   * @param clientX The current pointer X position in screen coordinates
   * @param clientY The current pointer Y position in screen coordinates
   */
  public startQuickConnectDrag(connector: ConnectorShape, side: QuickConnectSide, clientX: number, clientY: number): void {
    // Select the connector
    this.diagramManager.deselectAllShapes();
    this.diagramManager.selectShape(connector);
    this.diagramManager.updateSelectionOverlay();

    if (this.onSelectionChange) {
      this.onSelectionChange();
    }

    // Start dragging the end point of the connector
    this.connectorDragTool.startDrag(connector, 'end', clientX, clientY);
  }
}
