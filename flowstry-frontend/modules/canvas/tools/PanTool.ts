import { DiagramTool } from './base';

export interface PanState {
  translation: { x: number; y: number }
}

import { DiagramManager } from '../shapes';

export class PanTool extends DiagramTool {
  private diagramManager: DiagramManager;
  private isPanning: boolean = false
  private panStartPoint: { x: number; y: number } = { x: 0, y: 0 }
  private panStartTranslation: { x: number; y: number } = { x: 0, y: 0 }
  
  // Callbacks
  private onPanStart: (() => void) | null = null
  private onPan: ((deltaX: number, deltaY: number) => void) | null = null
  private onPanEnd: (() => void) | null = null
  private getCurrentTranslation: (() => { x: number; y: number }) | null = null

  constructor(
    diagramManager: DiagramManager,
    onPanStart?: () => void,
    onPan?: (deltaX: number, deltaY: number) => void,
    onPanEnd?: () => void,
    getCurrentTranslation?: () => { x: number; y: number }
  ) {
    super('Pan', 'hand')
    this.diagramManager = diagramManager
    this.onPanStart = onPanStart || null
    this.onPan = onPan || null
    this.onPanEnd = onPanEnd || null
    this.getCurrentTranslation = getCurrentTranslation || null
  }

  public setCallbacks(
    onPanStart: () => void,
    onPan: (deltaX: number, deltaY: number) => void,
    onPanEnd: () => void,
    getCurrentTranslation: () => { x: number; y: number }
  ) {
    this.onPanStart = onPanStart
    this.onPan = onPan
    this.onPanEnd = onPanEnd
    this.getCurrentTranslation = getCurrentTranslation
  }

  protected onActivate(): void {
    // Tool selected as primary tool
  }

  protected onDeactivate(): void {
    // Reset panning state when tool is deactivated
    if (this.isPanning) {
      this.endPan()
    }
  }

  protected onTempActivate(): void {
    // Temporarily activated (e.g., Space key pressed)
  }

  protected onTempDeactivate(): void {
    // Temporarily deactivated (e.g., Space key released)
    if (this.isPanning) {
      this.endPan()
    }
  }

  private startPan(x: number, y: number): void {
    if (this.isPanning) return
    
    this.isPanning = true
    this.panStartPoint = { x, y }
    
    if (this.getCurrentTranslation) {
      this.panStartTranslation = this.getCurrentTranslation()
    }
    
    if (this.onPanStart) {
      this.onPanStart()
    }
  }

  private updatePan(x: number, y: number): void {
    if (!this.isPanning) return
    
    const deltaX = x - this.panStartPoint.x
    const deltaY = y - this.panStartPoint.y
    
    if (this.onPan) {
      this.onPan(deltaX, deltaY)
    }
  }

  private endPan(): void {
    if (!this.isPanning) return
    
    this.isPanning = false
    
    if (this.onPanEnd) {
      this.onPanEnd()
    }
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // Middle mouse button (scroll wheel click) always works for panning
    if (e.button === 1) {
      e.preventDefault()
      element.setPointerCapture(e.pointerId)
      this.startPan(e.clientX, e.clientY)
      return true
    }
    
    // Left click only works if tool is active (selected or temp activated)
    if (e.button === 0 && this.isActive()) {
      e.preventDefault()
      element.setPointerCapture(e.pointerId)
      this.startPan(e.clientX, e.clientY)
      return true
    }
    
    return false
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    if (!this.isPanning) return false
    
    e.preventDefault()
    this.updatePan(e.clientX, e.clientY)
    return true
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    if (!this.isPanning) return false
    
    e.preventDefault()
    try {
      element.releasePointerCapture(e.pointerId)
    } catch {
      // noop
    }
    this.endPan()
    return true
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    // Pan tool doesn't handle wheel events directly
    // Wheel panning is always available regardless of active tool
    return false
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Space key is handled by InteractionEngine to temp activate this tool
    return false
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Space key is handled by InteractionEngine to temp deactivate this tool
    return false
  }

  public isPanningActive(): boolean {
    return this.isPanning
  }

  /**
   * Cancel any ongoing interactions (panning)
   * Called when interaction is interrupted (context menu, blur, etc.)
   */
  public cancelInteraction(): void {
    if (this.isPanning) {
      this.endPan()
    }
  }
}

