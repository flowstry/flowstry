// Base class for all diagram tools
export abstract class DiagramTool {
  name: string
  icon: string
  protected active: boolean = false
  protected tempActive: boolean = false // For temporary activation (e.g., Space key)

  constructor(name: string, icon: string) {
    this.name = name
    this.icon = icon
  }

  // Check if tool is currently active (selected or temporarily activated)
  public isActive(): boolean {
    return this.active || this.tempActive
  }

  public isSelected(): boolean {
    return this.active
  }

  public isTempActive(): boolean {
    return this.tempActive
  }

  // Activate/deactivate tool
  public activate(): void {
    this.active = true
    this.onActivate()
  }

  public deactivate(): void {
    this.active = false
    this.tempActive = false
    this.onDeactivate()
  }

  // Temporary activation (e.g., holding Space key)
  public tempActivate(): void {
    this.tempActive = true
    this.onTempActivate()
  }

  public tempDeactivate(): void {
    this.tempActive = false
    this.onTempDeactivate()
  }

  // Lifecycle hooks that can be overridden
  protected onActivate(): void {
    // Override in subclass
  }

  protected onDeactivate(): void {
    // Override in subclass
  }

  protected onTempActivate(): void {
    // Override in subclass
  }

  protected onTempDeactivate(): void {
    // Override in subclass
  }

  // Event handlers - return true if event was handled
  abstract handlePointerDown(event: PointerEvent | React.PointerEvent, element: HTMLElement): boolean
  abstract handlePointerUp(event: PointerEvent | React.PointerEvent, element: HTMLElement): boolean
  abstract handlePointerMove(event: PointerEvent | React.PointerEvent): boolean
  abstract handleWheel(event: WheelEvent | React.WheelEvent): boolean
  abstract handleKeyDown(event: KeyboardEvent | React.KeyboardEvent): boolean
  abstract handleKeyUp(event: KeyboardEvent | React.KeyboardEvent): boolean

  // Cancel any ongoing interactions (override in subclass if needed)
  public cancelInteraction(): void {
    // Default implementation does nothing
    // Override in tools that have ongoing state (SelectTool, DrawingTool, PanTool, etc.)
  }
}

