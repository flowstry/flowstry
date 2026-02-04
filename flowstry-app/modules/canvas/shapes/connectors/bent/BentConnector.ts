/**
 * BentConnector - Orthogonal connector with right-angle bends.
 * 
 * This is the main class that coordinates:
 * - PathCalculator: Dynamic path calculation
 * - SegmentManager: Segment-centric path operations
 * - Drawing: Rendering with rounded corners and arrowheads
 */

import { GRID_SPACING } from '../../../consts/canvas'
import { DiagramShape } from '../../base'
import { ArrowheadManager } from '../arrowheads/ArrowheadManager'
import { ArrowheadType, ConnectorDirection, ConnectorPoint, ConnectorShape, ConnectorType } from '../base'
import { pathCalculator, PathCalculatorContext } from './routing/pathCalculator'
import { cleanupSegments } from './segment/geometry'
import { segmentManager } from './segment/segmentManager'
import { cloneSegments } from './segment/types'

export class BentConnector extends ConnectorShape {
    readonly connectorType: ConnectorType = 'bent'

    private readonly cornerRadius = GRID_SPACING * 1.2
    
    // User-modified path flag: when true, path uses segment constraints instead of dynamic routing
    hasUserModifiedPath: boolean = false

    // Calculated marker angles (cached during buildPathFromPoints)
    private startMarkerAngle: number | null = null
    private endMarkerAngle: number | null = null

    // Override to use ArrowheadManager
    protected getArrowheadSize(arrowheadType: ArrowheadType): number {
        return ArrowheadManager.getArrowheadSize(arrowheadType, this.appearance.strokeWidth)
    }

    private getExitOffset(): number {
        return GRID_SPACING * 2
    }

    public getRoutingMargin(): number {
        const baseMargin = this.getExitOffset()
        const startArrowheadSize = this.startArrowheadType !== 'none'
            ? this.getArrowheadSize(this.startArrowheadType)
            : 0
        const endArrowheadSize = this.endArrowheadType !== 'none'
            ? this.getArrowheadSize(this.endArrowheadType)
            : 0
        const arrowheadMargin = Math.max(startArrowheadSize, endArrowheadSize)
        return baseMargin + arrowheadMargin
    }

    /**
     * Determine if a segment handle should be shown for a given segment.
     */
    public shouldShowSegmentHandle(segmentIndex: number): boolean {
        if (segmentIndex < 0 || segmentIndex >= this.pointsBent.length - 1) return false

        const start = this.pointsBent[segmentIndex]
        const end = this.pointsBent[segmentIndex + 1]
        const length = Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
        const margin = this.getRoutingMargin()

        // For start/end segments, only show handle if significantly longer than avoidance gap
        // This prevents manipulating short avoidance stubs
        // Strict check ONLY applies if connected to a shape
        if (segmentIndex === 0 && this.startShapeId) {
            return length > 1.5 * margin
        }

        if (segmentIndex === this.pointsBent.length - 2 && this.endShapeId) {
            return length > 1.5 * margin
        }

        return length > margin
    }

    // ============ Path Update Methods ============

    updatePath(): void {
        // Manual mode: segments are the source of truth, just sync points
        if (this.routingMode === 'manual' && this.segments.length > 0) {
            this.pointsBent = segmentManager.segmentsToPoints(this.segments)
            return
        }

        // Auto mode: router calculates path, then we derive segments
        const rawPoints = pathCalculator.calculatePath(this.createPathContext())
        this.pointsBent = this.simplifyPath(rawPoints)
        this.segments = segmentManager.routerOutputToSegments(this.pointsBent)
    }

    private createPathContext(): PathCalculatorContext {
        const { startDirection, endDirection } = this.getSegmentDirections()
        const startShape = this.getAttachedShape(this.startShapeId)
        const endShape = this.getAttachedShape(this.endShapeId)

        const startArrowheadSize = this.startArrowheadType !== 'none'
            ? this.getArrowheadSize(this.startArrowheadType) : 0
        const endArrowheadSize = this.endArrowheadType !== 'none'
            ? this.getArrowheadSize(this.endArrowheadType) : 0

        return {
            startPoint: this.startPoint,
            endPoint: this.endPoint,
            // Default to 'right' if no direction specified
            startDirection: startDirection || 'right',
            endDirection: endDirection || 'left',
            startShape,
            endShape,
            startShapeId: this.startShapeId,
            endShapeId: this.endShapeId,
            startArrowheadType: this.startArrowheadType,
            endArrowheadType: this.endArrowheadType,
            startArrowheadSize,
            endArrowheadSize,
            routingMargin: this.getRoutingMargin(),
            exitOffset: this.getExitOffset()
        }
    }



    // ============ Segment Drag Methods ============

    // Interaction state for active segment drag
    private interactionState: import('./segment/types').InteractionState | null = null

    // Segments from the new segment-centric model
    segments: import('./segment/types').Segment[] = []

    // Routing mode from the new model  
    routingMode: import('./segment/types').RoutingMode = 'auto'

    // Pending avoidance state - used during endpoint drag preview
    // Stores original segments so we can revert if user moves away from shape
    private pendingAvoidanceState: {
        originalSegments: import('./segment/types').Segment[]
        whichEnd: 'start' | 'end'
    } | null = null

    /**
     * Begin a segment interaction (on pointer-down).
     * Returns the actual segment index to drag (may differ if escape segment was inserted).
     */
    beginSegmentInteraction(
        type: import('./segment/types').InteractionType,
        segmentIndex: number,
        pointer: { x: number; y: number }
    ): number {
        // Initialize segments from points if not already done
        if (this.segments.length === 0 && this.pointsBent.length >= 2) {
            const init = segmentManager.initializeFromPoints(this.pointsBent, this.hasUserModifiedPath)
            this.segments = init.segments
            this.routingMode = init.routingMode
        }

        const { startDirection, endDirection } = this.getSegmentDirections()
        const ctx = {
            segments: this.segments,
            routingMode: this.routingMode,
            startDirection,
            endDirection,
            hasStartShape: !!this.startShapeId,
            hasEndShape: !!this.endShapeId,
            routingMargin: this.getRoutingMargin()
        }

        const result = segmentManager.beginInteraction(ctx, type, segmentIndex, pointer)

        this.segments = result.segments
        this.routingMode = result.routingMode
        this.interactionState = result.interactionState
        this.hasUserModifiedPath = true

        // Sync points from segments
        this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        this.state.needsRender = true

        return this.interactionState?.insertedSegmentIndex ?? segmentIndex
    }

    /**
     * Update an active segment interaction (during drag).
     */
    updateSegmentInteraction(pointer: { x: number; y: number }): void {
        if (!this.interactionState) return

        this.segments = segmentManager.updateInteraction(
            this.segments,
            this.interactionState,
            pointer
        )

        // Sync points from segments
        this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        this.state.needsRender = true
    }

    /**
     * End an active segment interaction (on pointer-up).
     */
    endSegmentInteraction(): void {
        const { startDirection, endDirection } = this.getSegmentDirections()

        this.segments = segmentManager.endInteraction(
            this.segments,
            this.interactionState,
            startDirection,
            endDirection,
            this.getRoutingMargin()
        )

        this.interactionState = null

        // Sync points from segments
        this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        this.state.needsRender = true
    }

    /**
     * Reset the connector to auto routing mode.
     * Clears all manual segment modifications and recalculates the path dynamically.
     */
    resetToAutoRouting(): void {
        this.routingMode = 'auto'
        this.hasUserModifiedPath = false
        this.segments = []
        this.interactionState = null

        // Recalculate path using auto routing
        this.updatePath()
        this.state.needsRender = true
    }

    /**
     * Check if currently in an active interaction.
     */
    isInInteraction(): boolean {
        return this.interactionState !== null
    }

    // ============ Pending Avoidance Methods ============
    // These methods support deferred finalization of avoidance segments during endpoint drag.
    // Avoidance is previewed during drag but only finalized on pointer up.

    /**
     * Begin pending avoidance mode - saves current segments for potential rollback.
     * Call this at the start of an endpoint drag.
     */
    beginPendingAvoidance(whichEnd: 'start' | 'end'): void {
        if (this.routingMode !== 'manual' || this.segments.length === 0) return

        this.pendingAvoidanceState = {
            originalSegments: cloneSegments(this.segments),
            whichEnd
        }
    }

    /**
     * Apply avoidance segments for preview during drag.
     * This modifies segments but can be reverted by calling revertPendingAvoidance().
     * @param position The new endpoint position
     * @param direction The connection direction (null if not over a shape)
     */
    applyPendingAvoidance(
        position: { x: number; y: number },
        direction: ConnectorDirection | null
    ): void {
        if (!this.pendingAvoidanceState) return

        const { whichEnd, originalSegments } = this.pendingAvoidanceState

        // Start from original segments to avoid accumulating changes
        this.segments = cloneSegments(originalSegments)

        // Update the endpoint
        if (whichEnd === 'start') {
            this.startPoint = position
        } else {
            this.endPoint = position
        }

        // Apply the position update (which may add avoidance segments)
        this.segments = segmentManager.handleShapeMove(
            this.segments,
            whichEnd,
            position,
            direction,
            this.getRoutingMargin()
        )
        this.segments = cleanupSegments(this.segments)

        this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        this.state.needsRender = true
    }

    /**
     * Revert to original segments (user moved away from shape during drag).
     * Also updates the endpoint position without applying avoidance.
     * @param position The new endpoint position (in empty space)
     */
    revertPendingAvoidance(position: { x: number; y: number }): void {
        if (!this.pendingAvoidanceState) return

        const { whichEnd, originalSegments } = this.pendingAvoidanceState

        // Restore original segments
        this.segments = cloneSegments(originalSegments)

        // Update the endpoint position
        if (whichEnd === 'start') {
            this.startPoint = position
        } else {
            this.endPoint = position
        }

        // Update segments for the new position WITHOUT avoidance (direction = null)
        this.segments = segmentManager.handleShapeMove(
            this.segments,
            whichEnd,
            position,
            null, // No direction = no avoidance
            this.getRoutingMargin()
        )
        this.segments = cleanupSegments(this.segments)

        this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        this.state.needsRender = true
    }

    /**
     * Finalize avoidance - keeps current segments and clears pending state.
     * Call this on pointer up when the endpoint is released on a shape.
     */
    finalizePendingAvoidance(): void {
        this.pendingAvoidanceState = null
        // Current segments are already applied, nothing else needed
    }

    /**
     * Check if in pending avoidance mode.
     */
    isInPendingAvoidance(): boolean {
        return this.pendingAvoidanceState !== null
    }

    /**
     * Get connector directions for start/end.
     * Uses stored direction from main connector point, or dynamically calculates from edge side.
     */
    private getSegmentDirections(): { startDirection: import('../base').ConnectorDirection | null, endDirection: import('../base').ConnectorDirection | null } {
        // Get start direction
        // Only use stored startConnectorPoint (main connector point) - always recalculate for edge connections
        let startDirection: import('../base').ConnectorDirection | null = this.startConnectorPoint
        if (!startDirection && this.startShapeId) {
            // For edge connections, always calculate from edge side (don't use stale stored value)
            const startShape = this.getAttachedShape(this.startShapeId)
            if (startShape) {
                startDirection = startShape.connectionPoints.getEdgeSide(this.startPoint)
            }
        }

        // Get end direction
        // Only use stored endConnectorPoint (main connector point) - always recalculate for edge connections
        let endDirection: import('../base').ConnectorDirection | null = this.endConnectorPoint
        if (!endDirection && this.endShapeId) {
            // For edge connections, always calculate from edge side (don't use stale stored value)
            const endShape = this.getAttachedShape(this.endShapeId)
            if (endShape) {
                endDirection = endShape.connectionPoints.getEdgeSide(this.endPoint)
            }
        }

        return { startDirection, endDirection }
    }


    // ============ Start/End Point Override Methods ============

    override setStartPoint(x: number, y: number): void {
        this.startPoint = { x, y }

        // Use new API to propagate change to segments
        if (this.routingMode === 'manual' && this.segments.length > 0) {
            const { startDirection } = this.getSegmentDirections()
            this.segments = segmentManager.handleShapeMove(
                this.segments,
                'start',
                { x, y },
                startDirection,
                this.getRoutingMargin()
            )
            this.segments = cleanupSegments(this.segments)
            this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        }

        this.state.needsRender = true
    }

    override setEndPoint(x: number, y: number): void {
        this.endPoint = { x, y }

        // Use new API to propagate change to segments  
        if (this.routingMode === 'manual' && this.segments.length > 0) {
            const { endDirection } = this.getSegmentDirections()
            this.segments = segmentManager.handleShapeMove(
                this.segments,
                'end',
                { x, y },
                endDirection,
                this.getRoutingMargin()
            )
            this.segments = cleanupSegments(this.segments)
            this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        }

        this.state.needsRender = true
    }

    /**
     * Override updateConnectorPoints to propagate changes to segments in manual mode.
     * The base class only updates startPoint/endPoint properties directly,
     * but manual bent connectors need to also update segments.
     */
    override updateConnectorPoints(dx?: number, dy?: number, updateEnd: 'start' | 'end' | 'both' = 'both'): void {
        // Store old positions to detect changes
        const oldStartPoint = { ...this.startPoint }
        const oldEndPoint = { ...this.endPoint }

        // Call parent to update startPoint/endPoint
        super.updateConnectorPoints(dx, dy, updateEnd)

        // In manual mode, propagate changes to segments
        if (this.routingMode === 'manual' && this.segments.length > 0) {
            // Check if start point changed
            if ((updateEnd === 'start' || updateEnd === 'both') &&
                (this.startPoint.x !== oldStartPoint.x || this.startPoint.y !== oldStartPoint.y)) {
                const { startDirection } = this.getSegmentDirections()
                this.segments = segmentManager.handleShapeMove(
                    this.segments,
                    'start',
                    this.startPoint,
                    startDirection,
                    this.getRoutingMargin()
                )
            }

            // Check if end point changed
            if ((updateEnd === 'end' || updateEnd === 'both') &&
                (this.endPoint.x !== oldEndPoint.x || this.endPoint.y !== oldEndPoint.y)) {
                const { endDirection } = this.getSegmentDirections()
                this.segments = segmentManager.handleShapeMove(
                    this.segments,
                    'end',
                    this.endPoint,
                    endDirection,
                    this.getRoutingMargin()
                )
            }

            // Cleanup segments after updates
            this.segments = cleanupSegments(this.segments)
            this.pointsBent = segmentManager.segmentsToPoints(this.segments)
        }
    }

    // ============ Helper Methods ============

    private getAttachedShape(id: string | null): DiagramShape | null {
        if (!id) return null
        return this.getShapeById(id)
    }

    // ============ Rendering/Drawing Logic ============



    protected addArrowheadOffset(point: { x: number; y: number }, isStart: boolean): { x: number; y: number } {
        const arrowheadType = isStart ? this.startArrowheadType : this.endArrowheadType
        if (arrowheadType === 'none') return point

        const points = this.pointsBent
        const pointIndex = isStart ? 0 : points.length - 1
        const adjacentIndex = isStart ? 1 : points.length - 2

        if (adjacentIndex < 0 || adjacentIndex >= points.length) return point

        const curr = points[pointIndex]
        const adj = points[adjacentIndex]

        const dx = adj.x - curr.x
        const dy = adj.y - curr.y

        const direction = this.vectorToDirection(dx, dy)
        if (!direction) return point

        const arrowheadSize = this.getArrowheadSize(arrowheadType)
        return this.offsetPointByDirection(point, direction, arrowheadSize)
    }

    private vectorToDirection(dx: number, dy: number): ConnectorDirection | null {
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left'
        }
        return dy > 0 ? 'bottom' : 'top'
    }

    /**
     * Calculate arrowhead direction from path segments.
     */
    getMarkerOrientAngle(isStart: boolean): number {
        if (isStart && this.startMarkerAngle !== null) return this.startMarkerAngle
        if (!isStart && this.endMarkerAngle !== null) return this.endMarkerAngle

        // Fallback to standard logic if no diagonal angle calculated
        const points = this.pointsBent

        if (!points || points.length < 2) {
            return isStart ? 180 : 0
        }

        const sourceIndex = isStart ? 0 : points.length - 1
        const neighborIndex = isStart ? 1 : points.length - 2

        let dx = points[neighborIndex].x - points[sourceIndex].x
        let dy = points[neighborIndex].y - points[sourceIndex].y

        // Walk along path if segment is zero-length
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            const walkDirection = isStart ? 1 : -1
            let currentIdx = neighborIndex

            while (currentIdx >= 0 && currentIdx < points.length) {
                dx = points[currentIdx].x - points[sourceIndex].x
                dy = points[currentIdx].y - points[sourceIndex].y

                if (Math.abs(dx) >= 0.1 || Math.abs(dy) >= 0.1) break
                currentIdx += walkDirection
            }

            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
                return isStart ? 180 : 0
            }
        }

        let pathDirection: 'top' | 'bottom' | 'left' | 'right'
        if (Math.abs(dx) > Math.abs(dy)) {
            pathDirection = dx > 0 ? 'right' : 'left'
        } else {
            pathDirection = dy > 0 ? 'bottom' : 'top'
        }

        // Arrow always points OPPOSITE to the path direction at this endpoint
        // This means it points TOWARD the connected shape
        // If path direction is 'right' (going right), arrow points left (toward shape)
        switch (pathDirection) {
            case 'top': return 90    // path goes up, arrow points down
            case 'bottom': return 270  // path goes down, arrow points up
            case 'left': return 0   // path goes left, arrow points right
            case 'right': return 180    // path goes right, arrow points left
        }
    }

    protected buildPathFromPoints(): string {
        // Reset angles
        this.startMarkerAngle = null
        this.endMarkerAngle = null

        const points = this.pointsBent
        if (points.length < 2) return ''

        // Create a working copy of points for rendering
        // We will modify this array (potentially removing points for diagonals)
        const renderPoints = points.map(p => ({ ...p }))

        // Calculate gap offset based on actual path direction
        const gapOffset = GRID_SPACING * 0.5

        // --- Apply Gap and Arrowhead to START ---
        if (this.startShapeId && points.length >= 2) {
            // Apply gap offset to the first point
            const dx = points[1].x - points[0].x
            const dy = points[1].y - points[0].y
            if (Math.abs(dx) > Math.abs(dy)) {
                renderPoints[0].x += dx > 0 ? gapOffset : -gapOffset
            } else {
                renderPoints[0].y += dy > 0 ? gapOffset : -gapOffset
            }
        }

        // Save the "Tip" position for the Arrowhead (before any shortening)
        const startTip = { ...renderPoints[0] }
        this.pathStart = startTip

        // Apply Start Arrowhead Logic
        const startType = this.startArrowheadType
        const startSize = this.getArrowheadSize(startType)

        if (startType !== 'none') {
            let handled = false
            // Check for diagonal case (requires at least 3 points: Start, Corner, Next)
            if (renderPoints.length >= 3) {
                const target = renderPoints[0]
                const corner = renderPoints[1]
                const next = renderPoints[2]

                const dx = corner.x - target.x
                const dy = corner.y - target.y
                const L = Math.sqrt(dx * dx + dy * dy)

                if (L < startSize) {
                    // Diagonal Cut needed!
                    const vX = next.x - corner.x
                    const vY = next.y - corner.y
                    const vLen = Math.sqrt(vX * vX + vY * vY)

                    if (vLen > 0.001) {
                        const distFromCorner = Math.sqrt(Math.abs(startSize * startSize - L * L))
                        const moveX = (vX / vLen) * distFromCorner
                        const moveY = (vY / vLen) * distFromCorner

                        const newStart = {
                            x: corner.x + moveX,
                            y: corner.y + moveY
                        }

                        // Calculate angle: NewPoint -> Target
                        this.startMarkerAngle = Math.atan2(target.y - newStart.y, target.x - newStart.x) * (180 / Math.PI)

                        // MODIFY PATH: Remove Start and Corner, insert NewStart
                        renderPoints.splice(0, 2, newStart)
                        handled = true
                    }
                }
            }

            if (!handled) {
                // Orthodox retraction
                renderPoints[0] = this.addArrowheadOffset(renderPoints[0], true)
                // this.startMarkerAngle remains null -> standard
            }
        }


        // --- Apply Gap and Arrowhead to END ---
        const lastIdx = renderPoints.length - 1
        if (this.endShapeId && points.length >= 2) { // Use original points length check to be safe? 
            // Actually check renderPoints length, but we must be careful if start logic reduced it to < 2
            if (renderPoints.length >= 2) {
                // Re-calculate last segment vector from current renderPoints
                // Note: If start logic merged points, renderPoints[0] is the new start.
                // We need the direction of the LAST segment.
                const pLast = renderPoints[lastIdx]
                const pPrev = renderPoints[lastIdx - 1]

                const dx = pLast.x - pPrev.x
                const dy = pLast.y - pPrev.y

                if (Math.abs(dx) > Math.abs(dy)) {
                     renderPoints[lastIdx].x += dx > 0 ? -gapOffset : gapOffset
                 } else {
                     renderPoints[lastIdx].y += dy > 0 ? -gapOffset : gapOffset
                 }
             }
        }

        // Save the "Tip" position for the Arrowhead
        const endTip = { ...renderPoints[lastIdx] }
        this.pathEnd = endTip

        // Apply End Arrowhead Logic
        const endType = this.endArrowheadType
        const endSize = this.getArrowheadSize(endType)

        if (endType !== 'none' && renderPoints.length >= 2) {
            let handled = false
            // Check for diagonal case
            // Must have: Prev, Corner, Target
            // We need 3 points. renderPoints might have changed.
            if (renderPoints.length >= 3) {
                const target = renderPoints[lastIdx]
                const corner = renderPoints[lastIdx - 1]
                const prev = renderPoints[lastIdx - 2]

                const dx = corner.x - target.x
                const dy = corner.y - target.y
                const L = Math.sqrt(dx * dx + dy * dy)

                if (L < endSize) {
                    // Diagonal Cut
                    const vX = prev.x - corner.x
                    const vY = prev.y - corner.y
                    const vLen = Math.sqrt(vX * vX + vY * vY)

                    if (vLen > 0.001) {
                        const distFromCorner = Math.sqrt(Math.abs(endSize * endSize - L * L))
                        const moveX = (vX / vLen) * distFromCorner
                        const moveY = (vY / vLen) * distFromCorner

                         const newEnd = {
                             x: corner.x + moveX,
                             y: corner.y + moveY
                         }

                         // Calculate angle: NewPoint -> Target
                         this.endMarkerAngle = Math.atan2(target.y - newEnd.y, target.x - newEnd.x) * (180 / Math.PI)

                         // MODIFY PATH: Remove Corner and Target, insert NewEnd
                         renderPoints.splice(lastIdx - 1, 2, newEnd)
                         handled = true
                     }
                }
            }

            if (!handled) {
                renderPoints[renderPoints.length - 1] = this.addArrowheadOffset(renderPoints[renderPoints.length - 1], false)
            }
        }


        // --- Generate Path String from renderPoints ---
        if (renderPoints.length === 0) return '' // Should not happen

        const minVisibleRadius = GRID_SPACING * 0.2
        let d = `M ${renderPoints[0].x} ${renderPoints[0].y}`
        let currentPoint = { ...renderPoints[0] }

        for (let i = 1; i < renderPoints.length; i++) {
            const curr = renderPoints[i]
            const next = renderPoints[i + 1]

            if (!next) {
                // Final segment
                d += ` L ${curr.x} ${curr.y}`
                continue
            }
            // Normal corner rendering logic follows...
            // Note: Since we spliced the array, "curr" might be a diagonal point.
            // If we did a diagonal cut, the segment (Prev -> NewPoint) is collinear with (Prev -> Corner).
            // So logic should handle it fine.
            // But wait, "isCorner" check:
            const entryVec = { x: curr.x - currentPoint.x, y: curr.y - currentPoint.y }
            const exitVec = { x: next.x - curr.x, y: next.y - curr.y }

            const eps = 0.1
            const entryAxisAligned = this.isAxisAligned(entryVec, eps)
            const exitAxisAligned = this.isAxisAligned(exitVec, eps)
            const isCorner = entryAxisAligned && exitAxisAligned && !this.areVectorsCollinear(entryVec, exitVec, eps)

            if (!isCorner) {
                d += ` L ${curr.x} ${curr.y}`
                currentPoint = { ...curr }
                continue
            }

            // Standard Corner Rendering
            // ... (keep existing corner logic) ...
            const entryLength = this.segmentLength(entryVec)
            const exitLength = this.segmentLength(exitVec)

            // Note: with renderPoints, 'isLastCorner' check logic needs to be robust
            // logic below uses 'next' check which is fine.
            // But 'visualExitVec' logic in original used lastPoint.
            // We can simplify and just use standard radius logic for now.

            const radius = this.computeCornerRadius(entryLength, exitLength)

            if (radius < minVisibleRadius) {
                d += ` L ${curr.x} ${curr.y}`
                currentPoint = { ...curr }
                continue
            }

            const entryDirX = this.sign(entryVec.x)
            const entryDirY = this.sign(entryVec.y)
            const exitDirX = this.sign(exitVec.x)
            const exitDirY = this.sign(exitVec.y)

            const beforeCorner = {
                x: curr.x - entryDirX * radius,
                y: curr.y - entryDirY * radius
            }

            const afterCorner = {
                x: curr.x + exitDirX * radius,
                y: curr.y + exitDirY * radius
            }

            d += ` L ${beforeCorner.x} ${beforeCorner.y}`
            d += ` Q ${curr.x} ${curr.y} ${afterCorner.x} ${afterCorner.y}`
            currentPoint = afterCorner
        }

        return d
    }

    private simplifyPath(path: ConnectorPoint[]): ConnectorPoint[] {
        if (!path || path.length === 0) return []
        if (path.length <= 2) return path.slice()

        const axisThreshold = 0.1
        const distanceThreshold = 1

        let currentPath = path.slice()
        let changed = true

        while (changed) {
            changed = false
            const nextPath: ConnectorPoint[] = [currentPath[0]]

            for (let i = 1; i < currentPath.length - 1; i++) {
                const prev = nextPath[nextPath.length - 1]
                const curr = currentPath[i]
                const next = currentPath[i + 1]

                // Skip zero-length segments
                const distToPrev = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y)
                const distToNext = Math.abs(curr.x - next.x) + Math.abs(curr.y - next.y)

                if (distToPrev < distanceThreshold || distToNext < distanceThreshold) {
                    changed = true
                    continue
                }

                // Skip collinear points
                const prevToCurrentHorizontal = Math.abs(curr.y - prev.y) < axisThreshold
                const currentToNextHorizontal = Math.abs(next.y - curr.y) < axisThreshold
                const prevToCurrentVertical = Math.abs(curr.x - prev.x) < axisThreshold
                const currentToNextVertical = Math.abs(next.x - curr.x) < axisThreshold

                if ((prevToCurrentHorizontal && currentToNextHorizontal) ||
                    (prevToCurrentVertical && currentToNextVertical)) {
                    changed = true
                    continue
                }

                nextPath.push(curr)
            }

            nextPath.push(currentPath[currentPath.length - 1])
            currentPath = nextPath
        }

        return currentPath
    }

    private computeCornerRadius(entryLength: number, exitLength: number): number {
        if (entryLength <= 0 || exitLength <= 0) return 0
        const desired = this.cornerRadius
        return Math.min(desired, entryLength / 2, exitLength / 2)
    }

    private isAxisAligned(vec: { x: number; y: number }, epsilon = 0.1): boolean {
        const horizontal = Math.abs(vec.y) < epsilon && Math.abs(vec.x) >= epsilon
        const vertical = Math.abs(vec.x) < epsilon && Math.abs(vec.y) >= epsilon
        return horizontal || vertical
    }

    private areVectorsCollinear(a: { x: number; y: number }, b: { x: number; y: number }, epsilon = 0.1): boolean {
        const bothHorizontal = Math.abs(a.y) < epsilon && Math.abs(b.y) < epsilon
        const bothVertical = Math.abs(a.x) < epsilon && Math.abs(b.x) < epsilon
        return bothHorizontal || bothVertical
    }

    private segmentLength(vec: { x: number; y: number }): number {
        return Math.max(Math.abs(vec.x), Math.abs(vec.y))
    }

    private sign(n: number): number {
        if (n > 0) return 1
        if (n < 0) return -1
        return 0
    }

    intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean {
        if (this.pointsBent.length < 2) return false
        for (let i = 1; i < this.pointsBent.length; i++) {
            const start = this.pointsBent[i - 1]
            const end = this.pointsBent[i]
            if (this.lineIntersectsRect(start.x, start.y, end.x, end.y, rect)) {
                return true
            }
        }
        return false
    }

    /**
     * Get a point at a specific position along the bent path.
     */
    getPointAtPosition(ratio: number): { x: number; y: number } {
        const points = this.pointsBent
        if (points.length < 2) {
            return { x: this.startPoint.x, y: this.startPoint.y }
        }

        let totalLength = 0
        const segmentLengths: number[] = []

        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x
            const dy = points[i].y - points[i - 1].y
            const length = Math.sqrt(dx * dx + dy * dy)
            segmentLengths.push(length)
            totalLength += length
        }

        if (totalLength < 0.001) {
            return { x: points[0].x, y: points[0].y }
        }

        const targetLength = ratio * totalLength
        let accumulatedLength = 0

        for (let i = 0; i < segmentLengths.length; i++) {
            const segLength = segmentLengths[i]

            if (accumulatedLength + segLength >= targetLength) {
                const segmentRatio = (targetLength - accumulatedLength) / segLength
                const p1 = points[i]
                const p2 = points[i + 1]
                return {
                    x: p1.x + (p2.x - p1.x) * segmentRatio,
                    y: p1.y + (p2.y - p1.y) * segmentRatio
                }
            }

            accumulatedLength += segLength
        }

        return { x: points[points.length - 1].x, y: points[points.length - 1].y }
    }

    /**
     * Find the closest position (ratio) on the bent path for a given point.
     */
    getClosestPositionOnPath(point: { x: number; y: number }): number {
        const points = this.pointsBent
        if (points.length < 2) {
            return 0.5
        }

        let totalLength = 0
        const segmentLengths: number[] = []

        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x
            const dy = points[i].y - points[i - 1].y
            const length = Math.sqrt(dx * dx + dy * dy)
            segmentLengths.push(length)
            totalLength += length
        }

        if (totalLength < 0.001) {
            return 0.5
        }

        let bestDistance = Infinity
        let bestRatio = 0.5
        let accumulatedLength = 0

        for (let i = 0; i < segmentLengths.length; i++) {
            const p1 = points[i]
            const p2 = points[i + 1]
            const segLength = segmentLengths[i]

            if (segLength < 0.001) {
                accumulatedLength += segLength
                continue
            }

            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            const t = Math.max(0, Math.min(1,
                ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (dx * dx + dy * dy)
            ))

            const closestX = p1.x + t * dx
            const closestY = p1.y + t * dy
            const dist = Math.sqrt(
                (point.x - closestX) ** 2 + (point.y - closestY) ** 2
            )

            if (dist < bestDistance) {
                bestDistance = dist
                bestRatio = (accumulatedLength + t * segLength) / totalLength
            }

            accumulatedLength += segLength
        }

        return Math.max(0, Math.min(1, bestRatio))
    }

    copy(): DiagramShape {
        const newShape = new BentConnector(
            { ...this.startPoint },
            { ...this.endPoint },
            this.startShapeId,
            this.endShapeId
        );
        newShape.copyFrom(this);
        newShape.copyConnectorProperties(this);

        newShape.hasUserModifiedPath = this.hasUserModifiedPath;
        newShape.routingMode = this.routingMode;
        if (this.segments) {
            newShape.segments = cloneSegments(this.segments);
        }

        return newShape;
    }
}
