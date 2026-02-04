import { GRID_SPACING } from '../consts/canvas'
import { DiagramManager } from '../shapes'
import { CONNECTOR_POINT_SNAP_RADIUS, DiagramShape, EDGE_FOLLOW_DISTANCE } from '../shapes/base'
import { ConnectorShape } from '../shapes/connectors'
import { BentConnector } from '../shapes/connectors/bent/BentConnector'
import { CurvedConnector } from '../shapes/connectors/CurvedConnector'
import { DiagramTool } from './base'

export class ConnectorDragTool extends DiagramTool {
    private diagramManager: DiagramManager
    private isDragging: boolean = false
    private draggedHandle: 'start' | 'end' | 'midpoint' | 'segment' | null = null
    private connector: ConnectorShape | null = null

    // Segment drag state
    private segmentDragIndex: number | null = null
    // private segmentDragAxis: 'x' | 'y' | null = null

    // Callbacks
    private getContainerElement: (() => HTMLDivElement | null) | null = null
    private getCanvasTransform: (() => { scale: number; translation: { x: number; y: number } }) | null = null
    private getContentLayer: (() => SVGGElement | null) | null = null
    private onRecordHistory: (() => void) | null = null

    // Visual feedback
    private hoverOverlayGroup: SVGGElement | null = null
    // private hoveredShape: DiagramShape | null = null
    // private hoveredSnapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null = null
    private readonly BASE_HANDLE_RADIUS = 6
    private readonly BASE_HANDLE_STROKE_WIDTH = 2

    constructor(
        diagramManager: DiagramManager,
        getContainerElement?: () => HTMLDivElement | null,
        getCanvasTransform?: () => { scale: number; translation: { x: number; y: number } },
        onRecordHistory?: () => void
    ) {
        super('ConnectorDrag', 'move')
        this.diagramManager = diagramManager
        this.getContainerElement = getContainerElement || null
        this.getCanvasTransform = getCanvasTransform || null
        this.onRecordHistory = onRecordHistory || null
    }

    public setCallbacks(
        getContainerElement: () => HTMLDivElement | null,
        getCanvasTransform: () => { scale: number; translation: { x: number; y: number } },
        getContentLayer?: () => SVGGElement | null,
        onRecordHistory?: () => void
    ) {
        this.getContainerElement = getContainerElement
        this.getCanvasTransform = getCanvasTransform
        this.getContentLayer = getContentLayer || null
        if (onRecordHistory !== undefined) {
            this.onRecordHistory = onRecordHistory
        }
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

    // Find shape at cursor position or near cursor (for edge snapping)
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

    public startDrag(connector: ConnectorShape, handle: 'start' | 'end' | 'midpoint', _clientX: number, _clientY: number) {
        this.isDragging = true
        this.connector = connector
        this.draggedHandle = handle

        // Initialize pending avoidance for endpoint drags on bent connectors in manual mode
        if ((handle === 'start' || handle === 'end') && connector instanceof BentConnector) {
            connector.beginPendingAvoidance(handle)
        }

        this.activate()
    }

    /**
     * Start dragging a segment of a bent connector.
     * Called by SelectTool when a user clicks on a bent-segment-handle.
     * Uses the new segment-centric API for Figma-style behavior.
     */
    public startSegmentDrag(connector: BentConnector, segmentIndex: number, clientX: number, clientY: number) {
        this.isDragging = true
        this.connector = connector
        this.draggedHandle = 'segment'

        // Get world position for the interaction
        const worldPos = this.screenToWorld(clientX, clientY)

        // Use new segment interaction API - this handles:
        // - Auto → manual transition
        // - Freezing existing geometry
        // - Inserting new segment at pointer position (Figma behavior)
        const actualSegmentIndex = connector.beginSegmentInteraction(
            'segment_drag',
            segmentIndex,
            worldPos
        )
        this.segmentDragIndex = actualSegmentIndex

        // Hide other segment handles - only show the one being dragged
        connector.setDraggingSegment(actualSegmentIndex)

        // Determine axis from the NEW segment's orientation
        // In the new model, segments alternate axes, so we can derive from segment properties
        const segments = connector.segments
        if (actualSegmentIndex >= 0 && actualSegmentIndex < segments.length) {
            const segment = segments[actualSegmentIndex]
            // Axis is the movement axis: 'x' = horizontal segment (drag changes y)
            // 'y' = vertical segment (drag changes x)
            // this.segmentDragAxis = segment.axis === 'x' ? 'y' : 'x'
        } else {
            // Fallback: derive from points
            const start = connector.pointsBent[actualSegmentIndex]
            const end = connector.pointsBent[actualSegmentIndex + 1]
            if (start && end) {
                const isHorizontal = Math.abs(end.y - start.y) < Math.abs(end.x - start.x)
                // this.segmentDragAxis = isHorizontal ? 'y' : 'x'
            }
        }

        this.activate()
    }


    public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
        return false // Initiated programmatically by SelectTool
    }

    public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
        if (!this.isDragging || !this.connector || !this.draggedHandle) return false

        e.preventDefault()
        const worldPos = this.screenToWorld(e.clientX, e.clientY)
        const detach = 'altKey' in e ? e.altKey : false

        // Handle midpoint dragging for curved connectors
        if (this.draggedHandle === 'midpoint') {
            if (this.connector instanceof CurvedConnector) {
                this.connector.setMidpointWorld(worldPos.x, worldPos.y)
                this.connector.render()
                this.diagramManager.updateShapeText(this.connector)
            }
            return true
        }

        // Handle segment dragging for bent connectors
        if (this.draggedHandle === 'segment') {
            if (this.connector instanceof BentConnector &&
                this.segmentDragIndex !== null) {

                // Get snapped world position
                const snapToGrid = this.diagramManager.getSnapToGrid()
                const snappedPos = snapToGrid
                    ? { x: this.snapCoordinate(worldPos.x), y: this.snapCoordinate(worldPos.y) }
                    : worldPos

                // Use new segment interaction API - handles axis constraints automatically
                this.connector.updateSegmentInteraction(snappedPos)
                this.connector.render()
                this.diagramManager.updateShapeText(this.connector)
            }
            return true
        }


        const referencePoint = this.connector
            ? (this.draggedHandle === 'start' ? this.connector.endPoint : this.connector.startPoint)
            : null
        const pointerPos = this.applyAxisLock(referencePoint, { ...worldPos }, e)

        // Find shape at cursor position
        const shapeId = detach ? null : this.findShapeAt(pointerPos.x, pointerPos.y)
        let snappedPoint = pointerPos
        let hoveredShape: DiagramShape | null = null
        let snapResult: { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' | null, isConnectorPoint: boolean } | null = null

        if (this.draggedHandle === 'start') {
            if (shapeId) {
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    // First, get the snap point based on cursor position (for edge following)
                    snapResult = shape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    snappedPoint = snapResult.point
                    hoveredShape = shape
                    
                    // Then, check if the connector point position itself is within snap radius of any connector point
                    // This allows snapping even when cursor is inside the shape
                    const connectorPointSnap = shape.connectionPoints.checkConnectorPointSnap(snappedPoint.x, snappedPoint.y, CONNECTOR_POINT_SNAP_RADIUS)
                    if (connectorPointSnap) {
                        // Snap to the connector point
                        snappedPoint = connectorPointSnap.point
                        snapResult = connectorPointSnap
                    }
                    
                    // Attach to shape (either connector point or edge)
                    this.connector.startShapeId = shapeId
                    // Only set connector point if it's actually a connector point, not just an edge
                    this.connector.startConnectorPoint = snapResult.isConnectorPoint ? snapResult.side : null

                    // Use pending avoidance API if available (for bent connectors in manual mode)
                    if (this.connector instanceof BentConnector && this.connector.isInPendingAvoidance()) {
                        const direction = snapResult.isConnectorPoint ? snapResult.side : shape.connectionPoints.getEdgeSide(snappedPoint)
                        this.connector.applyPendingAvoidance(snappedPoint, direction)
                    } else {
                        this.connector.setStartPoint(snappedPoint.x, snappedPoint.y)
                    }
                } else {
                    this.connector.startShapeId = null
                    this.connector.startConnectorPoint = null
                    this.connector.setStartPoint(snappedPoint.x, snappedPoint.y)
                }
            } else {
                snappedPoint = this.maybeSnapPoint(snappedPoint, e, false)
                this.connector.startShapeId = null
                this.connector.startConnectorPoint = null

                // Use pending avoidance API to revert if available (for bent connectors in manual mode)
                if (this.connector instanceof BentConnector && this.connector.isInPendingAvoidance()) {
                    this.connector.revertPendingAvoidance(snappedPoint)
                } else {
                    this.connector.setStartPoint(snappedPoint.x, snappedPoint.y)
                }
            }
            // Update handle fill color based on attachment
            this.connector.updateHandleFill()
        } else {
            if (shapeId) {
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    // First, get the snap point based on cursor position (for edge following)
                    snapResult = shape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    snappedPoint = snapResult.point
                    hoveredShape = shape
                    
                    // Then, check if the connector point position itself is within snap radius of any connector point
                    // This allows snapping even when cursor is inside the shape
                    const connectorPointSnap = shape.connectionPoints.checkConnectorPointSnap(snappedPoint.x, snappedPoint.y, CONNECTOR_POINT_SNAP_RADIUS)
                    if (connectorPointSnap) {
                        // Snap to the connector point
                        snappedPoint = connectorPointSnap.point
                        snapResult = connectorPointSnap
                    }
                    
                    // Attach to shape (either connector point or edge)
                    this.connector.endShapeId = shapeId
                    // Only set connector point if it's actually a connector point, not just an edge
                    this.connector.endConnectorPoint = snapResult.isConnectorPoint ? snapResult.side : null

                    // Use pending avoidance API if available (for bent connectors in manual mode)
                    if (this.connector instanceof BentConnector && this.connector.isInPendingAvoidance()) {
                        const direction = snapResult.isConnectorPoint ? snapResult.side : shape.connectionPoints.getEdgeSide(snappedPoint)
                        this.connector.applyPendingAvoidance(snappedPoint, direction)
                    } else {
                        this.connector.setEndPoint(snappedPoint.x, snappedPoint.y)
                    }
                } else {
                    this.connector.endShapeId = null
                    this.connector.endConnectorPoint = null
                    this.connector.setEndPoint(snappedPoint.x, snappedPoint.y)
                }
            } else {
                snappedPoint = this.maybeSnapPoint(snappedPoint, e, false)
                this.connector.endShapeId = null
                this.connector.endConnectorPoint = null

                // Use pending avoidance API to revert if available (for bent connectors in manual mode)
                if (this.connector instanceof BentConnector && this.connector.isInPendingAvoidance()) {
                    this.connector.revertPendingAvoidance(snappedPoint)
                } else {
                    this.connector.setEndPoint(snappedPoint.x, snappedPoint.y)
                }
            }
            // Update handle fill color based on attachment
            this.connector.updateHandleFill()
        }

        // Update visual feedback
        this.updateHoverFeedback(hoveredShape, snapResult)

        // Render connector to update path and update text position
        this.connector.render()
        this.diagramManager.updateShapeText(this.connector)

        return true
    }

    public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
        if (!this.isDragging || !this.connector) return false

        e.preventDefault()
        
        // Handle midpoint drag finalization for curved connectors
        if (this.draggedHandle === 'midpoint') {
            const worldPos = this.screenToWorld(e.clientX, e.clientY)
            if (this.connector instanceof CurvedConnector) {
                this.connector.setMidpointWorld(worldPos.x, worldPos.y)
                this.connector.render()
            }
            
            this.isDragging = false
            this.connector = null
            this.draggedHandle = null
            this.deactivate()
            
            // Notify that shapes were modified
            this.diagramManager.notifyShapeModified()
            if (this.onRecordHistory) {
                this.onRecordHistory()
            }
            
            return true
        }
        
        // Handle segment drag finalization for bent connectors
        if (this.draggedHandle === 'segment') {
            // Use new segment interaction API for cleanup - handles:
            // - Removing zero-length segments
            // - Merging collinear segments
            // - Ensuring endpoint normalization
            if (this.connector instanceof BentConnector) {
                this.connector.endSegmentInteraction()
                // Restore visibility of all segment handles
                this.connector.setDraggingSegment(-1)
                this.connector.render()
            }

            this.isDragging = false
            this.connector = null
            this.draggedHandle = null
            this.segmentDragIndex = null
            // this.segmentDragAxis = null
            this.deactivate()

            // Notify that shapes were modified
            this.diagramManager.notifyShapeModified()
            if (this.onRecordHistory) {
                this.onRecordHistory()
            }

            return true
        }


        // Finalize connection - ensure connector points are updated
        const worldPos = this.screenToWorld(e.clientX, e.clientY)
        const detach = 'altKey' in e ? e.altKey : false
        const referencePoint = this.draggedHandle === 'start'
            ? this.connector.endPoint
            : this.connector.startPoint
        const pointerPos = this.applyAxisLock(referencePoint, { ...worldPos }, e)
        const shapeId = detach ? null : this.findShapeAt(pointerPos.x, pointerPos.y)
        
        if (this.draggedHandle === 'start') {
            if (shapeId && this.connector.startShapeId === shapeId) {
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    if (this.connector.startConnectorPoint) {
                        // Update to exact connector point position
                        const points = shape.connectionPoints.getConnectorPoints()
                        this.connector.setStartPoint(points[this.connector.startConnectorPoint].x, points[this.connector.startConnectorPoint].y)
                    } else {
                        // Update to closest edge point (keep connector point as null since it's an edge, not a connector point)
                        const edgePoint = shape.connectionPoints.getClosestEdgePoint(this.connector.startPoint.x, this.connector.startPoint.y)
                        this.connector.setStartPoint(edgePoint.x, edgePoint.y)
                        // Keep startConnectorPoint as null since this is an edge, not a connector point
                        // The edge direction will be handled by the connector's update logic
                    }
                }
            } else if (shapeId) {
                // Final snap check - might have moved slightly
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    const snapResult = shape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    this.connector.setStartPoint(snapResult.point.x, snapResult.point.y)
                    // Attach to shape (either connector point or edge)
                    this.connector.startShapeId = shapeId
                    // Only set connector point if it's actually a connector point, not just an edge
                    this.connector.startConnectorPoint = snapResult.isConnectorPoint ? snapResult.side : null
                    this.connector.updateHandleFill()
                }
            } else {
                const snapped = this.maybeSnapPoint(pointerPos, e, false)
                this.connector.setStartPoint(snapped.x, snapped.y)
                this.connector.startShapeId = null
                this.connector.startConnectorPoint = null
                this.connector.updateHandleFill()
            }
        } else {
            if (shapeId && this.connector.endShapeId === shapeId) {
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    if (this.connector.endConnectorPoint) {
                        // Update to exact connector point position
                        const points = shape.connectionPoints.getConnectorPoints()
                        this.connector.setEndPoint(points[this.connector.endConnectorPoint].x, points[this.connector.endConnectorPoint].y)
                    } else {
                        // Update to closest edge point (keep connector point as null since it's an edge, not a connector point)
                        const edgePoint = shape.connectionPoints.getClosestEdgePoint(this.connector.endPoint.x, this.connector.endPoint.y)
                        this.connector.setEndPoint(edgePoint.x, edgePoint.y)
                        // Keep endConnectorPoint as null since this is an edge, not a connector point
                        // The edge direction will be handled by the connector's update logic
                    }
                }
            } else if (shapeId) {
                // Final snap check - might have moved slightly
                const shape = this.diagramManager.getShapeById(shapeId)
                if (shape) {
                    const snapResult = shape.connectionPoints.getSnapPoint(pointerPos.x, pointerPos.y, CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE)
                    this.connector.setEndPoint(snapResult.point.x, snapResult.point.y)
                    // Attach to shape (either connector point or edge)
                    this.connector.endShapeId = shapeId
                    // Only set connector point if it's actually a connector point, not just an edge
                    this.connector.endConnectorPoint = snapResult.isConnectorPoint ? snapResult.side : null
                    this.connector.updateHandleFill()
                }
            } else {
                const snapped = this.maybeSnapPoint(pointerPos, e, false)
                this.connector.setEndPoint(snapped.x, snapped.y)
                this.connector.endShapeId = null
                this.connector.endConnectorPoint = null
                this.connector.updateHandleFill()
            }
        }
        
        // Clear hover feedback
        this.clearHoverFeedback()

        // Ensure connector is above its connected shapes after drag
        if (this.connector && (this.connector.startShapeId || this.connector.endShapeId)) {
            this.diagramManager.bringConnectorAboveConnectedShapes(this.connector)
        }

        // Clean up any redundant collinear points after endpoint drag
        // Note: For segment drags, this is handled by endSegmentInteraction
        if (this.connector instanceof BentConnector && this.draggedHandle === 'start' || this.draggedHandle === 'end') {
        // Cleanup is needed for endpoint drags (different from segment drags)
            this.connector.render()
        }

        // Finalize pending avoidance state (commits any preview changes)
        if (this.connector instanceof BentConnector) {
            this.connector.finalizePendingAvoidance()
        }

        this.isDragging = false
        const wasDragging = this.connector !== null
        this.connector = null
        this.draggedHandle = null
        this.deactivate()

        // Notify that shapes were modified (triggers storage save)
        if (wasDragging) {
            // Notify DiagramManager that shapes were modified (triggers storage save)
            this.diagramManager.notifyShapeModified()
            
            // Also record history for undo/redo
            if (this.onRecordHistory) {
                this.onRecordHistory()
            }
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
        reference: { x: number; y: number } | null,
        current: { x: number; y: number },
        event: PointerEvent | React.PointerEvent
    ): { x: number; y: number } {
        const shiftPressed = 'shiftKey' in event ? event.shiftKey : false
        if (!shiftPressed || !reference) return current
        const dx = Math.abs(current.x - reference.x)
        const dy = Math.abs(current.y - reference.y)
        if (dx >= dy) {
            return { x: current.x, y: reference.y }
        }
        return { x: reference.x, y: current.y }
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
        // this.hoveredShape = shape
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

        // Clear existing children
        while (this.hoverOverlayGroup.firstChild) {
            this.hoverOverlayGroup.removeChild(this.hoverOverlayGroup.firstChild)
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
            this.hoverOverlayGroup?.appendChild(circle)
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
            this.hoverOverlayGroup.appendChild(rect)
        }
    }

    private clearHoverFeedback() {
        if (this.hoverOverlayGroup && this.hoverOverlayGroup.parentNode) {
            this.hoverOverlayGroup.parentNode.removeChild(this.hoverOverlayGroup)
            this.hoverOverlayGroup = null
        }
        // this.hoveredShape = null
        // this.hoveredSnapResult = null
    }

    protected onDeactivate(): void {
        // Clear hover feedback when tool is deactivated
        this.clearHoverFeedback()
    }

    public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
        return false
    }

    public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
        return false
    }

    public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
        return false
    }

    public isActive(): boolean {
        return this.isDragging
    }
}
