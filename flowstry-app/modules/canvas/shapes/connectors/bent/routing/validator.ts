import { GRID_SPACING } from '../../../../consts/canvas'
import { DiagramShape } from '../../../base'
import { ConnectorPoint } from '../../base'
import { Bounds } from './types'

const BEND_PENALTY = GRID_SPACING

export function getShapeBounds(shape: DiagramShape): Bounds {
    return {
        left: shape.layout.x,
        right: shape.layout.x + shape.layout.width,
        top: shape.layout.y,
        bottom: shape.layout.y + shape.layout.height
    }
}

export function isCollinear(a: ConnectorPoint, b: ConnectorPoint, c: ConnectorPoint): boolean {
    return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
}

export function segmentHitsShape(a: ConnectorPoint, b: ConnectorPoint, shape: DiagramShape): boolean {
    const bounds = getShapeBounds(shape)

    if (a.x === b.x) {
        const x = a.x
        if (x < bounds.left || x > bounds.right) return false
        const minY = Math.min(a.y, b.y)
        const maxY = Math.max(a.y, b.y)
        return maxY >= bounds.top && minY <= bounds.bottom
    }

    if (a.y === b.y) {
        const y = a.y
        if (y < bounds.top || y > bounds.bottom) return false
        const minX = Math.min(a.x, b.x)
        const maxX = Math.max(a.x, b.x)
        return maxX >= bounds.left && minX <= bounds.right
    }

    return false
}

export function isPathValid(
    path: ConnectorPoint[], 
    shapes: DiagramShape[], 
    startShapeId: string | null, 
    endShapeId: string | null
): boolean {
    for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]
        const b = path[i + 1]

        if (a.x !== b.x && a.y !== b.y) {
            return false
        }

        for (const shape of shapes) {
            // Only skip the immediate exit segment (segment 0: start→exit, segment 1: exit→first turn)
            // For start shape: skip segment 0 only (the connection point to exit)
            const isStartConnection = shape.id === startShapeId && i === 0
            // For end shape: skip last segment only (exit to connection point)
            const isEndConnection = shape.id === endShapeId && i === path.length - 2
            
            if (isStartConnection || isEndConnection) {
                continue
            }

            if (segmentHitsShape(a, b, shape)) {
                return false
            }
        }
    }

    return true
}

export function scorePath(path: ConnectorPoint[]): number {
    let total = 0
    
    for (let i = 0; i < path.length - 1; i++) {
        total += Math.abs(path[i].x - path[i + 1].x) + Math.abs(path[i].y - path[i + 1].y)

        if (i > 0) {
            const prev = path[i - 1]
            const curr = path[i]
            const next = path[i + 1]
            if (!isCollinear(prev, curr, next)) {
                total += BEND_PENALTY
            }
        }
    }
    
    return total
}
