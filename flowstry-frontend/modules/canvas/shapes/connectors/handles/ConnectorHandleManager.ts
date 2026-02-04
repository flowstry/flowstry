import { ConnectorPoint, ConnectorType } from '../base'

interface Point {
    x: number
    y: number
}

interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export interface ConnectorContext {
    startPoint: Point
    endPoint: Point
    connectorType: ConnectorType
    pointsBent: ConnectorPoint[]
    getBBox: () => Rect
    getCurvedMidpoint: () => Point
    startShapeId: string | null
    endShapeId: string | null
    selected: boolean
    shouldShowSegmentHandle?: (index: number) => boolean
}

export class ConnectorHandleManager {
    startHandle: SVGElement | null = null
    endHandle: SVGElement | null = null
    midpointHandle: SVGElement | null = null
    selectionRect: SVGRectElement | null = null
    bentSegmentHandles: SVGElement[] = []

    private showBentSegmentHandles: boolean = false
    private currentScale: number = 1

    // Track which segment is currently being dragged (-1 = none)
    private draggingSegmentIndex: number = -1

    // Handle size constants
    private readonly BASE_HANDLE_RADIUS = 6
    private readonly BASE_HANDLE_STROKE_WIDTH = 2

    constructor(private rootElement: SVGElement) {}

    createSelectionIndicator(ctx: ConnectorContext): SVGGraphicsElement {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')

        // Bounding box (initially hidden)
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const bbox = ctx.getBBox()
        rect.setAttribute('x', String(bbox.x))
        rect.setAttribute('y', String(bbox.y))
        rect.setAttribute('width', String(bbox.width))
        rect.setAttribute('height', String(bbox.height))
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', '#60a5fa') // Light blue color
        rect.setAttribute('stroke-width', '1')
        rect.setAttribute('pointer-events', 'none')
        rect.style.display = 'none' // Hidden by default
        group.appendChild(rect)
        this.selectionRect = rect

        // Start handle
        const startHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        startHandle.setAttribute('cx', String(ctx.startPoint.x))
        startHandle.setAttribute('cy', String(ctx.startPoint.y))
        startHandle.setAttribute('fill', '#ffffff')
        startHandle.setAttribute('stroke', '#60a5fa')
        startHandle.setAttribute('class', 'connector-handle start-handle')
        startHandle.setAttribute('pointer-events', 'all')
        startHandle.style.pointerEvents = 'all'
        group.appendChild(startHandle)
        this.startHandle = startHandle

        // End handle
        const endHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        endHandle.setAttribute('cx', String(ctx.endPoint.x))
        endHandle.setAttribute('cy', String(ctx.endPoint.y))
        endHandle.setAttribute('fill', '#ffffff')
        endHandle.setAttribute('stroke', '#60a5fa')
        endHandle.setAttribute('class', 'connector-handle end-handle')
        endHandle.setAttribute('pointer-events', 'all')
        endHandle.style.pointerEvents = 'all'
        group.appendChild(endHandle)
        this.endHandle = endHandle

        // Midpoint handle (for curved connectors)
        if (ctx.connectorType === 'curved') {
            const midpointHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            const midpoint = ctx.getCurvedMidpoint()
            midpointHandle.setAttribute('cx', String(midpoint.x))
            midpointHandle.setAttribute('cy', String(midpoint.y))
            midpointHandle.setAttribute('fill', '#ffffff')
            midpointHandle.setAttribute('stroke', '#60a5fa')
            midpointHandle.setAttribute('class', 'connector-handle midpoint-handle')
            midpointHandle.setAttribute('pointer-events', 'all')
            midpointHandle.style.pointerEvents = 'all'
            midpointHandle.style.cursor = 'move'
            group.appendChild(midpointHandle)
            this.midpointHandle = midpointHandle
        }

        // Set initial handle sizes based on current scale
        this.updateHandleSizes()

        // Group itself doesn't capture events, but allows children (handles) to receive events
        group.setAttribute('pointer-events', 'none')
        group.style.pointerEvents = 'none'

        return group
    }

    setSelectionMode(mode: 'handles' | 'box', ctx: ConnectorContext) {
        if (!this.startHandle || !this.endHandle || !this.selectionRect) return

        if (mode === 'handles') {
            this.startHandle.style.display = ''
            this.endHandle.style.display = ''
            this.selectionRect.style.display = 'none'
            this.showBentSegmentHandles = true
            if (this.midpointHandle) {
                this.midpointHandle.style.display = ''
            }
        } else {
            this.startHandle.style.display = 'none'
            this.endHandle.style.display = 'none'
            this.selectionRect.style.display = ''
            this.showBentSegmentHandles = false
            if (this.midpointHandle) {
                this.midpointHandle.style.display = 'none'
            }
        }

        this.updateBentSegmentHandles(ctx)
    }

    updateSelectionIndicator(ctx: ConnectorContext) {
        if (this.startHandle && this.endHandle) {
            this.startHandle.setAttribute('cx', String(ctx.startPoint.x))
            this.startHandle.setAttribute('cy', String(ctx.startPoint.y))
            this.endHandle.setAttribute('cx', String(ctx.endPoint.x))
            this.endHandle.setAttribute('cy', String(ctx.endPoint.y))
        }

        // Update midpoint handle position for curved connectors
        if (this.midpointHandle && ctx.connectorType === 'curved') {
            const midpoint = ctx.getCurvedMidpoint()
            this.midpointHandle.setAttribute('cx', String(midpoint.x))
            this.midpointHandle.setAttribute('cy', String(midpoint.y))
        }

        if (this.selectionRect) {
            const bbox = ctx.getBBox()
            this.selectionRect.setAttribute('x', String(bbox.x))
            this.selectionRect.setAttribute('y', String(bbox.y))
            this.selectionRect.setAttribute('width', String(bbox.width))
            this.selectionRect.setAttribute('height', String(bbox.height))
        }
    }

    hideSelectionIndicator(ctx: ConnectorContext) {
        this.showBentSegmentHandles = false
        this.updateBentSegmentHandles(ctx)
    }

    /**
     * Set the currently dragging segment index.
     * When set to >= 0, only that segment's handle will be shown.
     * Set to -1 to clear and show all handles.
     */
    setDraggingSegment(segmentIndex: number, ctx?: ConnectorContext): void {
        this.draggingSegmentIndex = segmentIndex
        if (ctx) {
            this.updateBentSegmentHandles(ctx)
        }
    }

    updateHandleFill(ctx: ConnectorContext) {
        if (this.startHandle) {
            const isAttached = ctx.startShapeId !== null
            this.startHandle.setAttribute('fill', isAttached ? '#60a5fa' : '#ffffff')
        }

        if (this.endHandle) {
            const isAttached = ctx.endShapeId !== null
            this.endHandle.setAttribute('fill', isAttached ? '#60a5fa' : '#ffffff')
        }
    }

    updateScale(scale: number, ctx: ConnectorContext): void {
        this.currentScale = scale
        this.updateHandleSizes(ctx)
    }

    private updateHandleSizes(ctx?: ConnectorContext): void {
        const handleRadius = this.BASE_HANDLE_RADIUS / this.currentScale
        const handleStrokeWidth = this.BASE_HANDLE_STROKE_WIDTH / this.currentScale

        if (this.startHandle) {
            this.startHandle.setAttribute('r', String(handleRadius))
            this.startHandle.setAttribute('stroke-width', String(handleStrokeWidth))
        }

        if (this.endHandle) {
            this.endHandle.setAttribute('r', String(handleRadius))
            this.endHandle.setAttribute('stroke-width', String(handleStrokeWidth))
        }

        if (this.midpointHandle) {
            this.midpointHandle.setAttribute('r', String(handleRadius))
            this.midpointHandle.setAttribute('stroke-width', String(handleStrokeWidth))
        }

        if (ctx) {
            this.updateBentSegmentHandles(ctx)
        }
    }

    updateBentSegmentHandles(ctx: ConnectorContext): void {
        // Remove existing handles
        this.bentSegmentHandles.forEach(handle => {
            if (handle.parentNode) {
                handle.parentNode.removeChild(handle)
            }
        })
        this.bentSegmentHandles = []

        // Only show handles for bent connectors when selected
        if (
            ctx.connectorType !== 'bent' ||
            !ctx.selected ||
            !this.showBentSegmentHandles ||
            ctx.pointsBent.length < 2
        ) {
            return
        }

        const handleLong = (this.BASE_HANDLE_RADIUS * 2.4) / this.currentScale
        const handleShort = (this.BASE_HANDLE_RADIUS * 1.0) / this.currentScale
        const cornerRadius = handleShort / 3

        // Threshold for short exit/entry stub segments (below this, no handle)
        const BEND_THRESHOLD = 20  // Same as GRID_SPACING

        for (let i = 0; i < ctx.pointsBent.length - 1; i++) {
            const start = ctx.pointsBent[i]
            const end = ctx.pointsBent[i + 1]

            // Calculate segment length
            const segmentLength = Math.sqrt(
                Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
            )

            // Check if handle should be shown based on strict rules
            if (ctx.shouldShowSegmentHandle) {
                if (!ctx.shouldShowSegmentHandle(i)) continue
            } else if (segmentLength < BEND_THRESHOLD) {
                // Fallback basic check
                continue
            }

            // If we're dragging a specific segment, only show that segment's handle
            if (this.draggingSegmentIndex >= 0 && i !== this.draggingSegmentIndex) {
                continue
            }

            // Determine segment axis
            const isHorizontal = Math.abs(end.y - start.y) < Math.abs(end.x - start.x)

            // NOTE: We NO LONGER skip fixed segments - users should still be able to
            // re-adjust fixed segments via their handles

            const midX = (start.x + end.x) / 2
            const midY = (start.y + end.y) / 2
            
            const handleWidth = isHorizontal ? handleLong : handleShort
            const handleHeight = isHorizontal ? handleShort : handleLong
            
            const cursor = isHorizontal ? 'ns-resize' : 'ew-resize'

            const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            handle.setAttribute('x', String(midX - handleWidth / 2))
            handle.setAttribute('y', String(midY - handleHeight / 2))
            handle.setAttribute('width', String(handleWidth))
            handle.setAttribute('height', String(handleHeight))
            handle.setAttribute('rx', String(cornerRadius))
            handle.setAttribute('ry', String(cornerRadius))
            handle.setAttribute('fill', '#60a5fa')
            handle.setAttribute('class', 'bent-segment-handle')
            handle.setAttribute('data-segment-index', String(i))
            handle.setAttribute('pointer-events', 'all')
            handle.style.pointerEvents = 'all'
            handle.style.cursor = cursor

            this.rootElement.appendChild(handle)
            this.bentSegmentHandles.push(handle)
        }
    }
}
