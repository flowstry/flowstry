/**
 * PathCalculator - Handles dynamic path calculation for bent connectors.
 * 
 * This module is responsible for calculating optimal paths when the connector
 * is in "dynamic mode" (not user-modified). It generates candidate paths,
 * validates them against shape collisions, and selects the best one.
 */

import { GRID_SPACING } from '../../../../consts/canvas'
import { DiagramShape } from '../../../base'
import { ConnectorDirection, ConnectorPoint } from '../../base'
import {
    buildDetourCandidates,
    buildHorizontalCandidates,
    buildSimpleCandidates,
    buildVerticalCandidates,
    RoutingContext
} from './candidates'
import { Bounds, Direction } from './types'
import { getShapeBounds, isPathValid, scorePath } from './validator'

/**
 * Context for path calculation containing all necessary information
 * about the connector's endpoints, connected shapes, and styling.
 */
export interface PathCalculatorContext {
    // Connection points
    startPoint: { x: number; y: number }
    endPoint: { x: number; y: number }
    
    // Directions
    startDirection: ConnectorDirection
    endDirection: ConnectorDirection
    
    // Connected shapes (null if not connected)
    startShape: DiagramShape | null
    endShape: DiagramShape | null
    startShapeId: string | null
    endShapeId: string | null
    
    // Arrowhead info
    startArrowheadType: string
    endArrowheadType: string
    startArrowheadSize: number
    endArrowheadSize: number
    
    // Routing parameters
    routingMargin: number
    exitOffset: number
}

/**
 * PathCalculator class handles all dynamic path calculation logic.
 */
export class PathCalculator {
    /**
     * Calculate the optimal path based on the given context.
     * This is the main entry point for path calculation.
     */
    calculatePath(ctx: PathCalculatorContext): ConnectorPoint[] {
        const isAttached = Boolean(ctx.startShape || ctx.endShape)
        
        if (!isAttached) {
            return this.calculateFreeFloatingPath(ctx)
        }
        
        return this.calculateConnectedPointPath(ctx)
    }

    /**
     * Calculate path for a free-floating connector (no shapes attached).
     */
    calculateFreeFloatingPath(ctx: PathCalculatorContext): ConnectorPoint[] {
        const { x: sx, y: sy } = ctx.startPoint
        const { x: ex, y: ey } = ctx.endPoint

        const horizontalFirst = Math.abs(ex - sx) >= Math.abs(ey - sy)
        if (horizontalFirst) {
            const midX = (sx + ex) / 2
            return [
                { ...ctx.startPoint },
                { x: midX, y: sy },
                { x: midX, y: ey },
                { ...ctx.endPoint }
            ]
        } else {
            const midY = (sy + ey) / 2
            return [
                { ...ctx.startPoint },
                { x: sx, y: midY },
                { x: ex, y: midY },
                { ...ctx.endPoint }
            ]
        }
    }

    /**
     * Calculate path for a connector with at least one connected shape.
     */
    calculateConnectedPointPath(ctx: PathCalculatorContext): ConnectorPoint[] {
        const { startDirection, endDirection, startShape, endShape } = ctx

        // Handle case where neither side is connected
        if (!startShape && !endShape) {
            return this.calculateFreeFloatingPath(ctx)
        }

        // Handle partial connections (only one side connected)
        if (!startShape || !endShape) {
            return this.calculatePartiallyConnectedPath(ctx, startShape, endShape)
        }

        // SPECIAL CASE: Both connected and facing same direction
        if (startDirection === endDirection) {
            return this.calculateSameDirectionPath(ctx, startShape, endShape, startDirection)
        }

        // General case: use candidate-based routing
        return this.calculateMixedDirectionPath(ctx, startShape, endShape)
    }

    /**
     * Handle the special case where both shapes are connected and facing the same direction.
     */
    private calculateSameDirectionPath(
        ctx: PathCalculatorContext,
        startShape: DiagramShape,
        endShape: DiagramShape,
        direction: ConnectorDirection
    ): ConnectorPoint[] {
        const startPrimary = this.createPrimaryPoint(ctx.startPoint.x, ctx.startPoint.y, direction)
        const endPrimary = this.createPrimaryPoint(ctx.endPoint.x, ctx.endPoint.y, direction)
        const startExit = this.buildOutwardExit(startPrimary, true, ctx)
        const endExit = this.buildOutwardExit(endPrimary, false, ctx)

        const startBounds = this.getShapeBoundsWithArrowhead(startShape, direction, true, ctx)
        const endBounds = this.getShapeBoundsWithArrowhead(endShape, direction, false, ctx)
        const margin = ctx.routingMargin

        const routingCtx: RoutingContext = {
            start: startPrimary,
            end: endPrimary,
            startExit,
            endExit,
            startBounds,
            endBounds,
            startArrowheadSize: ctx.startArrowheadSize,
            endArrowheadSize: ctx.endArrowheadSize,
            margin
        }

        const candidates: ConnectorPoint[][] = []
        const shapesToAvoid = [startShape, endShape]

        const isHorizontal = direction === 'left' || direction === 'right'

        if (isHorizontal) {
            // Horizontal: Detour Top / Bottom
            this.addHorizontalDetourCandidates(candidates, startPrimary, startExit, endPrimary, endExit, startBounds, endBounds, margin)
        } else {
            // Vertical: Detour Left / Right with mid-gap versions
            this.addVerticalDetourCandidates(candidates, startPrimary, startExit, endPrimary, endExit, startBounds, endBounds, margin)
        }

        // Add standard detour candidates as fallback
        candidates.push(...buildDetourCandidates(routingCtx))

        // Add simple gap candidates
        this.addSimpleGapCandidates(candidates, startPrimary, startExit, endPrimary, endExit, startBounds, endBounds, direction, margin)

        // Validate and select best path
        return this.selectBestPath(candidates, shapesToAvoid, ctx.startShapeId, ctx.endShapeId, startBounds, endBounds)
    }

    /**
     * Calculate path for mixed direction connections (general case).
     */
    private calculateMixedDirectionPath(
        ctx: PathCalculatorContext,
        startShape: DiagramShape,
        endShape: DiagramShape
    ): ConnectorPoint[] {
        const { startDirection, endDirection } = ctx

        const startPrimary = this.createPrimaryPoint(ctx.startPoint.x, ctx.startPoint.y, startDirection)
        const endPrimary = this.createPrimaryPoint(ctx.endPoint.x, ctx.endPoint.y, endDirection)
        const startExit = this.buildOutwardExit(startPrimary, true, ctx)
        const endExit = this.buildOutwardExit(endPrimary, false, ctx)

        const startBounds = this.getShapeBoundsWithArrowhead(startShape, startDirection, true, ctx)
        const endBounds = this.getShapeBoundsWithArrowhead(endShape, endDirection, false, ctx)

        const routingCtx: RoutingContext = {
            start: startPrimary,
            end: endPrimary,
            startExit,
            endExit,
            startBounds,
            endBounds,
            startArrowheadSize: ctx.startArrowheadSize,
            endArrowheadSize: ctx.endArrowheadSize,
            margin: ctx.routingMargin
        }

        const shapesToAvoid = [startShape, endShape]

        const simpleCandidates = buildSimpleCandidates(routingCtx)
        const corridorCandidates = [
            ...buildHorizontalCandidates(routingCtx),
            ...buildVerticalCandidates(routingCtx)
        ]

        const allCandidates = [...simpleCandidates, ...corridorCandidates]

        return this.selectBestPath(allCandidates, shapesToAvoid, ctx.startShapeId, ctx.endShapeId, startBounds, endBounds)
    }

    /**
     * Handle path calculation when only one side is connected to a shape.
     */
    private calculatePartiallyConnectedPath(
        ctx: PathCalculatorContext,
        startShape: DiagramShape | null,
        endShape: DiagramShape | null
    ): ConnectorPoint[] {
        const { startDirection, endDirection } = ctx
        const startConnected = !!startShape

        const startPrimary = this.createPrimaryPoint(ctx.startPoint.x, ctx.startPoint.y, startDirection)
        const endPrimary = this.createPrimaryPoint(ctx.endPoint.x, ctx.endPoint.y, endDirection)

        if (startConnected && startShape) {
            const startExit = this.buildOutwardExit(startPrimary, true, ctx)
            const startBounds = this.getShapeBoundsWithArrowhead(startShape, startDirection, true, ctx)
            return this.buildPartialConnectionPath(startPrimary, startExit, endPrimary, startDirection, startBounds, true, ctx)
        } else if (endShape) {
            const endExit = this.buildOutwardExit(endPrimary, false, ctx)
            const endBounds = this.getShapeBoundsWithArrowhead(endShape, endDirection, false, ctx)
            return this.buildPartialConnectionPath(startPrimary, endExit, endPrimary, endDirection, endBounds, false, ctx)
        }

        return this.calculateFreeFloatingPath(ctx)
    }

    /**
     * Build path for partial connection scenarios.
     * DEFAULT = Z-shape, L-shape when endpoint position allows.
     */
    private buildPartialConnectionPath(
        startPoint: ConnectorPoint,
        connectedExit: ConnectorPoint,
        endPoint: ConnectorPoint,
        connectedDirection: ConnectorDirection,
        _connectedBounds: Bounds,
        startIsConnected: boolean,
        _ctx: PathCalculatorContext
    ): ConnectorPoint[] {
        const { x: sx, y: sy } = startPoint
        const { x: ex, y: ey } = endPoint
        const exitX = connectedExit.x
        const exitY = connectedExit.y

        const dx = Math.abs(ex - sx)
        const dy = Math.abs(ey - sy)
        const isHorizontalDominant = dx > dy

        if (startIsConnected) {
            return this.buildStartConnectedPath(startPoint, endPoint, connectedDirection, sx, sy, ex, ey, exitX, exitY, isHorizontalDominant)
        } else {
            return this.buildEndConnectedPath(startPoint, endPoint, connectedDirection, sx, sy, ex, ey, exitX, exitY, isHorizontalDominant)
        }
    }

    private buildStartConnectedPath(
        startPoint: ConnectorPoint,
        endPoint: ConnectorPoint,
        connectedDirection: ConnectorDirection,
        sx: number, sy: number, ex: number, ey: number,
        exitX: number, exitY: number,
        isHorizontalDominant: boolean
    ): ConnectorPoint[] {
        switch (connectedDirection) {
            case 'bottom':
                if (ey > sy && isHorizontalDominant) {
                    return [startPoint, { x: sx, y: ey }, endPoint]
                }
                const midYBottom = Math.max(exitY, (sy + ey) / 2)
                return [startPoint, { x: sx, y: midYBottom }, { x: ex, y: midYBottom }, endPoint]

            case 'top':
                if (ey < sy && isHorizontalDominant) {
                    return [startPoint, { x: sx, y: ey }, endPoint]
                }
                const midYTop = Math.min(exitY, (sy + ey) / 2)
                return [startPoint, { x: sx, y: midYTop }, { x: ex, y: midYTop }, endPoint]

            case 'right':
                if (ex > sx && !isHorizontalDominant) {
                    return [startPoint, { x: ex, y: sy }, endPoint]
                }
                const midXRight = Math.max(exitX, (sx + ex) / 2)
                return [startPoint, { x: midXRight, y: sy }, { x: midXRight, y: ey }, endPoint]

            case 'left':
                if (ex < sx && !isHorizontalDominant) {
                    return [startPoint, { x: ex, y: sy }, endPoint]
                }
                const midXLeft = Math.min(exitX, (sx + ex) / 2)
                return [startPoint, { x: midXLeft, y: sy }, { x: midXLeft, y: ey }, endPoint]

            default:
                return [startPoint, { x: sx, y: exitY }, { x: ex, y: exitY }, endPoint]
        }
    }

    private buildEndConnectedPath(
        startPoint: ConnectorPoint,
        endPoint: ConnectorPoint,
        connectedDirection: ConnectorDirection,
        sx: number, sy: number, ex: number, ey: number,
        exitX: number, exitY: number,
        _isHorizontalDominant: boolean
    ): ConnectorPoint[] {
        // The path must approach the end point perpendicular to the connected edge
        // For 'left'/'right' connections: final segment must be horizontal
        // For 'top'/'bottom' connections: final segment must be vertical

        switch (connectedDirection) {
            case 'bottom':
                // End connected to bottom edge: path must approach from BELOW (going up)
                // Final segment is vertical, going up into the shape
                if (sy > ey) {
                // Start is below end - simple L-shape
                    return [startPoint, { x: ex, y: sy }, endPoint]
                }
                // Start is above end - need to go down, around, then up
                const bottomExitY = Math.max(exitY, ey + GRID_SPACING * 2)
                return [startPoint, { x: sx, y: bottomExitY }, { x: ex, y: bottomExitY }, endPoint]

            case 'top':
                // End connected to top edge: path must approach from ABOVE (going down)
                // Final segment is vertical, going down into the shape
                if (sy < ey) {
                // Start is above end - simple L-shape
                    return [startPoint, { x: ex, y: sy }, endPoint]
                }
                // Start is below end - need to go up, around, then down
                const topExitY = Math.min(exitY, ey - GRID_SPACING * 2)
                return [startPoint, { x: sx, y: topExitY }, { x: ex, y: topExitY }, endPoint]

            case 'left':
                // End connected to left edge: path must approach from LEFT (going right)
                // Final segment is horizontal, going right into the shape
                if (sx < ex) {
                // Start is to the left of end - simple L-shape
                    return [startPoint, { x: sx, y: ey }, endPoint]
                }
                // Start is to the right of end - need to go left, around, then right
                const leftExitX = Math.min(exitX, ex - GRID_SPACING * 2)
                return [startPoint, { x: leftExitX, y: sy }, { x: leftExitX, y: ey }, endPoint]

            case 'right':
                // End connected to right edge: path must approach from RIGHT (going left)
                // Final segment is horizontal, going left into the shape
                if (sx > ex) {
                // Start is to the right of end - simple L-shape
                    return [startPoint, { x: sx, y: ey }, endPoint]
                }
                // Start is to the left of end - need to go right, around, then left
                const rightExitX = Math.max(exitX, ex + GRID_SPACING * 2)
                return [startPoint, { x: rightExitX, y: sy }, { x: rightExitX, y: ey }, endPoint]

            default:
                return [startPoint, { x: ex, y: sy }, { x: ex, y: exitY }, endPoint]
        }
    }

    // ============ Helper Methods ============

    createPrimaryPoint(x: number, y: number, direction: Direction): ConnectorPoint {
        return { x, y, direction, fixedX: true, fixedY: true }
    }

    buildOutwardExit(point: ConnectorPoint, isStart: boolean, ctx: PathCalculatorContext): ConnectorPoint {
        const dir = point.direction
        if (!dir) return { ...point }

        const exitOffset = ctx.exitOffset
        const arrowheadSize = isStart ? ctx.startArrowheadSize : ctx.endArrowheadSize
        const totalOffset = exitOffset + arrowheadSize

        switch (dir) {
            case 'left': return { x: point.x - totalOffset, y: point.y }
            case 'right': return { x: point.x + totalOffset, y: point.y }
            case 'top': return { x: point.x, y: point.y - totalOffset }
            case 'bottom': return { x: point.x, y: point.y + totalOffset }
            default: return { x: point.x, y: point.y + totalOffset }
        }
    }

    getShapeBoundsWithArrowhead(
        shape: DiagramShape,
        direction: Direction,
        isStart: boolean,
        ctx: PathCalculatorContext
    ): Bounds {
        const baseBounds = getShapeBounds(shape)
        const arrowheadSize = isStart ? ctx.startArrowheadSize : ctx.endArrowheadSize

        if (arrowheadSize === 0) return baseBounds

        const halfHeight = arrowheadSize / 2

        switch (direction) {
            case 'top':
                return {
                    left: baseBounds.left - halfHeight,
                    right: baseBounds.right + halfHeight,
                    top: baseBounds.top - arrowheadSize,
                    bottom: baseBounds.bottom
                }
            case 'bottom':
                return {
                    left: baseBounds.left - halfHeight,
                    right: baseBounds.right + halfHeight,
                    top: baseBounds.top,
                    bottom: baseBounds.bottom + arrowheadSize
                }
            case 'left':
                return {
                    left: baseBounds.left - arrowheadSize,
                    right: baseBounds.right,
                    top: baseBounds.top - halfHeight,
                    bottom: baseBounds.bottom + halfHeight
                }
            case 'right':
                return {
                    left: baseBounds.left,
                    right: baseBounds.right + arrowheadSize,
                    top: baseBounds.top - halfHeight,
                    bottom: baseBounds.bottom + halfHeight
                }
            default:
                return baseBounds
        }
    }

    buildFallbackPath(
        start: ConnectorPoint,
        startExit: ConnectorPoint,
        endExit: ConnectorPoint,
        end: ConnectorPoint
    ): ConnectorPoint[] {
        const delta = GRID_SPACING * 4
        const dir = start.direction

        if (dir === 'left' || dir === 'right') {
            const multiplier = dir === 'left' ? -1 : 1
            const fallbackX = startExit.x + delta * multiplier
            return [
                start,
                startExit,
                { x: fallbackX, y: startExit.y },
                { x: fallbackX, y: endExit.y },
                endExit,
                end
            ]
        }

        const verticalMultiplier = dir === 'top' ? -1 : 1
        const fallbackY = startExit.y + delta * verticalMultiplier
        return [
            start,
            startExit,
            { x: startExit.x, y: fallbackY },
            { x: endExit.x, y: fallbackY },
            endExit,
            end
        ]
    }

    getGapMidpoints(b1: Bounds, b2: Bounds): { midX: number | null; midY: number | null } {
        let midX: number | null = null
        let midY: number | null = null

        if (b1.right < b2.left) midX = (b1.right + b2.left) / 2
        else if (b2.right < b1.left) midX = (b2.right + b1.left) / 2

        if (b1.bottom < b2.top) midY = (b1.bottom + b2.top) / 2
        else if (b2.bottom < b1.top) midY = (b2.bottom + b1.top) / 2

        return { midX, midY }
    }

    getSymmetryBonus(path: ConnectorPoint[], midX: number | null, midY: number | null): number {
        const SYMMETRY_BONUS = GRID_SPACING * 2.5
        const eps = 1

        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i]
            const b = path[i + 1]

            if (midX !== null && Math.abs(a.x - b.x) < eps && Math.abs(a.x - midX) < eps) {
                return SYMMETRY_BONUS
            }

            if (midY !== null && Math.abs(a.y - b.y) < eps && Math.abs(a.y - midY) < eps) {
                return SYMMETRY_BONUS
            }
        }

        return 0
    }

    // ============ Candidate Generation Helpers ============

    private addHorizontalDetourCandidates(
        candidates: ConnectorPoint[][],
        startPrimary: ConnectorPoint,
        startExit: ConnectorPoint,
        endPrimary: ConnectorPoint,
        endExit: ConnectorPoint,
        startBounds: Bounds,
        endBounds: Bounds,
        margin: number
    ): void {
        const topStart = startBounds.top - margin
        const topEnd = endBounds.top - margin
        const bottomStart = startBounds.bottom + margin
        const bottomEnd = endBounds.bottom + margin

        // Top detours
        candidates.push([
            startPrimary, startExit,
            { x: startExit.x, y: topStart }, { x: endExit.x, y: topStart },
            endExit, endPrimary
        ])
        candidates.push([
            startPrimary, startExit,
            { x: startExit.x, y: topEnd }, { x: endExit.x, y: topEnd },
            endExit, endPrimary
        ])

        // Bottom detours
        candidates.push([
            startPrimary, startExit,
            { x: startExit.x, y: bottomStart }, { x: endExit.x, y: bottomStart },
            endExit, endPrimary
        ])
        candidates.push([
            startPrimary, startExit,
            { x: startExit.x, y: bottomEnd }, { x: endExit.x, y: bottomEnd },
            endExit, endPrimary
        ])
    }

    private addVerticalDetourCandidates(
        candidates: ConnectorPoint[][],
        startPrimary: ConnectorPoint,
        startExit: ConnectorPoint,
        endPrimary: ConnectorPoint,
        endExit: ConnectorPoint,
        startBounds: Bounds,
        endBounds: Bounds,
        margin: number
    ): void {
        const leftStart = startBounds.left - margin
        const leftEnd = endBounds.left - margin
        const rightStart = startBounds.right + margin
        const rightEnd = endBounds.right + margin

        const hasVerticalGap = startBounds.bottom < endBounds.top || endBounds.bottom < startBounds.top
        let midY: number | null = null
        if (hasVerticalGap) {
            midY = startBounds.bottom < endBounds.top
                ? (startBounds.bottom + endBounds.top) / 2
                : (endBounds.bottom + startBounds.top) / 2
        }

        const addCandidates = (detourX: number) => {
            if (midY !== null) {
                // Mid-gap step versions
                candidates.push([
                    startPrimary, startExit,
                    { x: startExit.x, y: midY },
                    { x: detourX, y: midY },
                    { x: detourX, y: endExit.y },
                    endExit, endPrimary
                ])
                candidates.push([
                    startPrimary, startExit,
                    { x: detourX, y: startExit.y },
                    { x: detourX, y: midY },
                    { x: endExit.x, y: midY },
                    endExit, endPrimary
                ])
            }

            // Standard hugging version
            candidates.push([
                startPrimary, startExit,
                { x: detourX, y: startExit.y },
                { x: detourX, y: endExit.y },
                endExit, endPrimary
            ])
        }

        addCandidates(leftStart)
        addCandidates(leftEnd)
        addCandidates(rightStart)
        addCandidates(rightEnd)
    }

    private addSimpleGapCandidates(
        candidates: ConnectorPoint[][],
        startPrimary: ConnectorPoint,
        startExit: ConnectorPoint,
        endPrimary: ConnectorPoint,
        endExit: ConnectorPoint,
        startBounds: Bounds,
        endBounds: Bounds,
        direction: ConnectorDirection,
        _margin: number
    ): void {
        const isHorizontal = direction === 'left' || direction === 'right'

        if (isHorizontal) {
            const corridorX = direction === 'left'
                ? Math.min(startExit.x, endExit.x)
                : Math.max(startExit.x, endExit.x)

            const hasVerticalGap = startBounds.bottom < endBounds.top || endBounds.bottom < startBounds.top

            if (hasVerticalGap) {
                const corridorY = startBounds.bottom < endBounds.top
                    ? (startBounds.bottom + endBounds.top) / 2
                    : (endBounds.bottom + startBounds.top) / 2

                candidates.push([
                    startPrimary, startExit,
                    { x: corridorX, y: startExit.y },
                    { x: corridorX, y: corridorY },
                    { x: corridorX, y: endExit.y },
                    endExit, endPrimary
                ])
            }

            candidates.push([
                startPrimary, startExit,
                { x: corridorX, y: startExit.y },
                { x: corridorX, y: endExit.y },
                endExit, endPrimary
            ])
        } else {
            const corridorY = direction === 'top'
                ? Math.min(startExit.y, endExit.y)
                : Math.max(startExit.y, endExit.y)

            const hasHorizontalGap = startBounds.right < endBounds.left || endBounds.right < startBounds.left

            if (hasHorizontalGap) {
                const corridorX = startBounds.right < endBounds.left
                    ? (startBounds.right + endBounds.left) / 2
                    : (endBounds.right + startBounds.left) / 2

                candidates.push([
                    startPrimary, startExit,
                    { x: startExit.x, y: corridorY },
                    { x: corridorX, y: corridorY },
                    { x: endExit.x, y: corridorY },
                    endExit, endPrimary
                ])
            }

            candidates.push([
                startPrimary, startExit,
                { x: startExit.x, y: corridorY },
                { x: endExit.x, y: corridorY },
                endExit, endPrimary
            ])
        }
    }

    private selectBestPath(
        candidates: ConnectorPoint[][],
        shapesToAvoid: DiagramShape[],
        startShapeId: string | null,
        endShapeId: string | null,
        startBounds: Bounds,
        endBounds: Bounds
    ): ConnectorPoint[] {
        const validPaths = candidates.filter(path =>
            isPathValid(path, shapesToAvoid, startShapeId, endShapeId)
        )

        if (validPaths.length === 0) {
            return candidates[0] || []
        }

        const { midX, midY } = this.getGapMidpoints(startBounds, endBounds)
        const SIMPLE_L_PATH_BONUS = GRID_SPACING * 10

        validPaths.sort((a, b) => {
            const baseScoreA = scorePath(a)
            const baseScoreB = scorePath(b)

            const simplicityA = a.length === 3 ? SIMPLE_L_PATH_BONUS : 0
            const simplicityB = b.length === 3 ? SIMPLE_L_PATH_BONUS : 0

            const symmetryA = this.getSymmetryBonus(a, midX, midY)
            const symmetryB = this.getSymmetryBonus(b, midX, midY)

            const adjustedA = baseScoreA - simplicityA - symmetryA
            const adjustedB = baseScoreB - simplicityB - symmetryB

            return adjustedA - adjustedB
        })

        return validPaths[0]
    }
}

// Export singleton instance for convenience
export const pathCalculator = new PathCalculator()
