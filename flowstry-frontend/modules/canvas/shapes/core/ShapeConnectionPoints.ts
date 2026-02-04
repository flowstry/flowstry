
import { GRID_SPACING } from '../../consts/canvas';
import { ShapeLayout } from './ShapeLayout';

// Constants for connector snapping behavior
export const CONNECTOR_POINT_SNAP_RADIUS = GRID_SPACING * 1.5 // Snap to connector point when within 1.5 grid spacing
export const EDGE_FOLLOW_DISTANCE = 25 // Pixels: when inside shape, follow edge if within this distance

export class ShapeConnectionPoints {
    private layout: ShapeLayout;

    constructor(layout: ShapeLayout) {
        this.layout = layout;
    }

    // Get the four main connector points: top, bottom, left, right
    getConnectorPoints(): { top: { x: number; y: number }, bottom: { x: number; y: number }, left: { x: number; y: number }, right: { x: number; y: number } } {
        const centerX = this.layout.x + this.layout.width / 2
        const centerY = this.layout.y + this.layout.height / 2
        
        return {
            top: { x: centerX, y: this.layout.y },
            bottom: { x: centerX, y: this.layout.y + this.layout.height },
            left: { x: this.layout.x, y: centerY },
            right: { x: this.layout.x + this.layout.width, y: centerY }
        }
    }

    // Find the closest connector point to a given position
    getClosestConnectorPoint(x: number, y: number): { point: { x: number; y: number }, side: 'top' | 'bottom' | 'left' | 'right' } {
        const points = this.getConnectorPoints()
        
        let closestDistance = Infinity
        let closestPoint: { x: number; y: number } | null = null
        let closestSide: 'top' | 'bottom' | 'left' | 'right' = 'top'
        
        const sides: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right']
        
        for (const side of sides) {
            const point = points[side]
            const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2))
            
            if (distance < closestDistance) {
                closestDistance = distance
                closestPoint = point
                closestSide = side
            }
        }
        
        return { point: closestPoint!, side: closestSide }
    }

    // Check if a point is inside the shape
    isPointInside(x: number, y: number): boolean {
        return x >= this.layout.x && x <= this.layout.x + this.layout.width &&
            y >= this.layout.y && y <= this.layout.y + this.layout.height
    }

    // Determine which side of the shape an edge point is on
    getEdgeSide(edgePoint: { x: number; y: number }): 'top' | 'bottom' | 'left' | 'right' {
        const TOLERANCE = 1 // Tolerance for considering a point on an edge
        
        // Check which edge the point is on
        const onTop = Math.abs(edgePoint.y - this.layout.y) <= TOLERANCE
        const onBottom = Math.abs(edgePoint.y - (this.layout.y + this.layout.height)) <= TOLERANCE
        const onLeft = Math.abs(edgePoint.x - this.layout.x) <= TOLERANCE
        const onRight = Math.abs(edgePoint.x - (this.layout.x + this.layout.width)) <= TOLERANCE
        
        // Determine which side based on which edge the point is on
        if (onTop) return 'top'
        if (onBottom) return 'bottom'
        if (onLeft) return 'left'
        if (onRight) return 'right'
        
        // Fallback: calculate which edge is closest
        const distToTop = Math.abs(edgePoint.y - this.layout.y)
        const distToBottom = Math.abs(edgePoint.y - (this.layout.y + this.layout.height))
        const distToLeft = Math.abs(edgePoint.x - this.layout.x)
        const distToRight = Math.abs(edgePoint.x - (this.layout.x + this.layout.width))
        
        const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight)
        
        if (minDist === distToTop) return 'top'
        if (minDist === distToBottom) return 'bottom'
        if (minDist === distToLeft) return 'left'
        return 'right'
    }

    // Find the closest point on the shape's edge/stroke
    getClosestEdgePoint(x: number, y: number): { x: number; y: number } {
        // Always find the actual edge point, whether inside or outside
        // Clamp x and y to the bounding box edges
        let edgeX = x
        let edgeY = y
        
        // Determine which edge is closest
        const distToLeft = Math.abs(x - this.layout.x)
        const distToRight = Math.abs(x - (this.layout.x + this.layout.width))
        const distToTop = Math.abs(y - this.layout.y)
        const distToBottom = Math.abs(y - (this.layout.y + this.layout.height))
        
        const minDistX = Math.min(distToLeft, distToRight)
        const minDistY = Math.min(distToTop, distToBottom)
        
        if (minDistX < minDistY) {
            // Closer to left or right edge
            edgeX = distToLeft < distToRight ? this.layout.x : this.layout.x + this.layout.width
            // Clamp y to the vertical range of the shape
            edgeY = Math.max(this.layout.y, Math.min(this.layout.y + this.layout.height, y))
        } else {
            // Closer to top or bottom edge
            edgeY = distToTop < distToBottom ? this.layout.y : this.layout.y + this.layout.height
            // Clamp x to the horizontal range of the shape
            edgeX = Math.max(this.layout.x, Math.min(this.layout.x + this.layout.width, x))
        }
        
        return { x: edgeX, y: edgeY }
    }

    // Project a point onto a specific edge of the shape
    getPointOnEdge(x: number, y: number, side: 'top' | 'bottom' | 'left' | 'right'): { x: number; y: number } {
        switch (side) {
            case 'top':
                return { x: Math.max(this.layout.x, Math.min(this.layout.x + this.layout.width, x)), y: this.layout.y }
            case 'bottom':
                return { x: Math.max(this.layout.x, Math.min(this.layout.x + this.layout.width, x)), y: this.layout.y + this.layout.height }
            case 'left':
                return { x: this.layout.x, y: Math.max(this.layout.y, Math.min(this.layout.y + this.layout.height, y)) }
            case 'right':
                return { x: this.layout.x + this.layout.width, y: Math.max(this.layout.y, Math.min(this.layout.y + this.layout.height, y)) }
        }
    }

    // Calculate distance from a point to the nearest edge of the shape
    getDistanceToEdge(x: number, y: number): number {
        const isInside = this.isPointInside(x, y)
        
        if (isInside) {
            // Distance to nearest edge when inside
            const distToLeft = x - this.layout.x
            const distToRight = (this.layout.x + this.layout.width) - x
            const distToTop = y - this.layout.y
            const distToBottom = (this.layout.y + this.layout.height) - y
            
            return Math.min(distToLeft, distToRight, distToTop, distToBottom)
        } else {
            // Distance to nearest edge when outside
            const edgePoint = this.getClosestEdgePoint(x, y)
            return Math.sqrt(Math.pow(x - edgePoint.x, 2) + Math.pow(y - edgePoint.y, 2))
        }
    }

    // Check if a point (like a connector point position) is within snap radius of any connector point
    // This is used to snap the connector point itself, not the cursor
    checkConnectorPointSnap(connectorPointX: number, connectorPointY: number, snapRadius: number = CONNECTOR_POINT_SNAP_RADIUS): { 
        point: { x: number; y: number }, 
        side: 'top' | 'bottom' | 'left' | 'right' | null,
        isConnectorPoint: boolean 
    } | null {
        const points = this.getConnectorPoints()
        const sides: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right']
        
        for (const side of sides) {
            const point = points[side]
            const distance = Math.sqrt(Math.pow(connectorPointX - point.x, 2) + Math.pow(connectorPointY - point.y, 2))
            
            if (distance <= snapRadius) {
                return { 
                    point, 
                    side,
                    isConnectorPoint: true 
                }
            }
        }
        
        return null
    }

    // Get the best snap point considering connector points and edge
    getSnapPoint(x: number, y: number, snapRadius: number = CONNECTOR_POINT_SNAP_RADIUS, edgeFollowDistance: number = EDGE_FOLLOW_DISTANCE): { 
        point: { x: number; y: number }, 
        side: 'top' | 'bottom' | 'left' | 'right' | null,
        isConnectorPoint: boolean 
    } {
        const isInside = this.isPointInside(x, y)
        const distanceToEdge = this.getDistanceToEdge(x, y)
        
        // If inside the shape
        if (isInside) {
            // If more than edgeFollowDistance away from the stroke, snap to connector point
            if (distanceToEdge > edgeFollowDistance) {
                const closest = this.getClosestConnectorPoint(x, y)
                return { 
                    point: closest.point, 
                    side: closest.side,
                    isConnectorPoint: true 
                }
            } else {
                // Within edgeFollowDistance of the stroke, follow the stroke (edge)
                const edgePoint = this.getClosestEdgePoint(x, y)
                const side = this.getEdgeSide(edgePoint)
                return { 
                    point: edgePoint, 
					side,
					isConnectorPoint: false 
				}
			}
		}

		// If outside the shape, check if we're within snap radius of any connector point
		const points = this.getConnectorPoints()
		const sides: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right']
		
		for (const side of sides) {
			const point = points[side]
			const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2))
			
			if (distance <= snapRadius) {
				return { 
					point, 
					side,
					isConnectorPoint: true 
				}
			}
		}

		// Not within snap radius of connector points, snap to edge
		const edgePoint = this.getClosestEdgePoint(x, y)
		const side = this.getEdgeSide(edgePoint)
		return { 
			point: edgePoint, 
			side,
			isConnectorPoint: false 
		}
	}
}
