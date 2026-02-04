import { GRID_SPACING } from '../consts/canvas'
import { DiagramManager } from '../shapes'
import { CONNECTOR_POINT_SNAP_RADIUS, DiagramShape, EDGE_FOLLOW_DISTANCE } from '../shapes/base'
import { ConnectorShape, ConnectorType } from '../shapes/connectors'
import { DiagramTool } from './base'

export class ConnectorTool extends DiagramTool {
    private diagramManager: DiagramManager
    private connectorType: ConnectorType = 'straight'
    private isDrawing: boolean = false
    private startPoint: { x: number; y: number } | null = null
    private currentConnector: ConnectorShape | null = null
    private startShapeId: string | null = null

    // Callbacks
    private getContainerElement: (() => HTMLDivElement | null) | null = null
    private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null
    private getContentLayer: (() => SVGGElement | null) | null = null
    private onShapeCreated: (() => void) | null = null
    private onRequestToolChange: ((toolName: string) => void) | null = null

    // Visual feedback
    private hoverOverlayGroup: SVGGElement | null = null
    private hoveredShape: DiagramShape | null = null
    // private hoveredSnapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null = null
    private readonly BASE_HANDLE_RADIUS = 6
    private readonly BASE_HANDLE_STROKE_WIDTH = 2

    constructor(
        diagramManager: DiagramManager,
        getContainerElement?: () => HTMLDivElement | null,
        getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
        onShapeCreated?: () => void,
        onRequestToolChange?: (toolName: string) => void
    ) {
        super('Connector', 'arrow-right')
        this.diagramManager = diagramManager
        this.getContainerElement = getContainerElement || null
        this.getCanvasTransform = getCanvasTransform || null
        this.onShapeCreated = onShapeCreated || null
        this.onRequestToolChange = onRequestToolChange || null
    }

    public setCallbacks(
        getContainerElement: () => HTMLDivElement | null,
        getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
        getContentLayer?: () => SVGGElement | null,
        onShapeCreated?: () => void,
        onRequestToolChange?: (toolName: string) => void
    ) {
        this.getContainerElement = getContainerElement
        this.getCanvasTransform = getCanvasTransform
        this.getContentLayer = getContentLayer || null
        this.onShapeCreated = onShapeCreated || null
        this.onRequestToolChange = onRequestToolChange || null
    }

    public setConnectorType(type: ConnectorType) {
        this.connectorType = type
    }

    public getConnectorType(): ConnectorType {
        return this.connectorType
    }

    private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
        // Use container element for bounding rect (events fire on container, not SVG)
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

    // Find shape under cursor or near cursor (for edge snapping)
    private findShapeAt(x: number, y: number, snapRadius: number = 15): string | null {
        const shapes = this.diagramManager.getShapes()
        // Iterate in reverse to find top-most shape
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i]
            // Skip connectors
            if (shape.type === 'connector') continue
            
            // Check if point is inside bounding box
            if (x >= shape.layout.x && x <= shape.layout.x + shape.layout.width &&
                y >= shape.layout.y && y <= shape.layout.y + shape.layout.height) {
                return shape.id
            }
            
            // Also check if point is near the shape's edge (within snap radius)
            // Expand bounding box by snap radius
            const expandedX = shape.layout.x - snapRadius
            const expandedY = shape.layout.y - snapRadius
            const expandedWidth = shape.layout.width + snapRadius * 2
            const expandedHeight = shape.layout.height + snapRadius * 2
            
            if (x >= expandedX && x <= expandedX + expandedWidth &&
                y >= expandedY && y <= expandedY + expandedHeight) {
                // Check if point is actually near the edge (not too far)
                const edgePoint = shape.connectionPoints.getClosestEdgePoint(x, y)
                const distance = Math.sqrt(Math.pow(x - edgePoint.x, 2) + Math.pow(y - edgePoint.y, 2))
                if (distance <= snapRadius) {
                    return shape.id
                }
            }
        }
        return null
    }

    public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
        if (!this.isActive() || e.button !== 0) return false

        e.preventDefault()
        element.setPointerCapture(e.pointerId)

        const worldPos = this.screenToWorld(e.clientX, e.clientY)
        const detachFromShapes = 'altKey' in e ? e.altKey : false

        this.isDrawing = true
        this.startShapeId = detachFromShapes ? null : this.findShapeAt(worldPos.x, worldPos.y)

        // Snap start point to connector point or edge if starting on a shape
        let snappedStartPoint = worldPos
        let startConnectorPoint: 'top' | 'bottom' | 'left' | 'right' | null = null
        
        if (this.startShapeId) {
            const startShape = this.diagramManager.getShapeById(this.startShapeId)
            if (startShape) {
                const snapResult = startShape.connectionPoints.getSnapPoint(worldPos.x, worldPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                snappedStartPoint = snapResult.point
                // Set connector point direction from side (works for both connector points and edges)
                startConnectorPoint = snapResult.side
            }
        } else {
            snappedStartPoint = this.maybeSnapPoint(worldPos, e, false)
        }

        this.startPoint = snappedStartPoint

        // Create initial connector with zero length
        this.currentConnector = this.diagramManager.createConnector(
            this.connectorType,
            snappedStartPoint,
            snappedStartPoint,
            this.startShapeId,
            null
        )
        
        if (this.currentConnector) {
            this.currentConnector.startConnectorPoint = startConnectorPoint
        }

        return true
    }

    public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
        const worldPos = this.screenToWorld(e.clientX, e.clientY)
        const detachHover = 'altKey' in e ? e.altKey : false

        // Always show hover feedback when tool is active
        if (this.isActive()) {
            const shapeId = detachHover ? null : this.findShapeAt(worldPos.x, worldPos.y)
            let hoveredShape: DiagramShape | null = null
            let snapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null = null
            
            if (shapeId) {
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    snapResult = shape.connectionPoints.getSnapPoint(worldPos.x, worldPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    hoveredShape = shape
                }
            }
            
            this.updateHoverFeedback(hoveredShape, snapResult)
        }
        
        // Only handle drawing if actually drawing
        if (!this.isDrawing || !this.currentConnector) {
            return false
        }

        e.preventDefault()
        const pointerPos = this.applyAxisLock(this.startPoint, { ...worldPos }, e)
        
        // Check for potential end shape and snap to connector point or edge
        const endShapeId = detachHover ? null : this.findShapeAt(pointerPos.x, pointerPos.y)
        let snappedPoint = pointerPos
        // let hoveredShape: DiagramShape | null = null
        let snapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null = null
        
        if (endShapeId && endShapeId !== this.startShapeId) {
            const endShape = this.diagramManager.getShapeById(endShapeId)
            if (endShape) {
                // First, get the snap point based on cursor position (for edge following)
                snapResult = endShape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                // Also check if we snapped to a specific connector point
                let snappedToConnectorPoint = false
                let snappedConnectorPoint = null
                
                if (snapResult.isConnectorPoint) {
                    snappedToConnectorPoint = true
                    snappedConnectorPoint = snapResult.side
                } else {
                    // Check specifically if we are near a connector point even if getSnapPoint preferred the edge
                    // (e.g. if we are close to edge but also close to a point)
                    const connectorPointSnap = endShape.connectionPoints.checkConnectorPointSnap(snappedPoint.x, snappedPoint.y, CONNECTOR_POINT_SNAP_RADIUS)
                if (connectorPointSnap) {
                    // Snap to the connector point
                    snappedPoint = connectorPointSnap.point
                    snapResult = connectorPointSnap
                }
                }
                
                // Attach to shape (either connector point or edge)
                this.currentConnector.endShapeId = endShapeId
                // Only set connector point if it's actually a connector point, not just an edge
                this.currentConnector.endConnectorPoint = snapResult.isConnectorPoint ? snapResult.side : null
            } else {
                this.currentConnector.endShapeId = null
                this.currentConnector.endConnectorPoint = null
            }
        } else {
            snappedPoint = this.maybeSnapPoint(snappedPoint, e, false)
            this.currentConnector.endShapeId = null
            this.currentConnector.endConnectorPoint = null
        }
        
        // Update end point (snapped to connector point or edge if over a shape)
        this.currentConnector.setEndPoint(snappedPoint.x, snappedPoint.y)
        // Update handle fill color based on attachment
        this.currentConnector.updateHandleFill()

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

        if (this.currentConnector) {
            const worldPos = this.screenToWorld(e.clientX, e.clientY)
            const detachFromShapes = 'altKey' in e ? e.altKey : false
            const pointerPos = this.applyAxisLock(this.startPoint, { ...worldPos }, e)
            const endShapeId = detachFromShapes ? null : this.findShapeAt(pointerPos.x, pointerPos.y)
            
            // Finalize connection - snap to connector point or edge if over a shape
            if (endShapeId && endShapeId !== this.startShapeId) {
                const endShape = this.diagramManager.getShapeById(endShapeId)
                if (endShape) {
                    const snapResult = endShape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    this.currentConnector.setEndPoint(snapResult.point.x, snapResult.point.y)
                    
                    // Attach to shape (either connector point or edge)
                    this.currentConnector.endShapeId = endShapeId
                    // Set connector point direction from side (works for both connector points and edges)
                    this.currentConnector.endConnectorPoint = snapResult.side
                }
            } else {
                const snapped = this.maybeSnapPoint(pointerPos, e, false)
                this.currentConnector.setEndPoint(snapped.x, snapped.y)
                // If not over a shape, clear the connection
                this.currentConnector.endShapeId = null
                this.currentConnector.endConnectorPoint = null
            }
            
            // Update handle fill color based on attachment
            this.currentConnector.updateHandleFill()

            // If connector is too small, remove it
            const dx = Math.abs(this.currentConnector.endPoint.x - this.currentConnector.startPoint.x)
            const dy = Math.abs(this.currentConnector.endPoint.y - this.currentConnector.startPoint.y)
            
            if (dx < 5 && dy < 5) {
                this.diagramManager.removeShape(this.currentConnector)
            } else {
                // Ensure connector is above its connected shapes
                if (this.currentConnector.startShapeId || this.currentConnector.endShapeId) {
                    this.diagramManager.bringConnectorAboveConnectedShapes(this.currentConnector)
                }

                // Select the new connector
                this.diagramManager.deselectAllShapes()
                this.diagramManager.selectShape(this.currentConnector)
                
                if (this.onShapeCreated) {
                    this.onShapeCreated()
                }
            }
        }

        this.isDrawing = false
        this.currentConnector = null
        this.startPoint = null
        this.startShapeId = null

        // Clear hover feedback
        this.clearHoverFeedback()

        // Switch back to select tool
        if (this.onRequestToolChange) {
            this.onRequestToolChange('Select')
        }

        return true
    }

    private snapCoordinate(value: number): number {
        // Snap to grid dots which are at GRID_SPACING/2, GRID_SPACING/2 + GRID_SPACING, etc.
        const offset = GRID_SPACING / 2
        return Math.round((value - offset) / GRID_SPACING) * GRID_SPACING + offset
    }

    private maybeSnapPoint(
        point: { x: number; y: number },
        event: PointerEvent | React.PointerEvent,
        hasAttachment: boolean
    ): { x: number; y: number } {
        const altPressed = 'altKey' in event ? event.altKey : false
        const shouldSnap = this.diagramManager.getSnapToGrid() && !hasAttachment && !altPressed
        if (!shouldSnap) return point
        return {
            x: this.snapCoordinate(point.x),
            y: this.snapCoordinate(point.y)
        }
    }

    private applyAxisLock(
        start: { x: number; y: number } | null,
        current: { x: number; y: number },
        event: PointerEvent | React.PointerEvent
    ): { x: number; y: number } {
        const shiftPressed = 'shiftKey' in event ? event.shiftKey : false
        if (!shiftPressed || !start) return current
        const dx = Math.abs(current.x - start.x)
        const dy = Math.abs(current.y - start.y)
        if (dx >= dy) {
            return { x: current.x, y: start.y }
        }
        return { x: start.x, y: current.y }
    }

    private updateHoverFeedback(shape: DiagramShape | null, snapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null) {
        const contentLayer = this.getContentLayer ? this.getContentLayer() : null
        if (!contentLayer) return

        // Clear if no shape or no snap result
        if (!shape || !snapResult) {
            this.clearHoverFeedback()
            return
        }

        // Update tracked state
        // const shapeChanged = shape !== this.hoveredShape
        this.hoveredShape = shape
        // this.hoveredSnapResult = snapResult

        // Create overlay group if it doesn't exist
        if (!this.hoverOverlayGroup || !this.hoverOverlayGroup.parentNode) {
            // Remove old overlay if it exists but isn't attached
            if (this.hoverOverlayGroup && !this.hoverOverlayGroup.parentNode) {
                this.hoverOverlayGroup = null
            }
            
            this.hoverOverlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            this.hoverOverlayGroup.setAttribute('class', 'connector-hover-overlay')
            this.hoverOverlayGroup.setAttribute('pointer-events', 'none')
            // Append to end to ensure it's on top
            contentLayer.appendChild(this.hoverOverlayGroup)
        }

        const overlayGroup = this.hoverOverlayGroup

        // Clear existing children
        while (overlayGroup.firstChild) {
            overlayGroup.removeChild(overlayGroup.firstChild)
        }

        const transform = this.getCanvasTransform ? this.getCanvasTransform() : { scale: 1, translation: { x: 0, y: 0 } }
        const handleRadius = this.BASE_HANDLE_RADIUS / transform.scale
        const handleStrokeWidth = this.BASE_HANDLE_STROKE_WIDTH / transform.scale

        // Show connector points
        const points = shape.connectionPoints.getConnectorPoints()
        const sides: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right']
        
        // Only show fills when directly on a connector point
        const isOnConnectorPoint = snapResult.isConnectorPoint && snapResult.side !== null
        
        sides.forEach(side => {
            const point = points[side]
            const isActive = isOnConnectorPoint && side === snapResult.side
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            circle.setAttribute('cx', String(point.x))
            circle.setAttribute('cy', String(point.y))
            circle.setAttribute('r', String(handleRadius))
            circle.setAttribute('stroke', '#60a5fa')
            circle.setAttribute('stroke-width', String(handleStrokeWidth))
            // Only show fill when on a connector point: active one gets stroke color, others get white
            // When on stroke, no fill
            if (isOnConnectorPoint) {
                circle.setAttribute('fill', isActive ? '#60a5fa' : '#ffffff')
            } else {
                circle.setAttribute('fill', 'none')
            }
            overlayGroup.appendChild(circle)
        })

        if (!snapResult.isConnectorPoint) {
            // Highlight the stroke/edge when not on a connector point
            const bbox = shape.layout.getBBox()
            const shapeStrokeWidth = shape.appearance.strokeWidth || 4
            // Make highlight stroke slightly smaller than actual stroke
            const highlightStrokeWidth = Math.max(1, shapeStrokeWidth - 1) / transform.scale
            // Inset the rect by half the difference to make the stroke appear smaller
            const inset = (shapeStrokeWidth - highlightStrokeWidth * transform.scale) / 2
            
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            rect.setAttribute('x', String(bbox.x + inset))
            rect.setAttribute('y', String(bbox.y + inset))
            rect.setAttribute('width', String(bbox.width - inset * 2))
            rect.setAttribute('height', String(bbox.height - inset * 2))
            rect.setAttribute('fill', 'none')
            rect.setAttribute('stroke', '#60a5fa')
            rect.setAttribute('stroke-width', String(highlightStrokeWidth))
            rect.setAttribute('rx', '6')
            rect.setAttribute('ry', '6')
            overlayGroup.appendChild(rect)
        }
    }

    private clearHoverFeedback() {
        if (this.hoverOverlayGroup && this.hoverOverlayGroup.parentNode) {
            this.hoverOverlayGroup.parentNode.removeChild(this.hoverOverlayGroup)
            this.hoverOverlayGroup = null
        }
        this.hoveredShape = null
        // this.hoveredSnapResult = null
    }

    public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
        return false
    }

    public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
        if (e.key === 'Escape' && this.isDrawing) {
            if (this.currentConnector) {
                this.diagramManager.removeShape(this.currentConnector)
            }
            this.isDrawing = false
            this.currentConnector = null
            return true
        }
        return false
    }

    public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
        return false
    }

    protected onDeactivate(): void {
        // Clear hover feedback when tool is deactivated
        this.clearHoverFeedback()
    }
}
