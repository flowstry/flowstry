import { DiagramTool } from './base';

export interface LaserPoint {
  x: number
  y: number
  timestamp: number
}

export interface LaserStroke {
  id: string
  points: LaserPoint[]
}

export type LaserStrokePhase = 'start' | 'move' | 'end'

export interface LaserStrokeEvent {
  strokeId: string
  phase: LaserStrokePhase
  point: LaserPoint
}

export class LaserPointerTool extends DiagramTool {
  private isDrawing: boolean = false
  private currentStroke: LaserStroke | null = null
  private strokes: LaserStroke[] = []
  private strokeIdCounter: number = 0

  // Callbacks
  private getContainerElement: (() => HTMLDivElement | null) | null = null
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null
  private onStrokesChange: ((strokes: LaserStroke[]) => void) | null = null
  private onStrokeEvent: ((event: LaserStrokeEvent) => void) | null = null

  // Minimum distance between points to reduce noise
  private readonly MIN_POINT_DISTANCE = 1
  // Time between each point starting to fade (stagger for sequence order)
  static readonly STAGGER_MS = 30
  // Duration of the fade animation for each point
  static readonly FADE_DURATION_MS = 2000

  constructor(
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    onStrokesChange?: (strokes: LaserStroke[]) => void
  ) {
    super('LaserPointer', 'laser')
    this.getContainerElement = getContainerElement || null
    this.getCanvasTransform = getCanvasTransform || null
    this.onStrokesChange = onStrokesChange || null
  }

  public setCallbacks(
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    onStrokesChange: (strokes: LaserStroke[]) => void,
    onStrokeEvent?: (event: LaserStrokeEvent) => void
  ): void {
    this.getContainerElement = getContainerElement
    this.getCanvasTransform = getCanvasTransform
    this.onStrokesChange = onStrokesChange
    this.onStrokeEvent = onStrokeEvent || null
  }

  public getStrokes(): LaserStroke[] {
    return this.strokes
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

  private notifyStrokesChange(): void {
    if (this.onStrokesChange) {
      this.onStrokesChange([...this.strokes])
    }
  }

  private notifyStrokeEvent(phase: LaserStrokePhase, point: LaserPoint): void {
    if (!this.onStrokeEvent || !this.currentStroke) return
    this.onStrokeEvent({
      strokeId: this.currentStroke.id,
      phase,
      point
    })
  }

  protected onActivate(): void {
    // Set cursor to crosshair when laser pointer tool is active
  }

  protected onDeactivate(): void {
    // Cancel any ongoing drawing
    if (this.isDrawing) {
      this.cancelDrawing()
    }
  }

  private cancelDrawing(): void {
    this.currentStroke = null
    this.isDrawing = false
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isActive() || e.button !== 0) return false

    e.preventDefault()
    element.setPointerCapture(e.pointerId)

    const worldPos = this.screenToWorld(e.clientX, e.clientY)
    const now = Date.now()

    // Start drawing
    this.isDrawing = true
    this.currentStroke = {
      id: `laser-${this.strokeIdCounter++}`,
      points: [{ x: worldPos.x, y: worldPos.y, timestamp: now }]
    }
    this.strokes.push(this.currentStroke)
    this.notifyStrokesChange()
    this.notifyStrokeEvent('start', { x: worldPos.x, y: worldPos.y, timestamp: now })

    return true
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    if (!this.isDrawing || !this.currentStroke) return false

    e.preventDefault()

    const worldPos = this.screenToWorld(e.clientX, e.clientY)

    // Only add point if it's far enough from the last point
    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1]
    const distSq = this.getDistanceSquared(lastPoint, worldPos)
    const minDistSq = this.MIN_POINT_DISTANCE * this.MIN_POINT_DISTANCE

    if (distSq >= minDistSq) {
      const point = { x: worldPos.x, y: worldPos.y, timestamp: Date.now() }
      this.currentStroke.points.push(point)
      this.notifyStrokesChange()
      this.notifyStrokeEvent('move', point)
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

    // Just finish the stroke - it will fade out naturally
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1]
      this.notifyStrokeEvent('end', lastPoint)
    }
    this.currentStroke = null
    this.isDrawing = false

    return true
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    // Laser pointer doesn't handle wheel events
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

  /**
   * Clean up old points that have fully faded out
   * Called by the animation loop in Canvas
   */
  public cleanupOldStrokes(): void {
    const now = Date.now()
    const fadeDuration = LaserPointerTool.FADE_DURATION_MS
    const stagger = LaserPointerTool.STAGGER_MS
    let changed = false
    
    // Filter out old points from each stroke based on sequence-based timing
    for (const stroke of this.strokes) {
      if (stroke.points.length === 0) continue

      const firstTimestamp = stroke.points[0].timestamp
      const beforeCount = stroke.points.length

      stroke.points = stroke.points.filter((_, index) => {
        // Each point's fade start time is staggered by index
        const fadeStartTime = firstTimestamp + (index * stagger)
        const timeSinceFadeStart = now - fadeStartTime
        // Keep point if it hasn't fully faded
        return timeSinceFadeStart < fadeDuration
      })

      if (stroke.points.length !== beforeCount) {
        changed = true
      }
    }
    
    // Remove empty strokes
    const beforeStrokeCount = this.strokes.length
    this.strokes = this.strokes.filter(stroke => stroke.points.length > 0)
    if (this.strokes.length !== beforeStrokeCount) {
      changed = true
    }
    
    if (changed) {
      this.notifyStrokesChange()
    }
  }
}
