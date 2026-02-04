import { GRID_SPACING } from '../../consts/canvas';
import { DiagramShape } from '../base';
import { ConnectorShape, ConnectorType } from './base';

// Straight connector implementation
export class StraightConnector extends ConnectorShape {
    readonly connectorType: ConnectorType = 'straight'
    
    // Additional path elements for inside-shape portions (dashed when selected)
    private startInsidePath: SVGPathElement | null = null
    private endInsidePath: SVGPathElement | null = null

    constructor(
        startPoint: { x: number; y: number },
        endPoint: { x: number; y: number },
        startShapeId: string | null = null,
        endShapeId: string | null = null
    ) {
        super(startPoint, endPoint, startShapeId, endShapeId)

        // Create the inside-shape path elements (initially hidden)
        this.startInsidePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        this.startInsidePath.setAttribute('fill', 'none')
        this.startInsidePath.setAttribute('stroke-linecap', 'round')
        this.startInsidePath.setAttribute('stroke-linejoin', 'round')
        this.startInsidePath.setAttribute('pointer-events', 'none')
        this.startInsidePath.style.display = 'none'
        
        this.endInsidePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        this.endInsidePath.setAttribute('fill', 'none')
        this.endInsidePath.setAttribute('stroke-linecap', 'round')
        this.endInsidePath.setAttribute('stroke-linejoin', 'round')
        this.endInsidePath.setAttribute('pointer-events', 'none')
        this.endInsidePath.style.display = 'none'
        
        // Insert before the main path so they appear below it
        this.element.insertBefore(this.startInsidePath, this.shapeElement)
        this.element.insertBefore(this.endInsidePath, this.shapeElement)
    }

    updatePath(): void {
        // Update pointsStraight array - just start and end points
        this.pointsStraight = [
            { x: this.startPoint.x, y: this.startPoint.y },
            { x: this.endPoint.x, y: this.endPoint.y }
        ]
    }

    // Calculate intersection point of a line with a rectangle boundary
    // Returns the closest intersection to point (x1, y1) when going from (x1, y1) to (x2, y2)
    private lineRectIntersection(
        x1: number, y1: number, // Line start (inside or outside)
        x2: number, y2: number, // Line end (inside or outside)
        rect: { x: number; y: number; width: number; height: number }
    ): { x: number; y: number } | null {
        const { x: rx, y: ry, width: rw, height: rh } = rect
        const rectRight = rx + rw
        const rectBottom = ry + rh

        // Direction of the line
        const dx = x2 - x1
        const dy = y2 - y1

        // Collect all valid intersections
        const intersections: { x: number; y: number; t: number }[] = []

        // Left edge (x = rx)
        if (dx !== 0) {
            const t = (rx - x1) / dx
            if (t >= 0 && t <= 1) {
                const yIntersect = y1 + t * dy
                if (yIntersect >= ry && yIntersect <= rectBottom) {
                    intersections.push({ x: rx, y: yIntersect, t })
                }
            }
        }

        // Right edge (x = rectRight)
        if (dx !== 0) {
            const t = (rectRight - x1) / dx
            if (t >= 0 && t <= 1) {
                const yIntersect = y1 + t * dy
                if (yIntersect >= ry && yIntersect <= rectBottom) {
                    intersections.push({ x: rectRight, y: yIntersect, t })
                }
            }
        }

        // Top edge (y = ry)
        if (dy !== 0) {
            const t = (ry - y1) / dy
            if (t >= 0 && t <= 1) {
                const xIntersect = x1 + t * dx
                if (xIntersect >= rx && xIntersect <= rectRight) {
                    intersections.push({ x: xIntersect, y: ry, t })
                }
            }
        }

        // Bottom edge (y = rectBottom)
        if (dy !== 0) {
            const t = (rectBottom - y1) / dy
            if (t >= 0 && t <= 1) {
                const xIntersect = x1 + t * dx
                if (xIntersect >= rx && xIntersect <= rectRight) {
                    intersections.push({ x: xIntersect, y: rectBottom, t })
                }
            }
        }

        // Remove duplicates
        const unique: { x: number; y: number; t: number }[] = []
        for (const inter of intersections) {
            const isDuplicate = unique.some(u => 
                Math.abs(u.x - inter.x) < 0.001 && Math.abs(u.y - inter.y) < 0.001
            )
            if (!isDuplicate) {
                unique.push(inter)
            }
        }

        if (unique.length === 0) return null

        // If point (x1, y1) is inside the rect, return the intersection with largest t (exit point)
        // Otherwise, return the intersection with smallest t (entry point)
        const isInside = this.isPointInRect(x1, y1, rect)
        
        if (isInside) {
            // Find exit point (largest t, closest to end)
            let maxT = -Infinity
            let exitPoint: { x: number; y: number } | null = null
            for (const inter of unique) {
                if (inter.t > maxT) {
                    maxT = inter.t
                    exitPoint = { x: inter.x, y: inter.y }
                }
            }
            return exitPoint
        } else {
            // Find entry point (smallest t, closest to start)
            let minT = Infinity
            let entryPoint: { x: number; y: number } | null = null
            for (const inter of unique) {
                if (inter.t < minT) {
                    minT = inter.t
                    entryPoint = { x: inter.x, y: inter.y }
                }
            }
            return entryPoint
        }
    }

    // Get the visible portion of the line (outside both shapes)
    private getVisibleSegment(): {
        visibleStart: { x: number; y: number },
        visibleEnd: { x: number; y: number },
        startInsideSegment: { start: { x: number; y: number }, end: { x: number; y: number } } | null,
        endInsideSegment: { start: { x: number; y: number }, end: { x: number; y: number } } | null
    } {
        const start = this.startPoint
        const end = this.endPoint
        
        let visibleStart = { ...start }
        let visibleEnd = { ...end }
        let startInsideSegment: { start: { x: number; y: number }, end: { x: number; y: number } } | null = null
        let endInsideSegment: { start: { x: number; y: number }, end: { x: number; y: number } } | null = null

        // Check start shape - use original line from start to end
        if (this.startShapeId) {
            const startShape = this.getShapeById(this.startShapeId)
            if (startShape) {
                const rect = {
                      x: startShape.layout.x,
                      y: startShape.layout.y,
                      width: startShape.layout.width,
                      height: startShape.layout.height
                }
                
                // Check if start point is inside the shape
                if (this.isPointInRect(start.x, start.y, rect)) {
                    // Find where line exits the start shape (going from start to end)
                    // lineRectIntersection will return exit point when start is inside
                    const exitPoint = this.lineRectIntersection(start.x, start.y, end.x, end.y, rect)
                    if (exitPoint) {
                        startInsideSegment = { start: { ...start }, end: exitPoint }
                        visibleStart = exitPoint
                    }
                }
            }
        }

        // Check end shape - calculate from visibleStart (adjusted for start shape) to end
        if (this.endShapeId) {
            const endShape = this.getShapeById(this.endShapeId)
            if (endShape) {
                const rect = {
                    x: endShape.layout.x,
                    y: endShape.layout.y,
                    width: endShape.layout.width,
                    height: endShape.layout.height
                }
                
                // Check if end point is inside the shape
                if (this.isPointInRect(end.x, end.y, rect)) {
                    // Find where line enters the end shape
                    // Calculate from visibleStart to end - since visibleStart should be outside end shape,
                    // the intersection function will return the entry point (smallest t)
                    const entryPoint = this.lineRectIntersection(visibleStart.x, visibleStart.y, end.x, end.y, rect)
                    if (entryPoint) {
                        endInsideSegment = { start: entryPoint, end: { ...end } }
                        visibleEnd = entryPoint
                    }
                }
            }
        }

        return { visibleStart, visibleEnd, startInsideSegment, endInsideSegment }
    }

    private isPointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    }

    protected buildPathFromPoints(): string {
        if (this.pointsStraight.length < 2) return ''
        
        const { visibleStart, visibleEnd } = this.getVisibleSegment()
        
        // Apply gap offset if connected to shapes
        const gapStart = this.offsetPointFromShape(visibleStart, true)
        const gapEnd = this.offsetPointFromShape(visibleEnd, false)

        // Save gap-offset positions as arrowhead tip positions BEFORE shortening
        // This is where the arrowhead tip will be placed
        this.pathStart = gapStart
        this.pathEnd = gapEnd

        // Now shorten the line to make room for arrowheads
        const lineStart = this.addArrowheadOffset(gapStart, true)
        const lineEnd = this.addArrowheadOffset(gapEnd, false)

        return `M ${lineStart.x} ${lineStart.y} L ${lineEnd.x} ${lineEnd.y}`
    }

    render(): void {
        if (!this.state.needsRender) return

        // Call parent render which handles updatePath, buildPathFromPoints, etc.
        super.render()

        // Update the inside-shape dashed paths
        this.updateInsidePaths()
    }

    private updateInsidePaths(): void {
        if (!this.startInsidePath || !this.endInsidePath) return

        const { startInsideSegment, endInsideSegment } = this.getVisibleSegment()

        // Update start inside path
        if (startInsideSegment && this.state.selected) {
            const d = `M ${startInsideSegment.start.x} ${startInsideSegment.start.y} L ${startInsideSegment.end.x} ${startInsideSegment.end.y}`
            this.startInsidePath.setAttribute('d', d)
            this.startInsidePath.setAttribute('stroke', '#60a5fa') // Match handle color
            this.startInsidePath.setAttribute('stroke-width', '1') // Fixed thin width
            this.startInsidePath.setAttribute('stroke-dasharray', '4 4')
            this.startInsidePath.style.display = ''
        } else {
            this.startInsidePath.style.display = 'none'
        }

        // Update end inside path
        if (endInsideSegment && this.state.selected) {
            const d = `M ${endInsideSegment.start.x} ${endInsideSegment.start.y} L ${endInsideSegment.end.x} ${endInsideSegment.end.y}`
            this.endInsidePath.setAttribute('d', d)
            this.endInsidePath.setAttribute('stroke', '#60a5fa') // Match handle color
            this.endInsidePath.setAttribute('stroke-width', '1') // Fixed thin width
            this.endInsidePath.setAttribute('stroke-dasharray', '4 4')
            this.endInsidePath.style.display = ''
        } else {
            this.endInsidePath.style.display = 'none'
        }
    }

    intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean {
        const { x: x1, y: y1 } = this.startPoint
        const { x: x2, y: y2 } = this.endPoint
        return this.lineIntersectsRect(x1, y1, x2, y2, rect)
    }

    // Override to update inside paths when selection is shown
    showSelectionIndicator(): void {
        this.updateInsidePaths()
    }

    // Override to update inside paths when selection is hidden
    hideSelectionIndicator(): void {
        super.hideSelectionIndicator()
        this.updateInsidePaths()
    }

    /**
     * Override getMarkerOrientAngle to use the line segment angle
     * instead of cardinal directions.
     */
    protected getMarkerOrientAngle(isStart: boolean): number {
        // Use the actual line points (from start to end)
        // If connected to shapes, these points are already the best approximation
        // of the line direction we want the arrow to follow.
        const dx = this.endPoint.x - this.startPoint.x
        const dy = this.endPoint.y - this.startPoint.y

        // Calculate angle in degrees
        // atan2 returns angle from X axis (Right)
        let angle = Math.atan2(dy, dx) * (180 / Math.PI)

        // If it's the start marker, we want it pointing into the start shape.
        // The line goes FROM start TO end.
        // The arrow standard direction (0 deg) is Right.
        // If we place it at start, pointing along voltage (Angle), it points to End.
        // We want it to point to Start (opposite direction).
        if (isStart) {
            angle += 180
        }

        return angle
    }

    /**
     * Override addArrowheadOffset to shorten the line along the diagonal vector
     * instead of using cardinal offsets.
     */
    protected addArrowheadOffset(point: { x: number; y: number }, isStart: boolean): { x: number; y: number } {
        const arrowheadType = isStart ? this.startArrowheadType : this.endArrowheadType
        if (arrowheadType === 'none') {
            return point
        }

        const arrowheadSize = this.getArrowheadSize(arrowheadType)

        // Calculate vector from visible start to visible end
        const { visibleStart, visibleEnd } = this.getVisibleSegment()

        const dx = visibleEnd.x - visibleStart.x
        const dy = visibleEnd.y - visibleStart.y
        const length = Math.sqrt(dx * dx + dy * dy)

        // Avoid division by zero
        if (length < 0.001) {
            return point
        }

        // Normalized direction vector
        const unitX = dx / length
        const unitY = dy / length

        if (isStart) {
            // For start point, we move it TOWARDS the end point (along vector)
            return {
                x: point.x + unitX * arrowheadSize,
                y: point.y + unitY * arrowheadSize
            }
        } else {
            // For end point, we move it TOWARDS the start point (opposite to vector)
            return {
                x: point.x - unitX * arrowheadSize,
                y: point.y - unitY * arrowheadSize
            }
        }
    }

    /**
     * Override offsetPointFromShape to use the line vector for the gap
     * instead of cardinal directions. This ensures the line remains straight.
     */
    protected offsetPointFromShape(point: { x: number; y: number }, isStart: boolean): { x: number; y: number } {
        const shapeId = isStart ? this.startShapeId : this.endShapeId
        if (!shapeId) {
            return point
        }

        // Calculate vector from visible start to visible end
        const { visibleStart, visibleEnd } = this.getVisibleSegment()

        const dx = visibleEnd.x - visibleStart.x
        const dy = visibleEnd.y - visibleStart.y
        const length = Math.sqrt(dx * dx + dy * dy)

        // Avoid division by zero
        if (length < 0.001) {
            return point
        }

        // Normalized direction vector
        const unitX = dx / length
        const unitY = dy / length

        const gap = GRID_SPACING * 0.5

        if (isStart) {
            // For start point, we move it TOWARDS the end point (along vector)
            return {
                x: point.x + unitX * gap,
                y: point.y + unitY * gap
            }
        } else {
            // For end point, we move it TOWARDS the start point (opposite to vector)
            return {
                x: point.x - unitX * gap,
                y: point.y - unitY * gap
            }
        }
    }

    /**
     * Get a point at a specific position along the straight line
     * @param ratio Value from 0.0 (start) to 1.0 (end)
     */
    getPointAtPosition(ratio: number): { x: number; y: number } {
        return {
            x: this.startPoint.x + (this.endPoint.x - this.startPoint.x) * ratio,
            y: this.startPoint.y + (this.endPoint.y - this.startPoint.y) * ratio
        }
    }

    /**
     * Find the closest position (ratio) on the line for a given point
     * Projects the point onto the line segment and returns the ratio
     */
    getClosestPositionOnPath(point: { x: number; y: number }): number {
        const dx = this.endPoint.x - this.startPoint.x
        const dy = this.endPoint.y - this.startPoint.y
        const lengthSq = dx * dx + dy * dy

        if (lengthSq < 0.001) {
            return 0.5 // Degenerate case: start and end are same point
        }

        // Project point onto line using dot product
        const t = ((point.x - this.startPoint.x) * dx + (point.y - this.startPoint.y) * dy) / lengthSq

        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, t))
    }

    copy(): DiagramShape {
        const newShape = new StraightConnector(
            { ...this.startPoint },
            { ...this.endPoint },
            this.startShapeId,
            this.endShapeId
        );
        newShape.copyFrom(this);
        newShape.copyConnectorProperties(this);
        return newShape;
    }
}
