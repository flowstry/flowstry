import { GRID_SPACING } from '../consts/canvas';
import { DiagramManager } from '../shapes';
import { DiagramShape, ShapeName } from '../shapes/base';
import { DiagramTool } from './base';

export class DrawingTool extends DiagramTool {
  private diagramManager: DiagramManager;
  private selectedShapeType: ShapeName = 'rectangle';
  private isDrawing: boolean = false;
  private drawStartPoint: { x: number; y: number } = { x: 0, y: 0 };
  private currentShape: DiagramShape | null = null;
  private pendingImageUrl: string | null = null;
  private pendingImageName: string | null = null;
  private pendingSquareIcon: boolean = false;
  
  // Preview/ghost shape that follows cursor
  private previewShape: DiagramShape | null = null;
  private readonly DEFAULT_WIDTH = GRID_SPACING * 8;
  private readonly DEFAULT_HEIGHT = GRID_SPACING * 6;
  
  // Callbacks
  private getSvgElement: (() => SVGSVGElement | null) | null = null;
  private getContainerElement: (() => HTMLDivElement | null) | null = null;
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null;
  private getContentLayer: (() => SVGGElement | null) | null = null;
  private onShapeCreated: (() => void) | null = null;
  private onRequestToolChange: ((toolName: string) => void) | null = null;

  constructor(
    diagramManager: DiagramManager,
    getSvgElement?: () => SVGSVGElement | null,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer?: () => SVGGElement | null,
    onShapeCreated?: () => void,
    onRequestToolChange?: (toolName: string) => void
  ) {
    super('Draw', 'pencil');
    this.diagramManager = diagramManager;
    this.getSvgElement = getSvgElement || null;
    this.getContainerElement = getContainerElement || null;
    this.getCanvasTransform = getCanvasTransform || null;
    this.getContentLayer = getContentLayer || null;
    this.onShapeCreated = onShapeCreated || null;
    this.onRequestToolChange = onRequestToolChange || null;
  }

  public setCallbacks(
    getSvgElement: () => SVGSVGElement | null,
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer: () => SVGGElement | null,
    onShapeCreated: () => void,
    onRequestToolChange: (toolName: string) => void
  ) {
    this.getSvgElement = getSvgElement;
    this.getContainerElement = getContainerElement;
    this.getCanvasTransform = getCanvasTransform;
    this.getContentLayer = getContentLayer;
    this.onShapeCreated = onShapeCreated;
    this.onRequestToolChange = onRequestToolChange;
  }

  public setShapeType(shapeType: ShapeName): void {
    this.selectedShapeType = shapeType;
    
    // Recreate preview with new shape type if tool is active
    if (this.isActive() && this.previewShape) {
      this.removePreviewShape();
      this.createPreviewShape();
    }
  }

  public getShapeType(): ShapeName {
    return this.selectedShapeType;
  }

  public setPendingImage(url: string | null, name?: string | null, squareIcon: boolean = false): void {
    this.pendingImageUrl = url;
    // Preserve the name if provided, otherwise null
    this.pendingImageName = (name !== undefined && name !== null) ? name : null;
    this.pendingSquareIcon = squareIcon;
    if (url) {
      this.selectedShapeType = 'image';
      if (this.isActive()) {
        this.removePreviewShape();
        this.createPreviewShape();
      }
    }
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

  private snapToGrid(value: number): number {
    // Only snap if snapToGrid is enabled
    if (!this.diagramManager.getSnapToGrid()) {
      return value;
    }
    // Snap to grid dots which are at GRID_SPACING/2, GRID_SPACING/2 + GRID_SPACING, etc.
    const offset = GRID_SPACING / 2;
    return Math.round((value - offset) / GRID_SPACING) * GRID_SPACING + offset;
  }

  protected onActivate(): void {
    // Create preview shape
    this.createPreviewShape();
  }

  protected onDeactivate(): void {
    // Cancel any ongoing drawing
    if (this.isDrawing) {
      this.cancelDrawing();
    }
    
    // Remove preview shape
    this.removePreviewShape();

    // Clear pending image on deactivate
    this.pendingImageUrl = null;
    this.pendingImageName = null;
    this.pendingSquareIcon = false;
  }
  
  private createPreviewShape(): void {
    // Create a ghost shape at origin (will be positioned by mouse move)
    // DiagramManager.createShape will automatically add it to the DOM
    // For square icons, use DEFAULT_WIDTH for both dimensions; otherwise use DEFAULT_WIDTH x DEFAULT_HEIGHT
    const previewWidth = this.DEFAULT_WIDTH;
    const previewHeight = (this.selectedShapeType === 'image' && this.pendingSquareIcon) ? this.DEFAULT_WIDTH : this.DEFAULT_HEIGHT;
    
    this.previewShape = this.diagramManager.createShape(
      this.selectedShapeType,
      0,
      0,
      this.pendingImageUrl || undefined,
      this.pendingImageName ?? undefined,
      this.pendingSquareIcon
    );
    
    if (this.previewShape) {
      // Resize to default size - square for square icons, rectangle for other shapes
      this.previewShape.layout.resize(0, 0, previewWidth, previewHeight);
      
      // Make it semi-transparent and non-interactive
      this.previewShape.element.style.opacity = '0.4';
      this.previewShape.element.style.pointerEvents = 'none';
      
      // Hide text element for preview shape - text will be set when actual shape is created
      if (this.previewShape.textElement) {
        this.previewShape.textElement.style.display = 'none';
      }
    }
  }
  
  private removePreviewShape(): void {
    if (this.previewShape) {
      // DiagramManager.removeShape will remove from DOM and shapes array
      this.diagramManager.removeShape(this.previewShape);
      this.previewShape = null;
    }
  }
  
  private hidePreviewShape(): void {
    if (this.previewShape) {
      this.previewShape.element.style.display = 'none';
    }
  }
  
  private showPreviewShape(): void {
    if (this.previewShape) {
      this.previewShape.element.style.display = '';
    }
  }
  
  private updatePreviewPosition(worldX: number, worldY: number): void {
    if (!this.previewShape) return;
    
    // Snap to grid - this is where the shape will actually be placed
    const snappedX = this.snapToGrid(worldX);
    const snappedY = this.snapToGrid(worldY);
    
    // For square icons, use DEFAULT_WIDTH for both dimensions; otherwise use DEFAULT_WIDTH x DEFAULT_HEIGHT
    const previewWidth = this.DEFAULT_WIDTH;
    const previewHeight = (this.selectedShapeType === 'image' && this.pendingSquareIcon) ? this.DEFAULT_WIDTH : this.DEFAULT_HEIGHT;
    
    // Position preview at the snapped position (top-left corner), matching actual placement
    this.previewShape.layout.resize(snappedX, snappedY, previewWidth, previewHeight);
  }

  private cancelDrawing(): void {
    if (this.currentShape) {
      // DiagramManager.removeShape will remove from DOM and shapes array
      this.diagramManager.removeShape(this.currentShape);
      this.currentShape = null;
    }
    this.isDrawing = false;
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isActive() || e.button !== 0) return false;

    e.preventDefault();
    element.setPointerCapture(e.pointerId);

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const snappedX = this.snapToGrid(worldPos.x);
    const snappedY = this.snapToGrid(worldPos.y);

    this.isDrawing = true;
    this.drawStartPoint = { x: snappedX, y: snappedY };
    
    // Hide preview while drawing
    this.hidePreviewShape();

    // Create the shape (DiagramManager.addShape will append it to the DOM)
    // Pass the name as-is (could be string, null, or undefined)
    this.currentShape = this.diagramManager.createShape(
      this.selectedShapeType,
      snappedX,
      snappedY,
      this.pendingImageUrl || undefined,
      this.pendingImageName ?? undefined,
      this.pendingSquareIcon
    );

    return true;
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    
    if (!this.isDrawing) {
      // Update preview position when not drawing
      this.updatePreviewPosition(worldPos.x, worldPos.y);
      return false;
    }
    
    if (!this.currentShape) return false;

    e.preventDefault();

    const snappedX = this.snapToGrid(worldPos.x);
    const snappedY = this.snapToGrid(worldPos.y);

    // Calculate dimensions
    let x = this.drawStartPoint.x;
    let y = this.drawStartPoint.y;
    let width = snappedX - this.drawStartPoint.x;
    let height = snappedY - this.drawStartPoint.y;

    // Handle negative dimensions (dragging left/up)
    if (width < 0) {
      x = snappedX;
      width = Math.abs(width);
    }
    if (height < 0) {
      y = snappedY;
      height = Math.abs(height);
    }

    // For square icons, maintain square aspect ratio
    if (this.selectedShapeType === 'image' && this.pendingSquareIcon) {
      // Use the larger dimension to maintain square
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = size;
      height = size;
      
      // Adjust position if needed to maintain square from start point
      if (snappedX < this.drawStartPoint.x) {
        x = this.drawStartPoint.x - size;
      }
      if (snappedY < this.drawStartPoint.y) {
        y = this.drawStartPoint.y - size;
      }
    }

    // Minimum size
    width = Math.max(width, GRID_SPACING);
    height = Math.max(height, GRID_SPACING);

    // Update shape
    this.currentShape.layout.resize(x, y, width, height);

    return true;
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isDrawing) return false;

    e.preventDefault();
    try {
      element.releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }

    // Finalize shape
    if (this.currentShape) {
      // Store reference before clearing
      const finalizedShape = this.currentShape;
      
      // Ensure minimum size
      if (finalizedShape.layout.width < GRID_SPACING || finalizedShape.layout.height < GRID_SPACING) {
        // Shape too small, set default size
        finalizedShape.layout.resize(
          finalizedShape.layout.x,
          finalizedShape.layout.y,
          this.DEFAULT_WIDTH,
          this.DEFAULT_HEIGHT
        );
      }

      // Clear drawing state FIRST to prevent any interference
      this.isDrawing = false;
      this.currentShape = null;

      // Select the newly created shape
      this.diagramManager.deselectAllShapes();
      this.diagramManager.selectShape(finalizedShape);
      
      // Ensure text is rendered for the actual shape (text was set in constructor)
      this.diagramManager.updateShapeText(finalizedShape);

      // Show preview again (will be hidden when tool deactivates)
      this.showPreviewShape();

      // Switch to select tool before recording history
      if (this.onRequestToolChange) {
        this.onRequestToolChange('Select');
      }

      // Record history LAST, after everything is finalized and tool is switched
      if (this.onShapeCreated) {
        this.onShapeCreated();
      }

      // Clear pending image after successful creation
      this.pendingImageUrl = null;
      this.pendingImageName = null;
      this.pendingSquareIcon = false;
    } else {
      // No shape was created, just clean up
      this.isDrawing = false;
      this.currentShape = null;
      this.showPreviewShape();
    }

    return true;
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    // Drawing tool doesn't handle wheel events
    return false;
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // ESC to cancel drawing
    if (e.key === 'Escape' && this.isDrawing) {
      this.cancelDrawing();
      return true;
    }

    return false;
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false;
  }

  /**
   * Cancel any ongoing interactions (drawing)
   * Called when interaction is interrupted (context menu, blur, etc.)
   */
  public cancelInteraction(): void {
    if (this.isDrawing) {
      this.cancelDrawing();
    }
  }
}

