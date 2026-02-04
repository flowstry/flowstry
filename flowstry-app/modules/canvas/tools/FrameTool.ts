import { GRID_SPACING } from '../consts/canvas'
import { DiagramManager } from '../shapes'
import { FrameShape } from '../shapes/FrameShape'
import { DiagramTool } from './base'

/**
 * FrameTool - Tool for drawing frames via click-and-drag
 * Similar to DrawingTool but without preview shape, just crosshair cursor
 */
export class FrameTool extends DiagramTool {
  private diagramManager: DiagramManager
  private isDrawing: boolean = false
  private drawStartPoint: { x: number; y: number } = { x: 0, y: 0 }
  private currentFrame: FrameShape | null = null
  
  // Callbacks
  private getSvgElement: (() => SVGSVGElement | null) | null = null
  private getContainerElement: (() => HTMLDivElement | null) | null = null
  private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null
  private onFrameCreated: (() => void) | null = null
  private onRequestToolChange: ((toolName: string) => void) | null = null

  constructor(
    diagramManager: DiagramManager,
    getSvgElement?: () => SVGSVGElement | null,
    getContainerElement?: () => HTMLDivElement | null,
    getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
    onFrameCreated?: () => void,
    onRequestToolChange?: (toolName: string) => void
  ) {
    super('Frame', 'frame')
    this.diagramManager = diagramManager
    this.getSvgElement = getSvgElement || null
    this.getContainerElement = getContainerElement || null
    this.getCanvasTransform = getCanvasTransform || null
    this.onFrameCreated = onFrameCreated || null
    this.onRequestToolChange = onRequestToolChange || null
  }

  public setCallbacks(
    getSvgElement: () => SVGSVGElement | null,
    getContainerElement: () => HTMLDivElement | null,
    getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
    onFrameCreated: () => void,
    onRequestToolChange: (toolName: string) => void
  ) {
    this.getSvgElement = getSvgElement
    this.getContainerElement = getContainerElement
    this.getCanvasTransform = getCanvasTransform
    this.onFrameCreated = onFrameCreated
    this.onRequestToolChange = onRequestToolChange
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

  private snapToGrid(value: number): number {
    if (!this.diagramManager.getSnapToGrid()) {
      return value
    }
    const offset = GRID_SPACING / 2
    return Math.round((value - offset) / GRID_SPACING) * GRID_SPACING + offset
  }

  protected onActivate(): void {
    // Set crosshair cursor on container
    const container = this.getContainerElement ? this.getContainerElement() : null
    if (container) {
      container.style.cursor = 'crosshair'
    }
  }

  protected onDeactivate(): void {
    // Cancel any ongoing drawing
    if (this.isDrawing) {
      this.cancelDrawing()
    }
    
    // Reset cursor
    const container = this.getContainerElement ? this.getContainerElement() : null
    if (container) {
      container.style.cursor = ''
    }
  }

  private cancelDrawing(): void {
    if (this.currentFrame) {
      this.diagramManager.removeShape(this.currentFrame)
      this.currentFrame = null
    }
    this.isDrawing = false
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isActive() || e.button !== 0) return false

    e.preventDefault()
    element.setPointerCapture(e.pointerId)

    const worldPos = this.screenToWorld(e.clientX, e.clientY)
    const snappedX = this.snapToGrid(worldPos.x)
    const snappedY = this.snapToGrid(worldPos.y)

    this.isDrawing = true
    this.drawStartPoint = { x: snappedX, y: snappedY }

    // Create the frame with minimal size initially (will grow with drag)
    this.currentFrame = this.diagramManager.createFrame(
      snappedX,
      snappedY,
      1,  // Start with 1px, will resize on move
      1,
      'Frame'  // Default label
    )

    return true
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    if (!this.isDrawing || !this.currentFrame) return false

    e.preventDefault()

    const worldPos = this.screenToWorld(e.clientX, e.clientY)
    const snappedX = this.snapToGrid(worldPos.x)
    const snappedY = this.snapToGrid(worldPos.y)

    // Calculate dimensions
    let x = this.drawStartPoint.x
    let y = this.drawStartPoint.y
    let width = snappedX - this.drawStartPoint.x
    let height = snappedY - this.drawStartPoint.y

    // Handle negative dimensions (dragging left/up)
    if (width < 0) {
      x = snappedX
      width = Math.abs(width)
    }
    if (height < 0) {
      y = snappedY
      height = Math.abs(height)
    }

    // Minimum size while drawing
    width = Math.max(width, GRID_SPACING)
    height = Math.max(height, GRID_SPACING)

    // Update frame
    this.currentFrame.layout.resize(x, y, width, height)

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

    // Finalize frame
    if (this.currentFrame) {
      const finalizedFrame = this.currentFrame
      
      // Ensure minimum size (100x80 as defined in FrameShape)
      if (finalizedFrame.layout.width < 100 || finalizedFrame.layout.height < 80) {
        finalizedFrame.layout.resize(
          finalizedFrame.layout.x,
          finalizedFrame.layout.y,
          Math.max(100, finalizedFrame.layout.width),
          Math.max(80, finalizedFrame.layout.height)
        )
      }

      // Clear drawing state
      this.isDrawing = false
      this.currentFrame = null

      // Check if frame is inside another frame (nested)
      this.checkAndSetNestedFrame(finalizedFrame)

      // Select the newly created frame
      this.diagramManager.deselectAllShapes()
      this.diagramManager.selectShape(finalizedFrame)

      // Switch to select tool
      if (this.onRequestToolChange) {
        this.onRequestToolChange('Select')
      }

      // Record history
      if (this.onFrameCreated) {
        this.onFrameCreated()
      }
    } else {
      this.isDrawing = false
      this.currentFrame = null
    }

    return true
  }

  /**
   * Check if the frame is inside another frame and set nested status
   */
  private checkAndSetNestedFrame(frame: FrameShape): void {
    const frames = this.diagramManager.getFrames()
    
    // Find parent frame that contains this frame
    for (const parentFrame of frames) {
      if (parentFrame.id === frame.id) continue
      
      // Check if frame is 50%+ inside parent frame
      if (parentFrame.containsShapeByPercentage(
        frame.layout.x, frame.layout.y, frame.layout.width, frame.layout.height, 0.5
      )) {
        // Mark as nested and add to parent
        frame.setIsNestedFrame(true)
        frame.parentId = parentFrame.id
        parentFrame.addChildFrame(frame.id)
        return
      }
    }
    
    // Not nested
    frame.setIsNestedFrame(false)
  }

  public handleWheel(_e: WheelEvent | React.WheelEvent): boolean {
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

  public handleKeyUp(_e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false
  }

  /**
   * Cancel any ongoing interactions
   */
  public cancelInteraction(): void {
    if (this.isDrawing) {
      this.cancelDrawing()
    }
  }
}
