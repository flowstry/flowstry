import { ConnectorDirection } from '../base';

/**
 * Offset a point by a specific amount in the given direction
 */
export function offsetPointByDirection(point: { x: number; y: number }, direction: ConnectorDirection, amount: number): { x: number; y: number } {
    switch (direction) {
        case 'top':
            return { x: point.x, y: point.y - amount }
        case 'bottom':
            return { x: point.x, y: point.y + amount }
        case 'left':
            return { x: point.x - amount, y: point.y }
        case 'right':
            return { x: point.x + amount, y: point.y }
    }
}

/**
 * Calculate default dynamic directions based on relative positions of start and end points
 */
export function defaultDynamicDirections(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }): { startDefaultDirection: ConnectorDirection, endDefaultDirection: ConnectorDirection } {
    const dx = endPoint.x - startPoint.x
    const dy = endPoint.y - startPoint.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    let startDefaultDirection: ConnectorDirection
    let endDefaultDirection: ConnectorDirection

    // Determine primary direction (horizontal vs vertical)
    if (absDy > absDx) {
        // Vertical movement is primary
        if (dy > 0) {
            // End is below start: start faces down, end faces up
            startDefaultDirection = 'bottom'
            endDefaultDirection = 'top'
        } else {
            // End is above start: start faces up, end faces down
            startDefaultDirection = 'top'
            endDefaultDirection = 'bottom'
        }
    } else {
        // Horizontal movement is primary
        if (dx > 0) {
            // End is to the right: start faces right, end faces left
            startDefaultDirection = 'right'
            endDefaultDirection = 'left'
        } else {
            // End is to the left: start faces left, end faces right
            startDefaultDirection = 'left'
            endDefaultDirection = 'right'
        }
    }

    return { startDefaultDirection, endDefaultDirection }
}

/**
 * Calculate the marker orientation angle based on connector point direction.
 */
export function getMarkerOrientAngle(direction: ConnectorDirection | null, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }, isStart: boolean): number {
    if (!direction) {
        // Fallback: calculate from start/end points
        const dx = endPoint.x - startPoint.x
        const dy = endPoint.y - startPoint.y
        // Calculate angle in degrees (atan2 gives radians, convert to degrees)
        // This gives the angle of the line from start to end
        let angle = Math.atan2(dy, dx) * (180 / Math.PI)
        // For start markers, flip 180°
        if (isStart) {
            angle += 180
        }
        return angle
    }

    // Both start and end use the same logic:
    // Arrowhead points opposite to connector point direction (into the path)
    switch (direction) {
        case 'top': return 90      // Direction is up → arrowhead points down
        case 'bottom': return 270  // Direction is down → arrowhead points up
        case 'left': return 0      // Direction is left → arrowhead points right
        case 'right': return 180   // Direction is right → arrowhead points left
    }
}

/**
 * Helper method for line segment intersection testing
 */
export function lineIntersectsRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rect: { x: number; y: number; width: number; height: number }
): boolean {
    const { x: rx, y: ry, width: rw, height: rh } = rect
    const rectRight = rx + rw
    const rectBottom = ry + rh

    // Helper to check if a point is in the rect
    const pointInRect = (x: number, y: number) => {
        return x >= rx && x <= rectRight && y >= ry && y <= rectBottom
    }

    // Trivial accept: either endpoint is inside
    if (pointInRect(x1, y1) || pointInRect(x2, y2)) return true

    // Trivial reject: both points on same side of rect
    if (Math.max(x1, x2) < rx || Math.min(x1, x2) > rectRight ||
        Math.max(y1, y2) < ry || Math.min(y1, y2) > rectBottom) return false

    // Check intersection with rect edges
    const check = (x3: number, y3: number, x4: number, y4: number) => {
        const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
        if (den === 0) return false
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
    }

    // Top
    if (check(rx, ry, rectRight, ry)) return true
    // Bottom
    if (check(rx, rectBottom, rectRight, rectBottom)) return true
    // Left
    if (check(rx, ry, rx, rectBottom)) return true
    // Right
    if (check(rectRight, ry, rectRight, rectBottom)) return true

    return false
}
