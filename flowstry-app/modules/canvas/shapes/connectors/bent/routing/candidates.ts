import { GRID_SPACING } from '../../../../consts/canvas'
import { ConnectorPoint } from '../../base'
import { Bounds } from './types'

export interface RoutingContext {
    start: ConnectorPoint
    end: ConnectorPoint
    startExit: ConnectorPoint
    endExit: ConnectorPoint
    startBounds: Bounds
    endBounds: Bounds
    startArrowheadSize: number
    endArrowheadSize: number
    margin: number
}

function extractSpan(axis: 'x' | 'y', bounds: Bounds): { min: number; max: number } {
    if (axis === 'x') {
        return { min: bounds.left, max: bounds.right }
    }
    return { min: bounds.top, max: bounds.bottom }
}

function getCorridorMidpoint(axis: 'x' | 'y', startBounds: Bounds, endBounds: Bounds): number {
    const startSpan = extractSpan(axis, startBounds)
    const endSpan = extractSpan(axis, endBounds)

    // Sort spans to find the gap
    const [first, second] =
        startSpan.max <= endSpan.min
            ? [startSpan, endSpan]
            : [endSpan, startSpan]

    // If there's a gap between shapes, use the middle of the gap
    if (first.max < second.min) {
        return (first.max + second.min) / 2
    }

    // Otherwise use the midpoint between the exit points
    // (shapes overlap or are adjacent)
    return (startSpan.min + startSpan.max + endSpan.min + endSpan.max) / 4
}

function getCorridorCandidates(
    axis: 'x' | 'y',
    startBounds: Bounds,
    endBounds: Bounds,
    margin: number
): number[] {
    const startSpan = extractSpan(axis, startBounds)
    const endSpan = extractSpan(axis, endBounds)

    const [first, second] =
        startSpan.min <= endSpan.min ? [startSpan, endSpan] : [endSpan, startSpan]

    const gap = second.min - first.max
    const candidates: number[] = []

    if (gap > margin) {
        candidates.push(first.max + gap / 2)
    }

    const outsideBefore = Math.min(startSpan.min, endSpan.min) - margin
    const outsideAfter = Math.max(startSpan.max, endSpan.max) + margin

    candidates.push(outsideBefore, outsideAfter)

    return Array.from(new Set(candidates))
}

export function buildHorizontalCandidates(ctx: RoutingContext): ConnectorPoint[][] {
    const corridors = getCorridorCandidates('x', ctx.startBounds, ctx.endBounds, ctx.margin)
    return corridors.map(x => [
        ctx.start,
        ctx.startExit,
        { x, y: ctx.startExit.y },
        { x, y: ctx.endExit.y },
        ctx.endExit,
        ctx.end
    ])
}

export function buildVerticalCandidates(ctx: RoutingContext): ConnectorPoint[][] {
    const corridors = getCorridorCandidates('y', ctx.startBounds, ctx.endBounds, ctx.margin)
    return corridors.map(y => [
        ctx.start,
        ctx.startExit,
        { x: ctx.startExit.x, y },
        { x: ctx.endExit.x, y },
        ctx.endExit,
        ctx.end
    ])
}

export function buildDetourCandidates(ctx: RoutingContext): ConnectorPoint[][] {
    const candidates: ConnectorPoint[][] = []
    const { start, startExit, endExit, end, startBounds, endBounds, margin } = ctx

    // Calculate clear zones outside both shapes
    const topClear = Math.min(startBounds.top, endBounds.top) - margin
    const bottomClear = Math.max(startBounds.bottom, endBounds.bottom) + margin
    const leftClear = Math.min(startBounds.left, endBounds.left) - margin
    const rightClear = Math.max(startBounds.right, endBounds.right) + margin

    // Go around via BOTTOM
    candidates.push([
        start,
        startExit,
        { x: startExit.x, y: bottomClear },
        { x: endExit.x, y: bottomClear },
        endExit,
        end
    ])

    // Go around via TOP
    candidates.push([
        start,
        startExit,
        { x: startExit.x, y: topClear },
        { x: endExit.x, y: topClear },
        endExit,
        end
    ])

    // Go around via LEFT
    candidates.push([
        start,
        startExit,
        { x: leftClear, y: startExit.y },
        { x: leftClear, y: endExit.y },
        endExit,
        end
    ])

    // Go around via RIGHT
    candidates.push([
        start,
        startExit,
        { x: rightClear, y: startExit.y },
        { x: rightClear, y: endExit.y },
        endExit,
        end
    ])

    return candidates
}

function needsCenterBendForSameDirection(ctx: RoutingContext): boolean {
    const { start, startExit, startBounds, endBounds } = ctx
    const startVertical = start.direction === 'top' || start.direction === 'bottom'
    
    if (startVertical) {
        // Both vertical (top-top or bottom-bottom)
        const shapesOverlapHorizontally = 
            startBounds.left < endBounds.right && startBounds.right > endBounds.left
        
        if (!shapesOverlapHorizontally) {
            const cornerY = startExit.y
            if (start.direction === 'bottom') {
                if (cornerY < endBounds.bottom) return true
            } else {
                if (cornerY > endBounds.top) return true
            }
        }
    } else {
        // Both horizontal (left-left or right-right)
        const shapesOverlapVertically = 
            startBounds.top < endBounds.bottom && startBounds.bottom > endBounds.top
        
        if (!shapesOverlapVertically) {
            const cornerX = startExit.x
            if (start.direction === 'right') {
                if (cornerX < endBounds.right) return true
            } else {
                if (cornerX > endBounds.left) return true
            }
        }
    }
    
    return false
}

function needsZPathForMixedOrientations(ctx: RoutingContext): boolean {
    const { start, end, startExit, endExit } = ctx
    const startVertical = start.direction === 'top' || start.direction === 'bottom'
    
    if (startVertical) {
        if (start.direction === 'bottom' && end.direction === 'left') return endExit.x > startExit.x
        if (start.direction === 'bottom' && end.direction === 'right') return endExit.x < startExit.x
        if (start.direction === 'top' && end.direction === 'left') return endExit.x > startExit.x
        if (start.direction === 'top' && end.direction === 'right') return endExit.x < startExit.x
    } else {
        if (start.direction === 'right' && end.direction === 'top') return endExit.y > startExit.y
        if (start.direction === 'right' && end.direction === 'bottom') return endExit.y < startExit.y
        if (start.direction === 'left' && end.direction === 'top') return endExit.y > startExit.y
        if (start.direction === 'left' && end.direction === 'bottom') return endExit.y < startExit.y
    }
    
    return false
}

/**
 * Check if a detour is needed based on the exit direction and target position.
 * A detour is needed when the exit direction goes AWAY from the target point.
 * 
 * Examples:
 * - Exit RIGHT, target is LEFT of exit point → Detour needed (going wrong way)
 * - Exit RIGHT, target is RIGHT of exit point → No detour (going correct way)
 * - Exit BOTTOM, target is ABOVE exit point → Detour needed (going wrong way)
 * - Exit BOTTOM, target is BELOW exit point → No detour (going correct way)
 */
function needsDetourForDirection(
    exitDirection: string | undefined,
    exitPoint: { x: number; y: number },
    targetPoint: { x: number; y: number }
): boolean {
    if (!exitDirection) return false

    switch (exitDirection) {
        case 'right':
            // Exiting right: detour needed if target is to the LEFT
            return targetPoint.x < exitPoint.x
        case 'left':
            // Exiting left: detour needed if target is to the RIGHT
            return targetPoint.x > exitPoint.x
        case 'bottom':
            // Exiting bottom (going down): detour needed if target is ABOVE
            return targetPoint.y < exitPoint.y
        case 'top':
            // Exiting top (going up): detour needed if target is BELOW
            return targetPoint.y > exitPoint.y
        default:
            return false
    }
}

function adjustCornerForArrowhead(
    cornerX: number,
    cornerY: number,
    arrowheadX: number,
    arrowheadY: number,
    arrowheadSize: number,
    isVerticalArrowhead: boolean
): { x: number, y: number, adjusted: boolean } {
    if (arrowheadSize === 0) {
        return { x: cornerX, y: cornerY, adjusted: false }
    }

    let arrowheadBounds: { left: number, right: number, top: number, bottom: number }
    if (isVerticalArrowhead) {
        arrowheadBounds = {
            left: arrowheadX - arrowheadSize / 2,
            right: arrowheadX + arrowheadSize / 2,
            top: arrowheadY - arrowheadSize,
            bottom: arrowheadY + arrowheadSize
        }
    } else {
        arrowheadBounds = {
            left: arrowheadX - arrowheadSize,
            right: arrowheadX + arrowheadSize,
            top: arrowheadY - arrowheadSize / 2,
            bottom: arrowheadY + arrowheadSize / 2
        }
    }

    const inX = cornerX >= arrowheadBounds.left && cornerX <= arrowheadBounds.right
    const inY = cornerY >= arrowheadBounds.top && cornerY <= arrowheadBounds.bottom

    if (!inX || !inY) {
        return { x: cornerX, y: cornerY, adjusted: false }
    }

    const moveUpDist = cornerY - arrowheadBounds.top
    const moveDownDist = arrowheadBounds.bottom - cornerY
    const moveLeftDist = cornerX - arrowheadBounds.left
    const moveRightDist = arrowheadBounds.right - cornerX

    const minVertical = Math.min(moveUpDist, moveDownDist)
    const minHorizontal = Math.min(moveLeftDist, moveRightDist)

    if (minVertical <= minHorizontal) {
        if (moveUpDist <= moveDownDist) {
            return { x: cornerX, y: arrowheadBounds.top - GRID_SPACING, adjusted: true }
        } else {
            return { x: cornerX, y: arrowheadBounds.bottom + GRID_SPACING, adjusted: true }
        }
    } else {
        if (moveLeftDist <= moveRightDist) {
            return { x: arrowheadBounds.left - GRID_SPACING, y: cornerY, adjusted: true }
        } else {
            return { x: arrowheadBounds.right + GRID_SPACING, y: cornerY, adjusted: true }
        }
    }
}

export function buildSimpleCandidates(ctx: RoutingContext): ConnectorPoint[][] {
    const candidates: ConnectorPoint[][] = []
    const { start, end, startExit, endExit, startBounds, endBounds, margin } = ctx

    const startVertical = start.direction === 'top' || start.direction === 'bottom'
    const endVertical = end.direction === 'top' || end.direction === 'bottom'

    // Check if there's a clear gap between shapes where we should bend in the middle
    const hasHorizontalGap = startBounds.right < endBounds.left || endBounds.right < startBounds.left
    const hasVerticalGap = startBounds.bottom < endBounds.top || endBounds.bottom < startBounds.top

    // CASE 1: Both same orientation
    if (startVertical && endVertical && hasVerticalGap) {
        const corridorY = getCorridorMidpoint('y', startBounds, endBounds)
        candidates.push([
            start,
            startExit,
            { x: startExit.x, y: corridorY },
            { x: endExit.x, y: corridorY },
            endExit,
            end
        ])
    }

    if (!startVertical && !endVertical && hasHorizontalGap) {
        const corridorX = getCorridorMidpoint('x', startBounds, endBounds)
        candidates.push([
            start,
            startExit,
            { x: corridorX, y: startExit.y },
            { x: corridorX, y: endExit.y },
            endExit,
            end
        ])
    }

    // CASE 1a2: Opposite vertical directions (bottom→top or top→bottom) with vertical gap
    // Use needsDetourForDirection to check if the START exit direction goes AWAY from the end point
    // If detour not needed: simple L-path. If detour needed: Z-path with corridor.
    if (startVertical && endVertical && start.direction !== end.direction && hasVerticalGap) {
        // Check if start's exit direction goes AWAY from the end point (needs detour)
        const startNeedsDetour = needsDetourForDirection(start.direction, startExit, endExit)

        if (!startNeedsDetour) {
            // No detour needed: start exit direction points toward end
            // Simple L-path: go in exit direction, bend horizontally at appropriate level
            candidates.unshift([
                start,
                startExit,
                { x: startExit.x, y: endExit.y },
                endExit,
                end
            ])
        } else {
            // Detour needed: start exit direction goes away from end
            // Z-path with centered corridor to redirect
            const corridorY = getCorridorMidpoint('y', startBounds, endBounds)
            candidates.unshift([
                start,
                startExit,
                { x: startExit.x, y: corridorY },
                { x: endExit.x, y: corridorY },
                endExit,
                end
            ])
        }
    }

    // CASE 1a3: Opposite horizontal directions (left→right or right→left) with horizontal gap
    // Use needsDetourForDirection to check if the START exit direction goes AWAY from the end point
    // If detour not needed: simple L-path. If detour needed: Z-path with corridor.
    if (!startVertical && !endVertical && start.direction !== end.direction && hasHorizontalGap) {
        // Check if start's exit direction goes AWAY from the end point (needs detour)
        const startNeedsDetour = needsDetourForDirection(start.direction, startExit, endExit)

        if (!startNeedsDetour) {
            // No detour needed: start exit direction points toward end
            // Simple L-path: go in exit direction, bend vertically at appropriate level
            candidates.unshift([
                start,
                startExit,
                { x: endExit.x, y: startExit.y },
                endExit,
                end
            ])
        } else {
            // Detour needed: start exit direction goes away from end
            // Z-path with centered corridor to redirect
            const corridorX = getCorridorMidpoint('x', startBounds, endBounds)
            candidates.unshift([
                start,
                startExit,
                { x: corridorX, y: startExit.y },
                { x: corridorX, y: endExit.y },
                endExit,
                end
            ])
        }
    }

    // CASE 1b: Both same HORIZONTAL direction with centered vertical segment
    if (!startVertical && !endVertical && start.direction === end.direction && hasHorizontalGap) {
        const corridorX = getCorridorMidpoint('x', startBounds, endBounds)

        if (start.direction === 'right') {
            // For right→right: go to corridor, then up/down to clear end shape, then around
            const goUp = startExit.y > endBounds.top - margin
            const clearY = goUp
                ? Math.min(startBounds.top, endBounds.top) - margin
                : Math.max(startBounds.bottom, endBounds.bottom) + margin
            const rightClear = Math.max(startBounds.right, endBounds.right) + margin

            candidates.unshift([
                start,
                startExit,
                { x: corridorX, y: startExit.y },      // Go to corridor midpoint
                { x: corridorX, y: clearY },            // Go up/down to clear
                { x: rightClear, y: clearY },           // Go past end shape
                { x: rightClear, y: endExit.y },        // Go to endExit Y level
                endExit,
                end
            ])
        } else {
            // For left→left: go to corridor, then up/down to clear end shape, then around
            const goUp = startExit.y > endBounds.top - margin
            const clearY = goUp
                ? Math.min(startBounds.top, endBounds.top) - margin
                : Math.max(startBounds.bottom, endBounds.bottom) + margin
            const leftClear = Math.min(startBounds.left, endBounds.left) - margin

            candidates.unshift([
                start,
                startExit,
                { x: corridorX, y: startExit.y },       // Go to corridor midpoint
                { x: corridorX, y: clearY },            // Go up/down to clear
                { x: leftClear, y: clearY },            // Go past end shape
                { x: leftClear, y: endExit.y },         // Go to endExit Y level
                endExit,
                end
            ])
        }
    }

    // CASE 1c: Both same VERTICAL direction with centered horizontal segment
    if (startVertical && endVertical && start.direction === end.direction && hasVerticalGap) {
        const corridorY = getCorridorMidpoint('y', startBounds, endBounds)

        if (start.direction === 'bottom') {
            // For bottom→bottom: go to corridor, then left/right to clear end shape, then around
            const goLeft = startExit.x > endBounds.left - margin
            const clearX = goLeft
                ? Math.min(startBounds.left, endBounds.left) - margin
                : Math.max(startBounds.right, endBounds.right) + margin
            const bottomClear = Math.max(startBounds.bottom, endBounds.bottom) + margin

            candidates.unshift([
                start,
                startExit,
                { x: startExit.x, y: corridorY },       // Go to corridor midpoint
                { x: clearX, y: corridorY },            // Go left/right to clear
                { x: clearX, y: bottomClear },          // Go past end shape
                { x: endExit.x, y: bottomClear },       // Go to endExit X level
                endExit,
                end
            ])
        } else {
            // For top→top: go to corridor, then left/right to clear end shape, then around
            const goLeft = startExit.x > endBounds.left - margin
            const clearX = goLeft
                ? Math.min(startBounds.left, endBounds.left) - margin
                : Math.max(startBounds.right, endBounds.right) + margin
            const topClear = Math.min(startBounds.top, endBounds.top) - margin

            candidates.unshift([
                start,
                startExit,
                { x: startExit.x, y: corridorY },       // Go to corridor midpoint
                { x: clearX, y: corridorY },            // Go left/right to clear
                { x: clearX, y: topClear },             // Go past end shape
                { x: endExit.x, y: topClear },          // Go to endExit X level
                endExit,
                end
            ])
        }
    }

    // CASE 1d: Same direction but no gap - use the original go-around logic
    if (startVertical && endVertical && start.direction === end.direction && !hasVerticalGap) {
        if (needsCenterBendForSameDirection(ctx)) {
            if (start.direction === 'bottom') {
                const bottomClear = Math.max(startBounds.bottom, endBounds.bottom) + margin
                candidates.unshift([
                    start,
                    startExit,
                    { x: startExit.x, y: bottomClear },
                    { x: endExit.x, y: bottomClear },
                    endExit,
                    end
                ])
            } else {
                const topClear = Math.min(startBounds.top, endBounds.top) - margin
                candidates.unshift([
                    start,
                    startExit,
                    { x: startExit.x, y: topClear },
                    { x: endExit.x, y: topClear },
                    endExit,
                    end
                ])
            }
        }
    }

    if (!startVertical && !endVertical && start.direction === end.direction && !hasHorizontalGap) {
        if (needsCenterBendForSameDirection(ctx)) {
            if (start.direction === 'right') {
                const rightClear = Math.max(startBounds.right, endBounds.right) + margin
                candidates.unshift([
                    start,
                    startExit,
                    { x: rightClear, y: startExit.y },
                    { x: rightClear, y: endExit.y },
                    endExit,
                    end
                ])
            } else {
                const leftClear = Math.min(startBounds.left, endBounds.left) - margin
                candidates.unshift([
                    start,
                    startExit,
                    { x: leftClear, y: startExit.y },
                    { x: leftClear, y: endExit.y },
                    endExit,
                    end
                ])
            }
        }
    }

    // CASE 2: Mixed orientations - three scenarios based on detour needs
    if (startVertical !== endVertical) {
        console.log("Check")
        const startNeedsDetour = needsDetourForDirection(start.direction, startExit, endExit)
        const endNeedsDetour = needsDetourForDirection(end.direction, endExit, startExit)

        // DEBUG: Log mixed orientation decision
        console.log('--- CASE 2: Mixed orientations ---')
        console.log('startVertical:', startVertical, 'endVertical:', endVertical)
        console.log('start.direction:', start.direction, 'end.direction:', end.direction)
        console.log('startExit:', { x: startExit.x, y: startExit.y })
        console.log('endExit:', { x: endExit.x, y: endExit.y })
        console.log('startNeedsDetour:', startNeedsDetour, 'endNeedsDetour:', endNeedsDetour)

        if (!startNeedsDetour && !endNeedsDetour) {
            // SCENARIO 1: Neither needs detour - L-path TYPE A
            // Exit directions naturally point toward each other
            // Simple 3-point L-path: start -> corner -> end
            console.log('DECISION: Neither needs detour, L-path TYPE A')
            if (startVertical) {
                // Corner at (start.x, end.y) - go vertical first then horizontal
                const lPath = [
                    start,
                    { x: start.x, y: end.y },
                    end
                ]
                console.log('L-path TYPE A (3-point):', lPath.map(p => ({ x: p.x, y: p.y })))
                candidates.unshift(lPath)
            } else {
                // Corner at (end.x, start.y) - go horizontal first then vertical
                const lPath = [
                    start,
                    { x: end.x, y: start.y },
                    end
                ]
                console.log('L-path TYPE A (3-point):', lPath.map(p => ({ x: p.x, y: p.y })))
                candidates.unshift(lPath)
            }
        } else if (startNeedsDetour && endNeedsDetour) {
            // SCENARIO 2: BOTH need detour - L-path TYPE B
            // Both exit directions point away, but their DETOUR directions are perpendicular
            // Since mixed orientations: start vertical + end horizontal (or vice versa)
            // Detour directions: start goes horizontal toward end.x, end goes vertical toward start.y
            // These form an L-path with ALTERNATE corner
            console.log('DECISION: Both need detour, L-path TYPE B (alternate corner)')
            if (startVertical) {
                // Start goes vertical then horizontal (detour toward end.x)
                // End goes horizontal then vertical (detour toward start.y)
                // Corner at (endExit.x, startExit.y) - go horizontal first, then vertical
                candidates.unshift([
                    start,
                    startExit,
                    { x: endExit.x, y: startExit.y },
                    endExit,
                    end
                ])
            } else {
                // Start goes horizontal then vertical (detour toward end.y)
                // End goes vertical then horizontal (detour toward start.x)
                // Corner at (startExit.x, endExit.y) - go vertical first, then horizontal
                candidates.unshift([
                    start,
                    startExit,
                    { x: startExit.x, y: endExit.y },
                    endExit,
                    end
                ])
            }
        } else {
            // SCENARIO 3: Only ONE needs detour - Z-path with corridor
            // One direction points toward target, other points away - they don't naturally meet
            console.log('DECISION: One needs detour, using Z-path corridor')
            if (startVertical) {
                const corridorY = getCorridorMidpoint('y', startBounds, endBounds)
                candidates.unshift([
                    start,
                    startExit,
                    { x: startExit.x, y: corridorY },
                    { x: endExit.x, y: corridorY },
                    endExit,
                    end
                ])
            } else {
                const corridorX = getCorridorMidpoint('x', startBounds, endBounds)
                candidates.unshift([
                    start,
                    startExit,
                    { x: corridorX, y: startExit.y },
                    { x: corridorX, y: endExit.y },
                    endExit,
                    end
                ])
            }
        }
    }

    // Fallback: Z-path when endpoints cross (for mixed orientations)
    if (startVertical !== endVertical && needsZPathForMixedOrientations(ctx)) {
        const midX = (startExit.x + endExit.x) / 2
        const midY = (startExit.y + endExit.y) / 2

        if (startVertical) {
            candidates.push([
                start,
                startExit,
                { x: midX, y: startExit.y },
                { x: midX, y: endExit.y },
                endExit,
                end
            ])
        } else {
            candidates.push([
                start,
                startExit,
                { x: startExit.x, y: midY },
                { x: endExit.x, y: midY },
                endExit,
                end
            ])
        }
    }

    // Classic L paths
    const startArrowheadSize = ctx.startArrowheadSize
    const endArrowheadSize = ctx.endArrowheadSize

    // L-path 1: corner at (endExit.x, startExit.y)
    let corner1X = endExit.x
    let corner1Y = startExit.y

    if (startArrowheadSize > 0) {
        const result = adjustCornerForArrowhead(
            corner1X, corner1Y, start.x, start.y, startArrowheadSize, startVertical
        )
        corner1X = result.x
        corner1Y = result.y
    }
    if (endArrowheadSize > 0) {
        const result = adjustCornerForArrowhead(
            corner1X, corner1Y, end.x, end.y, endArrowheadSize, endVertical
        )
        corner1X = result.x
        corner1Y = result.y
    }

    candidates.push([
        start,
        startExit,
        { x: corner1X, y: corner1Y },
        endExit,
        end
    ])

    // L-path 2: corner at (startExit.x, endExit.y)
    let corner2X = startExit.x
    let corner2Y = endExit.y

    if (startArrowheadSize > 0) {
        const result = adjustCornerForArrowhead(
            corner2X, corner2Y, start.x, start.y, startArrowheadSize, startVertical
        )
        corner2X = result.x
        corner2Y = result.y
    }
    if (endArrowheadSize > 0) {
        const result = adjustCornerForArrowhead(
            corner2X, corner2Y, end.x, end.y, endArrowheadSize, endVertical
        )
        corner2X = result.x
        corner2Y = result.y
    }

    candidates.push([
        start,
        startExit,
        { x: corner2X, y: corner2Y },
        endExit,
        end
    ])

    // Detour paths
    const detourPaths = buildDetourCandidates(ctx)
    candidates.push(...detourPaths)

    return candidates
}
