/**
 * EdgePanManager handles automatic panning when the pointer is near the edges of the viewport.
 * Used during drag operations and marquee selection.
 * Tracks pointer even when it leaves the browser window.
 */
export class EdgePanManager {
  private isActive: boolean = false;
  private animationFrameId: number | null = null;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private containerRect: DOMRect | null = null;
  
  // Edge pan configuration
  private readonly EDGE_THRESHOLD = 40; // pixels from edge to trigger panning
  private readonly PAN_SPEED = 8; // pixels per frame
  private readonly DIAGONAL_SPEED = 6; // pixels per frame when panning diagonally
  private readonly OUTSIDE_MULTIPLIER = 2; // Speed multiplier when outside viewport
  
  // Callbacks
  private onPan: ((deltaX: number, deltaY: number) => void) | null = null;
  private getContainerRect: (() => DOMRect | null) | null = null;
  private onEdgePanUpdate: (() => void) | null = null; // Called after each pan to update drag/marquee
  
  // Global event handlers for tracking outside window
  private boundHandlePointerMove: ((e: PointerEvent) => void) | null = null;
  private boundHandlePointerUp: ((e: PointerEvent) => void) | null = null;

  constructor(
    onPan?: (deltaX: number, deltaY: number) => void,
    getContainerRect?: () => DOMRect | null,
    onEdgePanUpdate?: () => void
  ) {
    this.onPan = onPan || null;
    this.getContainerRect = getContainerRect || null;
    this.onEdgePanUpdate = onEdgePanUpdate || null;
  }

  public setCallbacks(
    onPan: (deltaX: number, deltaY: number) => void,
    getContainerRect: () => DOMRect | null,
    onEdgePanUpdate: () => void
  ) {
    this.onPan = onPan;
    this.getContainerRect = getContainerRect;
    this.onEdgePanUpdate = onEdgePanUpdate;
  }

  /**
   * Start edge panning with the given pointer position
   */
  public start(clientX: number, clientY: number) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;
    this.containerRect = this.getContainerRect ? this.getContainerRect() : null;
    
    // Set up global pointer tracking to handle movement outside window
    this.boundHandlePointerMove = this.handleGlobalPointerMove.bind(this);
    this.boundHandlePointerUp = this.handleGlobalPointerUp.bind(this);
    
    window.addEventListener('pointermove', this.boundHandlePointerMove, true);
    window.addEventListener('pointerup', this.boundHandlePointerUp, true);
    window.addEventListener('pointercancel', this.boundHandlePointerUp, true);
    
    // Start animation loop
    this.animate();
  }

  /**
   * Update pointer position (called during pointer move)
   */
  public updatePointer(clientX: number, clientY: number) {
    if (!this.isActive) return;
    
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;
    this.containerRect = this.getContainerRect ? this.getContainerRect() : null;
  }

  /**
   * Stop edge panning
   */
  public stop() {
    this.isActive = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Clean up global event listeners
    if (this.boundHandlePointerMove) {
      window.removeEventListener('pointermove', this.boundHandlePointerMove, true);
      this.boundHandlePointerMove = null;
    }
    if (this.boundHandlePointerUp) {
      window.removeEventListener('pointerup', this.boundHandlePointerUp, true);
      window.removeEventListener('pointercancel', this.boundHandlePointerUp, true);
      this.boundHandlePointerUp = null;
    }
  }

  /**
   * Handle pointer move globally (even outside window)
   */
  private handleGlobalPointerMove(e: PointerEvent) {
    this.updatePointer(e.clientX, e.clientY);
  }

  /**
   * Handle pointer up globally
   */
  private handleGlobalPointerUp(_e: PointerEvent) {
    // Stop edge panning when pointer is released
    this.stop();
  }

  /**
   * Check if currently active
   */
  public isEdgePanning(): boolean {
    return this.isActive;
  }

  /**
   * Get last pointer X position (for updating drag/marquee during edge pan)
   */
  public getLastPointerX(): number {
    return this.lastPointerX;
  }

  /**
   * Get last pointer Y position (for updating drag/marquee during edge pan)
   */
  public getLastPointerY(): number {
    return this.lastPointerY;
  }

  /**
   * Animation loop that checks pointer position and pans if near edges
   */
  private animate = () => {
    if (!this.isActive) return;

    // Calculate pan delta based on pointer position
    const { deltaX, deltaY } = this.calculatePanDelta();

    // Apply panning if needed
    if ((deltaX !== 0 || deltaY !== 0) && this.onPan) {
      this.onPan(deltaX, deltaY);
      
      // Notify that edge pan happened so drag/marquee can update their positions
      if (this.onEdgePanUpdate) {
        this.onEdgePanUpdate();
      }
    }

    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Calculate pan delta based on pointer position relative to edges
   */
  private calculatePanDelta(): { deltaX: number; deltaY: number } {
    if (!this.containerRect) {
      return { deltaX: 0, deltaY: 0 };
    }

    // Get pointer position relative to container
    const relativeX = this.lastPointerX - this.containerRect.left;
    const relativeY = this.lastPointerY - this.containerRect.top;

    let deltaX = 0;
    let deltaY = 0;
    let speedMultiplier = 1;

    // Check if pointer is outside the viewport (for faster panning)
    const isOutsideViewport = 
      relativeX < 0 || 
      relativeX > this.containerRect.width || 
      relativeY < 0 || 
      relativeY > this.containerRect.height;
    
    if (isOutsideViewport) {
      speedMultiplier = this.OUTSIDE_MULTIPLIER;
    }

    // Check left edge - pan LEFT to reveal more content on the LEFT
    if (relativeX < this.EDGE_THRESHOLD) {
      const intensity = relativeX < 0 
        ? 1  // Full speed when outside
        : 1 - (relativeX / this.EDGE_THRESHOLD);
      deltaX = this.PAN_SPEED * intensity * speedMultiplier;
    }
    // Check right edge - pan RIGHT to reveal more content on the RIGHT
    else if (relativeX > this.containerRect.width - this.EDGE_THRESHOLD) {
      const distanceFromEdge = this.containerRect.width - relativeX;
      const intensity = distanceFromEdge < 0
        ? 1  // Full speed when outside
        : 1 - (distanceFromEdge / this.EDGE_THRESHOLD);
      deltaX = -this.PAN_SPEED * intensity * speedMultiplier;
    }

    // Check top edge - pan UP to reveal more content on TOP
    if (relativeY < this.EDGE_THRESHOLD) {
      const intensity = relativeY < 0
        ? 1  // Full speed when outside
        : 1 - (relativeY / this.EDGE_THRESHOLD);
      deltaY = this.PAN_SPEED * intensity * speedMultiplier;
    }
    // Check bottom edge - pan DOWN to reveal more content on BOTTOM
    else if (relativeY > this.containerRect.height - this.EDGE_THRESHOLD) {
      const distanceFromEdge = this.containerRect.height - relativeY;
      const intensity = distanceFromEdge < 0
        ? 1  // Full speed when outside
        : 1 - (distanceFromEdge / this.EDGE_THRESHOLD);
      deltaY = -this.PAN_SPEED * intensity * speedMultiplier;
    }

    // If panning diagonally (both X and Y), reduce speed to maintain consistent feel
    if (deltaX !== 0 && deltaY !== 0) {
      const diagonalFactor = this.DIAGONAL_SPEED / this.PAN_SPEED;
      deltaX *= diagonalFactor;
      deltaY *= diagonalFactor;
    }

    return { deltaX, deltaY };
  }
}

