import { DiagramTool } from './base'
import { MIN_SCALE, MAX_SCALE, ZOOM_SENSITIVITY, WHEEL_PAN_SPEED } from '../consts/canvas'

const clamp = (value: number, min: number, max: number) => 
  Math.min(Math.max(value, min), max)

export class ZoomTool extends DiagramTool {
  // Callbacks
  private onZoom: ((scale: number, pivotX: number, pivotY: number, clientX: number, clientY: number) => void) | null = null
  private onWheelPan: ((deltaX: number, deltaY: number) => void) | null = null
  private getCurrentScale: (() => number) | null = null
  private getSvgElement: (() => SVGSVGElement | null) | null = null

  constructor(
    onZoom?: (scale: number, pivotX: number, pivotY: number, clientX: number, clientY: number) => void,
    onWheelPan?: (deltaX: number, deltaY: number) => void,
    getCurrentScale?: () => number,
    getSvgElement?: () => SVGSVGElement | null
  ) {
    super('Zoom', 'magnifying-glass')
    this.onZoom = onZoom || null
    this.onWheelPan = onWheelPan || null
    this.getCurrentScale = getCurrentScale || null
    this.getSvgElement = getSvgElement || null
  }

  public setCallbacks(
    onZoom: (scale: number, pivotX: number, pivotY: number, clientX: number, clientY: number) => void,
    onWheelPan: (deltaX: number, deltaY: number) => void,
    getCurrentScale: () => number,
    getSvgElement: () => SVGSVGElement | null
  ) {
    this.onZoom = onZoom
    this.onWheelPan = onWheelPan
    this.getCurrentScale = getCurrentScale
    this.getSvgElement = getSvgElement
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // Zoom tool doesn't handle pointer down
    return false
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    // Zoom tool doesn't handle pointer move
    return false
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // Zoom tool doesn't handle pointer up
    return false
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    // Ctrl + wheel => zoom (always available)
    if (e.ctrlKey) {
      e.preventDefault()

      const svg = this.getSvgElement ? this.getSvgElement() : null
      if (!svg) return false

      const rect = svg.getBoundingClientRect()
      const pointerX = e.clientX - rect.left
      const pointerY = e.clientY - rect.top

      const currentScale = this.getCurrentScale ? this.getCurrentScale() : 1
      const zoomFactor = Math.exp(-e.deltaY * ZOOM_SENSITIVITY)
      const nextScale = clamp(currentScale * zoomFactor, MIN_SCALE, MAX_SCALE)

      if (this.onZoom) {
        this.onZoom(nextScale, pointerX, pointerY, e.clientX, e.clientY)
      }
      
      return true
    }

    // Regular wheel => pan (always available)
    e.preventDefault()
    if (this.onWheelPan) {
      if (e.shiftKey) {
        // Horizontal pan when Shift is held
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        this.onWheelPan(dx * WHEEL_PAN_SPEED, 0)
      } else {
        // Vertical pan
        this.onWheelPan(0, e.deltaY * WHEEL_PAN_SPEED)
      }
    }
    
    return true
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Could handle zoom shortcuts here (e.g., + / - keys)
    return false
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false
  }

  // Helper method for programmatic zoom
  public programmaticZoom(scale: number, pivotX: number, pivotY: number, clientX: number, clientY: number): void {
    const clampedScale = clamp(scale, MIN_SCALE, MAX_SCALE)
    if (this.onZoom) {
      this.onZoom(clampedScale, pivotX, pivotY, clientX, clientY)
    }
  }
}

