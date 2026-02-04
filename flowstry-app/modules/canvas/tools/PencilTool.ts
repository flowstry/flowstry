import { DiagramManager } from '../shapes'
import { FreehandMarkerType, FreehandShape } from '../shapes/freehand'
import { DiagramTool } from './base'

export class PencilTool extends DiagramTool {
  private diagramManager: DiagramManager
  private markerType: FreehandMarkerType = 'pen'
  private isDrawing: boolean = false
  private currentShape: FreehandShape | null = null
  private points: Array<{ x: number; y: number }> = []

  // Callbacks
  private getContainerElement: (() => HTMLDivElement | null) | null = null
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null
  private getContentLayer: (() => SVGGElement | null) | null = null
  private onShapeCreated: (() => void) | null = null
  private onRequestToolChange: ((toolName: string) => void) | null = null

  // Minimum distance between points to reduce noise
  private readonly MIN_POINT_DISTANCE = 2

  constructor(
    diagramManager: DiagramManager,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer?: () => SVGGElement | null,
    onShapeCreated?: () => void,
    onRequestToolChange?: (toolName: string) => void
  ) {
    super('Pencil', 'pencil')
    this.diagramManager = diagramManager
    this.getContainerElement = getContainerElement || null
    this.getCanvasTransform = getCanvasTransform || null
    this.getContentLayer = getContentLayer || null
    this.onShapeCreated = onShapeCreated || null
    this.onRequestToolChange = onRequestToolChange || null
  }

  public setCallbacks(
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    getContentLayer: () => SVGGElement | null,
    onShapeCreated: () => void,
    onRequestToolChange: (toolName: string) => void
  ): void {
    this.getContainerElement = getContainerElement
    this.getCanvasTransform = getCanvasTransform
    this.getContentLayer = getContentLayer
    this.onShapeCreated = onShapeCreated
    this.onRequestToolChange = onRequestToolChange
  }

  public setMarkerType(type: FreehandMarkerType): void {
    this.markerType = type
  }

  public getMarkerType(): FreehandMarkerType {
    return this.markerType
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const container = this.getContainerElement ? this.getContainerElement() : null
    const transform = this.getCanvasTransform ? this.getCanvasTransform() : { scale: 1, translation: { x: 0, y: 0 } }

    if (!container) return { x: clientX, y: clientY }

    const rect = container.getBoundingClientRect()
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top

    const worldX = (screenX - transform.translation.x) / transform.scale
    const worldY = (screenY - transform.translation.y) / transform.scale

    return { x: worldX, y: worldY }
  }

  private getDistanceSquared(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return dx * dx + dy * dy
  }

  protected onActivate(): void {
    // Set cursor to crosshair when pencil tool is active
  }

  protected onDeactivate(): void {
    // Cancel any ongoing drawing
    if (this.isDrawing) {
      this.cancelDrawing()
    }
  }

  private cancelDrawing(): void {
    if (this.currentShape) {
      this.diagramManager.removeShape(this.currentShape)
      this.currentShape = null
    }
    this.isDrawing = false
    this.points = []
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isActive() || e.button !== 0) return false

    e.preventDefault()
    element.setPointerCapture(e.pointerId)

    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Start drawing
    this.isDrawing = true
    this.points = [worldPos]

    // Create the freehand shape with initial point
    this.currentShape = this.diagramManager.createFreehandShape(
      [worldPos],
      this.markerType
    )

    return true
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    if (!this.isDrawing || !this.currentShape) return false

    e.preventDefault()

    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Only add point if it's far enough from the last point
    const lastPoint = this.points[this.points.length - 1]
    const distSq = this.getDistanceSquared(lastPoint, worldPos)
    const minDistSq = this.MIN_POINT_DISTANCE * this.MIN_POINT_DISTANCE

    if (distSq >= minDistSq) {
      this.points.push(worldPos)
      this.currentShape.addPoint(worldPos.x, worldPos.y)
    }

    return true
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isDrawing) return false

    e.preventDefault()
    try {
      element.releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }

    // Store reference to shape before resetting state
    const completedShape = this.currentShape

    // Reset state for next stroke
    this.currentShape = null
    this.isDrawing = false
    const pointCount = this.points.length
    this.points = []

    // Finalize the shape
    if (completedShape) {
      // Check if we have enough points for a valid shape
      if (pointCount < 2) {
        // Too few points, remove the shape
        this.diagramManager.removeShape(completedShape)
      } else {
        // Record history - but DON'T select or switch tools
        // This allows continuous drawing of multiple strokes
        if (this.onShapeCreated) {
          this.onShapeCreated()
        }
      }
    }

    return true
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    // Pencil tool doesn't handle wheel events
    return false
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // ESC to cancel drawing
    if (e.key === 'Escape' && this.isDrawing) {
      this.cancelDrawing()
      return true
    }

    return false
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false
  }

  /**
   * Cancel any ongoing interactions (drawing)
   * Called when interaction is interrupted (context menu, blur, etc.)
   */
  public cancelInteraction(): void {
    if (this.isDrawing) {
      this.cancelDrawing()
    }
  }
}
