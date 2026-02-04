import { SVG_NAMESPACE } from '../consts/svg';

export type ResizeHandle = 
  | 'nw' | 'n' | 'ne' 
  | 'w' | 'e' 
  | 'sw' | 's' | 'se'
  | 'move'
  | null;

export type QuickConnectSide = 'top' | 'right' | 'bottom' | 'left';

export class SelectionOverlay {
  private container: SVGGElement;
  private rect: SVGRectElement;
  private handles: Map<ResizeHandle, SVGRectElement> = new Map();
  
  // Dimensions
  private x: number = 0;
  private y: number = 0;
  private width: number = 0;
  private height: number = 0;
  
  // Handle size (base size, will be adjusted for zoom)
  private readonly BASE_HANDLE_SIZE = 10;
  private readonly MIN_HANDLE_SIZE = 5; // Minimum size for corner squares
  private readonly BASE_STROKE_WIDTH = 2;
  private readonly BASE_HANDLE_STROKE_WIDTH = 1.5;
  private readonly BASE_HANDLE_RADIUS = 2;
  private currentScale: number = 1;
  private currentHandleSize: number = 10;
  private currentStrokeWidth: number = 2;
  private currentHandleStrokeWidth: number = 1.5;
  private currentHandleRadius: number = 2;
  
  // Quick Connect properties
  private readonly QUICK_CONNECT_DOT_SIZE = 12; // Increased for better visibility
  private readonly QUICK_CONNECT_DOT_EXPANDED_SIZE = 24;
  private readonly QUICK_CONNECT_OFFSET = 20; // Distance from edge
  // private readonly QUICK_CONNECT_HOVER_THRESHOLD = GRID_SPACING * 2; // Hover detection threshold
  private quickConnectDots: Map<QuickConnectSide, SVGGElement> = new Map();
  private quickConnectEnabled: boolean = false;
  private hoveredQuickConnect: QuickConnectSide | null = null;
  private activeQuickConnect: QuickConnectSide | null = null; // When clicked/showing preview

  // Quick connect drag detection
  private quickConnectPointerDown: boolean = false;
  private quickConnectPointerDownSide: QuickConnectSide | null = null;
  private quickConnectPointerStartPos: { x: number; y: number } | null = null;
  private readonly QUICK_CONNECT_DRAG_THRESHOLD = 3; // Pixels to move before starting drag

  // Callbacks
  private onHoverChange: ((handle: ResizeHandle) => void) | null = null;
  private onQuickConnectHover: ((side: QuickConnectSide | null) => void) | null = null;
  private onQuickConnectClick: ((side: QuickConnectSide) => void) | null = null;
  private onQuickConnectDragStart: ((side: QuickConnectSide, clientX: number, clientY: number) => void) | null = null;

  constructor(onHoverChange?: (handle: ResizeHandle) => void) {
    this.onHoverChange = onHoverChange || null;
    
    // Create container group
    this.container = document.createElementNS(SVG_NAMESPACE, 'g');
    this.container.setAttribute('pointer-events', 'none'); // Will be overridden on children
    
    // Create main rectangle
    this.rect = document.createElementNS(SVG_NAMESPACE, 'rect');
    this.rect.setAttribute('fill', 'none');
    this.rect.setAttribute('stroke', '#3b82f6'); // Blue
    this.rect.setAttribute('stroke-width', String(this.currentStrokeWidth));
    this.rect.setAttribute('pointer-events', 'all'); // Enable for double-click detection
    this.rect.setAttribute('data-selection-overlay', 'true'); // Marker for identification
    this.rect.style.cursor = 'move';
    this.container.appendChild(this.rect);
    
    // Create resize handles
    this.createHandles();
    
    // Create quick connect dots
    this.createQuickConnectDots();

    // Add event listeners
    this.addEventListeners();
  }

  private createHandles(): void {
    const cornerHandles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
    const edgeHandles: ResizeHandle[] = ['n', 's', 'e', 'w'];
    
    // Create edge handles FIRST (invisible wide/tall rectangles along the stroke)
    edgeHandles.forEach(handle => {
      const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
      rect.setAttribute('fill', 'transparent'); // Invisible
      rect.setAttribute('stroke', 'none');
      rect.setAttribute('pointer-events', 'all'); // Enable pointer events for resize
      rect.setAttribute('data-handle', handle ?? '');
      rect.style.cursor = this.getCursorForHandle(handle);

      this.handles.set(handle, rect);
      this.container.appendChild(rect);
    });
    
    // Create corner handles AFTER edges (visible squares) so they appear on top
    cornerHandles.forEach(handle => {
      const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
      rect.setAttribute('fill', 'white');
      rect.setAttribute('stroke', '#3b82f6');
      rect.setAttribute('stroke-width', String(this.currentHandleStrokeWidth));
      rect.setAttribute('rx', String(this.currentHandleRadius));
      rect.setAttribute('ry', String(this.currentHandleRadius));
      rect.setAttribute('width', String(this.currentHandleSize));
      rect.setAttribute('height', String(this.currentHandleSize));
      rect.setAttribute('pointer-events', 'all'); // Enable pointer events for resize
      rect.setAttribute('data-handle', handle ?? ''); // Ensure a string is always set
      rect.style.cursor = this.getCursorForHandle(handle);

      this.handles.set(handle, rect);
      this.container.appendChild(rect);
    });
  }

  private getCursorForHandle(handle: ResizeHandle): string {
    switch (handle) {
      case 'nw': return 'nwse-resize'; // ↖↘
      case 'n': return 'ns-resize';    // ↕
      case 'ne': return 'nesw-resize'; // ↗↙
      case 'w': return 'ew-resize';    // ↔
      case 'e': return 'ew-resize';    // ↔
      case 'sw': return 'nesw-resize'; // ↗↙
      case 's': return 'ns-resize';    // ↕
      case 'se': return 'nwse-resize'; // ↖↘
      case 'move': return 'move';
      default: return 'default';
    }
  }

  private addEventListeners(): void {
    // Main rect hover for move cursor
    this.rect.addEventListener('mouseenter', () => {
      if (this.onHoverChange) {
        this.onHoverChange('move');
      }
    });
    
    this.rect.addEventListener('mouseleave', () => {
      if (this.onHoverChange) {
        this.onHoverChange(null);
      }
    });
    
    // Handle hovers
    this.handles.forEach((handleEl, handle) => {
      handleEl.addEventListener('mouseenter', () => {
        if (this.onHoverChange) {
          this.onHoverChange(handle);
        }
      });
      
      handleEl.addEventListener('mouseleave', () => {
        if (this.onHoverChange) {
          this.onHoverChange(null);
        }
      });
    });
  }

  public updateBounds(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    
    // Update main rectangle
    this.rect.setAttribute('x', String(x));
    this.rect.setAttribute('y', String(y));
    this.rect.setAttribute('width', String(width));
    this.rect.setAttribute('height', String(height));
    
    // Update corner handle positions (small squares)
    const halfHandle = this.currentHandleSize / 2;
    
    // Top-left corner
    const nwHandle = this.handles.get('nw');
    if (nwHandle) {
      nwHandle.setAttribute('x', String(x - halfHandle));
      nwHandle.setAttribute('y', String(y - halfHandle));
    }
    
    // Top-right corner
    const neHandle = this.handles.get('ne');
    if (neHandle) {
      neHandle.setAttribute('x', String(x + width - halfHandle));
      neHandle.setAttribute('y', String(y - halfHandle));
    }
    
    // Bottom-left corner
    const swHandle = this.handles.get('sw');
    if (swHandle) {
      swHandle.setAttribute('x', String(x - halfHandle));
      swHandle.setAttribute('y', String(y + height - halfHandle));
    }
    
    // Bottom-right corner
    const seHandle = this.handles.get('se');
    if (seHandle) {
      seHandle.setAttribute('x', String(x + width - halfHandle));
      seHandle.setAttribute('y', String(y + height - halfHandle));
    }
    
    // Update edge handle positions (wide/tall rectangles spanning entire edges)
    const edgeHitArea = 10; // Width/height of the hit area for edge handles
    const halfEdge = edgeHitArea / 2;
    
    // Top edge (spans full width)
    const nHandle = this.handles.get('n');
    if (nHandle) {
      nHandle.setAttribute('x', String(x));
      nHandle.setAttribute('y', String(y - halfEdge));
      nHandle.setAttribute('width', String(width));
      nHandle.setAttribute('height', String(edgeHitArea));
    }
    
    // Bottom edge (spans full width)
    const sHandle = this.handles.get('s');
    if (sHandle) {
      sHandle.setAttribute('x', String(x));
      sHandle.setAttribute('y', String(y + height - halfEdge));
      sHandle.setAttribute('width', String(width));
      sHandle.setAttribute('height', String(edgeHitArea));
    }
    
    // Left edge (spans full height)
    const wHandle = this.handles.get('w');
    if (wHandle) {
      wHandle.setAttribute('x', String(x - halfEdge));
      wHandle.setAttribute('y', String(y));
      wHandle.setAttribute('width', String(edgeHitArea));
      wHandle.setAttribute('height', String(height));
    }
    
    // Right edge (spans full height)
    const eHandle = this.handles.get('e');
    if (eHandle) {
      eHandle.setAttribute('x', String(x + width - halfEdge));
      eHandle.setAttribute('y', String(y));
      eHandle.setAttribute('width', String(edgeHitArea));
      eHandle.setAttribute('height', String(height));
    }

    // Update quick connect dot positions
    this.updateQuickConnectDotPositions();
  }

  public show(): void {
    this.container.style.display = '';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public getElement(): SVGGElement {
    return this.container;
  }

  public applyTransform(translateX: number, translateY: number): void {
    this.container.setAttribute('transform', `translate(${translateX}, ${translateY})`);
  }

  public clearTransform(): void {
    this.container.removeAttribute('transform');
  }

  public isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  public destroy(): void {
    this.container.remove();
  }

  public getHandleAtPoint(x: number, y: number): ResizeHandle {
    // Check if point is inside main rect (for move)
    if (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    ) {
      // Check if near edges (for edge resize)
      const edgeThreshold = 5;
      const nearTop = Math.abs(y - this.y) <= edgeThreshold;
      const nearBottom = Math.abs(y - (this.y + this.height)) <= edgeThreshold;
      const nearLeft = Math.abs(x - this.x) <= edgeThreshold;
      const nearRight = Math.abs(x - (this.x + this.width)) <= edgeThreshold;
      
      if (nearTop && nearLeft) return 'nw';
      if (nearTop && nearRight) return 'ne';
      if (nearBottom && nearLeft) return 'sw';
      if (nearBottom && nearRight) return 'se';
      if (nearTop) return 'n';
      if (nearBottom) return 's';
      if (nearLeft) return 'w';
      if (nearRight) return 'e';
      
      return 'move';
    }
    
    return null;
  }

  public getHandleFromElement(element: Element): ResizeHandle {
    // Check if the element itself is a handle
    const handleAttr = (element as SVGElement).getAttribute?.('data-handle');
    if (handleAttr) {
      return handleAttr as ResizeHandle;
    }
    
    // Check if parent is a handle
    const parent = element.parentElement;
    if (parent) {
      const parentHandleAttr = parent.getAttribute?.('data-handle');
      if (parentHandleAttr) {
        return parentHandleAttr as ResizeHandle;
      }
    }
    
    return null;
  }

  public getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  public setEditingMode(isEditing: boolean): void {
    if (isEditing) {
      // Hide all handles
      this.handles.forEach(handle => {
        handle.style.display = 'none';
      });
      
      // Change border to lighter blue
      this.rect.setAttribute('stroke', '#bfdbfe'); // Light blue
      this.rect.setAttribute('stroke-width', '2');
      
      // Disable pointer events so clicks pass through to the text editor
      this.rect.setAttribute('pointer-events', 'none');
      this.container.setAttribute('pointer-events', 'none');
    } else {
      // Show all handles
      this.handles.forEach(handle => {
        handle.style.display = '';
      });
      
      // Restore normal border color
      this.rect.setAttribute('stroke', '#3b82f6'); // Normal blue
      this.rect.setAttribute('stroke-width', String(this.currentStrokeWidth));
      
      // Re-enable pointer events for resize/move interactions
      this.rect.setAttribute('pointer-events', 'all');
      this.container.setAttribute('pointer-events', 'none'); // Container stays none, children handle events
    }
  }

  /**
   * Show or hide resize handles based on whether the selected shapes are resizable.
   * When resizable is false, only the move cursor is available (no corner/edge handles).
   */
  public setResizable(resizable: boolean): void {
    this.handles.forEach(handle => {
      handle.style.display = resizable ? '' : 'none';
    });
  }

  public updateScale(scale: number): void {
    this.currentScale = scale;
    
    // Calculate sizes that will appear constant on screen
    // Divide by scale so they grow in world space as zoom increases
    // But enforce minimum size for handles so they don't get too small
    this.currentHandleSize = Math.max(this.BASE_HANDLE_SIZE / scale, this.MIN_HANDLE_SIZE);
    this.currentStrokeWidth = this.BASE_STROKE_WIDTH / scale;
    this.currentHandleStrokeWidth = this.BASE_HANDLE_STROKE_WIDTH / scale;
    this.currentHandleRadius = this.BASE_HANDLE_RADIUS / scale;
    
    // Update main rectangle stroke width
    this.rect.setAttribute('stroke-width', String(this.currentStrokeWidth));
    
    // Update corner handle sizes, stroke widths, and border radius
    const cornerHandles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
    cornerHandles.forEach(handleType => {
      const handle = this.handles.get(handleType);
      if (handle) {
        handle.setAttribute('width', String(this.currentHandleSize));
        handle.setAttribute('height', String(this.currentHandleSize));
        handle.setAttribute('stroke-width', String(this.currentHandleStrokeWidth));
        handle.setAttribute('rx', String(this.currentHandleRadius));
        handle.setAttribute('ry', String(this.currentHandleRadius));
      }
    });
    
    // Update quick connect dots scale
    if (this.quickConnectEnabled) {
      this.updateQuickConnectScale();
    }

    // Re-apply bounds to update handle positions with new sizes
    this.updateBounds(this.x, this.y, this.width, this.height);
  }

  // ==================== Quick Connect Methods ====================

  private createQuickConnectDots(): void {
    const sides: QuickConnectSide[] = ['top', 'right', 'bottom', 'left'];

    sides.forEach(side => {
      const group = document.createElementNS(SVG_NAMESPACE, 'g');
      group.setAttribute('class', 'quick-connect-dot');
      group.setAttribute('data-quick-connect', side);
      group.setAttribute('pointer-events', 'all'); // Enable pointer events on the group
      group.style.cursor = 'pointer';
      group.style.display = 'none'; // Hidden by default

      // Create the circle
      const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
      circle.setAttribute('r', String(this.QUICK_CONNECT_DOT_SIZE / 2 / this.currentScale));
      circle.setAttribute('fill', 'white');
      circle.setAttribute('stroke', '#3b82f6');
      circle.setAttribute('stroke-width', String(1.5 / this.currentScale));
      circle.setAttribute('pointer-events', 'all');
      circle.style.transition = 'r 150ms ease-out, fill 150ms ease-out';
      group.appendChild(circle);

      // Create the arrow icon (initially hidden)
      const arrow = this.createArrowIcon(side);
      arrow.style.opacity = '0';
      arrow.style.transition = 'opacity 150ms ease-out';
      group.appendChild(arrow);

      // Add event listeners
      group.addEventListener('mouseenter', () => this.handleQuickConnectMouseEnter(side));
      group.addEventListener('mouseleave', () => this.handleQuickConnectMouseLeave());

      // Use pointerdown/move/up for drag detection
      group.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.handleQuickConnectPointerDown(side, e);
      });
      group.addEventListener('pointermove', (e) => {
        this.handleQuickConnectPointerMove(e);
      });
      group.addEventListener('pointerup', (e) => {
        this.handleQuickConnectPointerUp(side, e);
      });
      group.addEventListener('pointercancel', () => {
        this.resetQuickConnectPointerState();
      });

      this.quickConnectDots.set(side, group);
      this.container.appendChild(group);
    });
  }

  private createArrowIcon(side: QuickConnectSide): SVGGElement {
    const iconGroup = document.createElementNS(SVG_NAMESPACE, 'g');
    iconGroup.setAttribute('class', 'quick-connect-arrow');

    // Create arrow path pointing in the direction of the side
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    const size = 8 / this.currentScale;
    const halfSize = size / 2;

    // Arrow paths for each direction (centered at 0,0)
    let d: string;
    switch (side) {
      case 'top':
        d = `M 0 ${halfSize} L 0 ${-halfSize} M ${-halfSize * 0.6} ${-halfSize * 0.3} L 0 ${-halfSize} L ${halfSize * 0.6} ${-halfSize * 0.3}`;
        break;
      case 'bottom':
        d = `M 0 ${-halfSize} L 0 ${halfSize} M ${-halfSize * 0.6} ${halfSize * 0.3} L 0 ${halfSize} L ${halfSize * 0.6} ${halfSize * 0.3}`;
        break;
      case 'left':
        d = `M ${halfSize} 0 L ${-halfSize} 0 M ${-halfSize * 0.3} ${-halfSize * 0.6} L ${-halfSize} 0 L ${-halfSize * 0.3} ${halfSize * 0.6}`;
        break;
      case 'right':
        d = `M ${-halfSize} 0 L ${halfSize} 0 M ${halfSize * 0.3} ${-halfSize * 0.6} L ${halfSize} 0 L ${halfSize * 0.3} ${halfSize * 0.6}`;
        break;
    }

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#3b82f6');
    path.setAttribute('stroke-width', String(1.5 / this.currentScale));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    iconGroup.appendChild(path);

    return iconGroup;
  }

  private updateQuickConnectDotPositions(): void {
    if (!this.quickConnectEnabled) return;

    const offset = this.QUICK_CONNECT_OFFSET / this.currentScale;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    // Position each dot
    const positions: Record<QuickConnectSide, { x: number; y: number }> = {
      top: { x: centerX, y: this.y - offset },
      bottom: { x: centerX, y: this.y + this.height + offset },
      left: { x: this.x - offset, y: centerY },
      right: { x: this.x + this.width + offset, y: centerY }
    };

    this.quickConnectDots.forEach((group, side) => {
      const pos = positions[side];
      group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    });
  }

  private handleQuickConnectMouseEnter(side: QuickConnectSide): void {
    this.hoveredQuickConnect = side;
    this.updateQuickConnectDotAppearance(side, true);

    if (this.onQuickConnectHover) {
      this.onQuickConnectHover(side);
    }
  }

  private handleQuickConnectMouseLeave(): void {
    const previousHovered = this.hoveredQuickConnect;
    this.hoveredQuickConnect = null;

    if (previousHovered && !this.activeQuickConnect) {
      this.updateQuickConnectDotAppearance(previousHovered, false);
    }

    if (this.onQuickConnectHover) {
      this.onQuickConnectHover(null);
    }
  }

  private handleQuickConnectMouseClick(side: QuickConnectSide): void {
    if (this.onQuickConnectClick) {
      this.onQuickConnectClick(side);
    }
  }

  private handleQuickConnectPointerDown(side: QuickConnectSide, e: PointerEvent): void {
    this.quickConnectPointerDown = true;
    this.quickConnectPointerDownSide = side;
    this.quickConnectPointerStartPos = { x: e.clientX, y: e.clientY };

    // Capture the pointer to receive move/up events even if cursor leaves the element
    const target = e.target as Element;
    const group = target.closest('[data-quick-connect]') as SVGGElement;
    if (group) {
      group.setPointerCapture(e.pointerId);
    }
  }

  private handleQuickConnectPointerMove(e: PointerEvent): void {
    if (!this.quickConnectPointerDown || !this.quickConnectPointerDownSide || !this.quickConnectPointerStartPos) {
      return;
    }

    // Check if we've moved past the drag threshold
    const dx = e.clientX - this.quickConnectPointerStartPos.x;
    const dy = e.clientY - this.quickConnectPointerStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= this.QUICK_CONNECT_DRAG_THRESHOLD) {
      // Start drag!
      const side = this.quickConnectPointerDownSide;
      this.resetQuickConnectPointerState();

      // Release pointer capture
      const target = e.target as Element;
      const group = target.closest('[data-quick-connect]') as SVGGElement;
      if (group && group.hasPointerCapture(e.pointerId)) {
        group.releasePointerCapture(e.pointerId);
      }

      if (this.onQuickConnectDragStart) {
        this.onQuickConnectDragStart(side, e.clientX, e.clientY);
      }
    }
  }

  private handleQuickConnectPointerUp(side: QuickConnectSide, e: PointerEvent): void {
    if (!this.quickConnectPointerDown || this.quickConnectPointerDownSide !== side) {
      this.resetQuickConnectPointerState();
      return;
    }

    // If we get here without triggering drag, it's a click
    e.stopPropagation();
    e.preventDefault();

    // Release pointer capture
    const target = e.target as Element;
    const group = target.closest('[data-quick-connect]') as SVGGElement;
    if (group && group.hasPointerCapture(e.pointerId)) {
      group.releasePointerCapture(e.pointerId);
    }

    this.resetQuickConnectPointerState();
    this.handleQuickConnectMouseClick(side);
  }

  private resetQuickConnectPointerState(): void {
    this.quickConnectPointerDown = false;
    this.quickConnectPointerDownSide = null;
    this.quickConnectPointerStartPos = null;
  }

  private updateQuickConnectDotAppearance(side: QuickConnectSide, hovered: boolean): void {
    const group = this.quickConnectDots.get(side);
    if (!group) return;

    const circle = group.querySelector('circle');
    const arrow = group.querySelector('.quick-connect-arrow') as SVGGElement;

    if (circle) {
      const baseRadius = this.QUICK_CONNECT_DOT_SIZE / 2 / this.currentScale;
      const expandedRadius = this.QUICK_CONNECT_DOT_EXPANDED_SIZE / 2 / this.currentScale;

      if (hovered || this.activeQuickConnect === side) {
        circle.setAttribute('r', String(expandedRadius));
        circle.setAttribute('fill', this.activeQuickConnect === side ? '#3b82f6' : 'white');
      } else {
        circle.setAttribute('r', String(baseRadius));
        circle.setAttribute('fill', 'white');
      }
    }

    if (arrow) {
      arrow.style.opacity = (hovered || this.activeQuickConnect === side) ? '1' : '0';
      // Change arrow color when active
      const path = arrow.querySelector('path');
      if (path) {
        path.setAttribute('stroke', this.activeQuickConnect === side ? 'white' : '#3b82f6');
      }
    }
  }

  public setQuickConnectEnabled(enabled: boolean): void {
    this.quickConnectEnabled = enabled;

    this.quickConnectDots.forEach(group => {
      group.style.display = enabled ? '' : 'none';
    });

    if (enabled) {
      this.updateQuickConnectDotPositions();
      this.updateQuickConnectScale();
    }
  }

  public setQuickConnectCallbacks(
    onHover: ((side: QuickConnectSide | null) => void) | null,
    onClick: ((side: QuickConnectSide) => void) | null,
    onDragStart?: ((side: QuickConnectSide, clientX: number, clientY: number) => void) | null
  ): void {
    this.onQuickConnectHover = onHover;
    this.onQuickConnectClick = onClick;
    this.onQuickConnectDragStart = onDragStart || null;
  }

  public setActiveQuickConnect(side: QuickConnectSide | null): void {
    const previousActive = this.activeQuickConnect;
    this.activeQuickConnect = side;

    // Update appearance for previous and new active
    if (previousActive && previousActive !== side) {
      this.updateQuickConnectDotAppearance(previousActive, this.hoveredQuickConnect === previousActive);
    }
    if (side) {
      this.updateQuickConnectDotAppearance(side, true);
    }
  }

  public getQuickConnectEnabled(): boolean {
    return this.quickConnectEnabled;
  }

  private updateQuickConnectScale(): void {
    this.quickConnectDots.forEach((group, side) => {
      const circle = group.querySelector('circle');
      const arrow = group.querySelector('.quick-connect-arrow');

      if (circle) {
        const isExpanded = this.hoveredQuickConnect === side || this.activeQuickConnect === side;
        const radius = isExpanded
          ? this.QUICK_CONNECT_DOT_EXPANDED_SIZE / 2 / this.currentScale
          : this.QUICK_CONNECT_DOT_SIZE / 2 / this.currentScale;
        circle.setAttribute('r', String(radius));
        circle.setAttribute('stroke-width', String(1.5 / this.currentScale));
      }

      // Recreate arrow icon with correct scale
      if (arrow) {
        const newArrow = this.createArrowIcon(side);
        newArrow.style.opacity = (arrow as SVGGElement).style.opacity;
        arrow.replaceWith(newArrow);
      }
    });
  }

  public getSelectionBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }
}

