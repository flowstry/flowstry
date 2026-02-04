/**
 * SegmentManager - Segment-centric path management for bent connectors.
 * 
 * This is the implementation following the Figma-style segment model:
 * - Segments are the source of truth
 * - Points are derived from segments
 * - Manual mode is irreversible
 * - Dragging always inserts new geometry
 */

import { ConnectorDirection, ConnectorPoint } from '../../base'
import {
    cleanupSegments,
    freezeAllSegments,
    normalizeEndSegment,
    normalizeStartSegment,
    pointsToSegments,
    segmentsToPoints,
    splitSegmentForDrag,
    updateSegmentDrag
} from './geometry'
import {
    InteractionState,
    InteractionType,
    RoutingMode,
    Segment,
    cloneSegments,
    createSegment,
    getOppositeAxis
} from './types'




/**
 * Context for the V2 segment manager.
 */
export interface SegmentManagerContext {
    // Current segments (will be modified)
    segments: Segment[]

    // Routing mode
    routingMode: RoutingMode

    // Connection info
    startDirection: ConnectorDirection | null
    endDirection: ConnectorDirection | null

    // Whether endpoints are connected to shapes
    hasStartShape: boolean
    hasEndShape: boolean

    // Routing parameters
    routingMargin: number
}


/**
 * Result of interaction operations.
 */
export interface InteractionResult {
    segments: Segment[]
    routingMode: RoutingMode
    interactionState: InteractionState | null
}

/**
 * SegmentManager - Segment-centric implementation.
 */
export class SegmentManager {

  /**
   * Begin an interaction (drag operation).
   * 
   * This is called on pointer-down. If in auto mode, transitions to manual mode.
   * Always inserts new geometry per Figma behavior.
   */
    beginInteraction(
        ctx: SegmentManagerContext,
        type: InteractionType,
        segmentIndex: number,
        pointer: { x: number; y: number }
    ): InteractionResult {
        let segments = cloneSegments(ctx.segments)
        let routingMode = ctx.routingMode

        // Transition auto → manual on first interaction
        if (routingMode === 'auto') {
            segments = freezeAllSegments(segments)
            routingMode = 'manual'
        }

        // Store original state for undo
        const originalSegments = cloneSegments(segments)

        let insertedSegmentIndex = -1

        // Handle different interaction types
        switch (type) {
            case 'segment_drag': {
                const isFirstSegment = segmentIndex === 0
                const isLastSegment = segmentIndex === segments.length - 1

                // Check if first/last segment needs escape point insertion
                if (isFirstSegment) {
                  // Protect start point: insert escape segment
                    const oldLen = segments.length
                    segments = this.insertStartEscapeSegment(segments, ctx)
                    const count = segments.length - oldLen
                    // Now drag the segment AFTER the inserted ones
                    insertedSegmentIndex = count
              } else if (isLastSegment) {
                  // Protect end point: insert escape segment  
                    const oldLen = segments.length
                    segments = this.insertEndEscapeSegment(segments, ctx)
                    const count = segments.length - oldLen
                    // Drag the segment BEFORE the inserted ones (original last)
                    insertedSegmentIndex = segments.length - 1 - count
              } else {
                  // Middle segment: drag directly
                  insertedSegmentIndex = segmentIndex
              }

                break
            }

            case 'bend_drag': {
                // Dragging an existing bend - segment index is the segment BEFORE the bend
                insertedSegmentIndex = segmentIndex
                break
            }

            case 'endpoint_drag': {
                // Endpoint dragging - will be handled separately
                insertedSegmentIndex = segmentIndex === 0 ? 0 : segments.length - 1
                break
            }

            case 'add_bend': {
                // Explicit add-bend action: split the segment to insert new geometry
                const splitPosition = this.getSegmentSplitPosition(segments, segmentIndex, pointer)
                const result = splitSegmentForDrag(segments, segmentIndex, splitPosition)
                segments = result.segments
                insertedSegmentIndex = result.insertedIndex
                break
        }
    }



        const interactionState: InteractionState = {
            type,
            segmentIndex,
            initialPointer: { ...pointer },
            insertedSegmentIndex,
            originalSegments
        }

        return {
            segments,
            routingMode,
            interactionState
        }
    }

  /**
   * Update an active interaction during drag.
   * 
   * Only the inserted/active segment moves. Movement is axis-constrained.
   */
    updateInteraction(
        segments: Segment[],
        interactionState: InteractionState,
        pointer: { x: number; y: number }
    ): Segment[] {
        if (!interactionState || interactionState.insertedSegmentIndex < 0) {
            return segments
        }

        const idx = interactionState.insertedSegmentIndex
        if (idx < 0 || idx >= segments.length) {
            return segments
        }

        const segment = segments[idx]

        // Calculate new value based on segment axis
        // The segment moves perpendicular to its axis
        let newValue: number
        if (segment.axis === 'x') {
            // Horizontal segment: y is free to move
            newValue = pointer.y
        } else {
            // Vertical segment: x is free to move
            newValue = pointer.x
    }

        return updateSegmentDrag(segments, idx, newValue)

    }

    /**
     * End an interaction (on pointer-up).
     * 
     * Runs cleanup: removes zero-length segments, merges collinear.
     * Does NOT normalize - that's only for auto-routing, not manual edits.
     */
    endInteraction(
        segments: Segment[],
        _interactionState: InteractionState | null,
        _startDirection: ConnectorDirection | null,
        _endDirection: ConnectorDirection | null,
        _routingMargin: number
    ): Segment[] {
        // Only cleanup - NO normalization for manual edits
        const result = cleanupSegments(segments)
        return result
    }



  /**
   * Handle shape movement in manual mode.
   * 
   * Router may ONLY:
   * - Extend/shorten first/last segment
   * - Insert normalization/escape segments
   * 
   * Router may NOT:
   * - Move bends
   * - Reroute around obstacles
   */
    handleShapeMove(
        segments: Segment[],
        whichEnd: 'start' | 'end',
        newPosition: { x: number; y: number },
        direction: ConnectorDirection | null,
        routingMargin: number
    ): Segment[] {
        if (segments.length === 0) {
            return segments
        }

        const result = cloneSegments(segments)

        if (whichEnd === 'start') {
            // Update first segment to start at new position
            const first = result[0]

            if (first.axis === 'x') {
                // Horizontal segment: value is Y coordinate
                first.start = newPosition.x
                first.value = newPosition.y
            } else {
                // Vertical segment: value is X coordinate
                first.start = newPosition.y
                first.value = newPosition.x
            }

            // CRITICAL: Update the second segment to connect to the new first segment
            // If first segment's value changed, the second segment's start must match
            if (result.length > 1) {
                const second = result[1]
                if (first.axis === 'x') {
                    // First is horizontal (y=value), second should be vertical
                    // Second's start should be the new Y position
                    second.start = first.value
                } else {
                    // First is vertical (x=value), second should be horizontal  
                    // Second's start should be the new X position
                    second.start = first.value
                }
            }

            // Normalize if needed
            return normalizeStartSegment(result, direction, routingMargin)
        } else {
            // Update last segment to end at new position
            const last = result[result.length - 1]

            if (last.axis === 'x') {
                // Horizontal segment: value is Y coordinate
                last.end = newPosition.x
                last.value = newPosition.y
            } else {
                // Vertical segment: value is X coordinate
                last.end = newPosition.y
                last.value = newPosition.x
            }

            // CRITICAL: Update the second-to-last segment to connect to the new last segment
            // If last segment's value changed, the previous segment's end must match
            if (result.length > 1) {
                const secondLast = result[result.length - 2]
                if (last.axis === 'x') {
                    // Last is horizontal (y=value), second-last should be vertical
                    // Second-last's end should be the new Y position
                    secondLast.end = last.value
                } else {
                    // Last is vertical (x=value), second-last should be horizontal
                    // Second-last's end should be the new X position
                    secondLast.end = last.value
                }
            }

            // Normalize if needed
            return normalizeEndSegment(result, direction, routingMargin)
        }
    }

  /**
   * Convert router output (points) to segments for rendering.
   * Used in auto mode when the router calculates a new path.
   */
    routerOutputToSegments(points: ConnectorPoint[]): Segment[] {
        return pointsToSegments(points, false)
    }

    /**
     * Convert segments to points for backward compatibility and rendering.
     */
    segmentsToPoints(segments: Segment[]): ConnectorPoint[] {
        return segmentsToPoints(segments)
    }

    /**
     * Initialize segments from an existing point array.
     * Used for migrating existing connectors to the new model.
     */
    initializeFromPoints(
        points: ConnectorPoint[],
        hasUserModifiedPath: boolean
    ): { segments: Segment[]; routingMode: RoutingMode } {
        const segments = pointsToSegments(points, hasUserModifiedPath)
        const routingMode: RoutingMode = hasUserModifiedPath ? 'manual' : 'auto'
        return { segments, routingMode }
    }

    // ============ Private Helpers ============

    /**
     * Get the position along a segment where it should be split.
     */
    private getSegmentSplitPosition(
        segments: Segment[],
        segmentIndex: number,
        pointer: { x: number; y: number }
    ): number {
        if (segmentIndex < 0 || segmentIndex >= segments.length) {
            return 0
        }

        const segment = segments[segmentIndex]

        // The split position is along the segment's axis
        if (segment.axis === 'x') {
            // Horizontal segment: split at pointer.x
            return Math.max(segment.start, Math.min(segment.end, pointer.x))
        } else {
            // Vertical segment: split at pointer.y
            return Math.max(segment.start, Math.min(segment.end, pointer.y))
        }
    }

  /**
   * Insert an escape segment at the start to protect the start point.
   */
    private insertStartEscapeSegment(segments: Segment[], ctx: SegmentManagerContext): Segment[] {
        if (segments.length === 0) return segments

        const result = [...segments]
        const first = result[0]
        const { hasStartShape, startDirection, routingMargin } = ctx

        // Determine coordinates
        let startX: number, startY: number
        if (first.axis === 'x') {
            startX = first.start
            startY = first.value
        } else {
            startX = first.value
            startY = first.start
        }

        // Check for avoidance logic
        let useAvoidance = false
        if (hasStartShape && startDirection && first.axis === getRequiredAxis(startDirection)) {
            useAvoidance = true
        }

        if (useAvoidance && startDirection) {
            // Avoidance: Insert Stub + Elevator
            const gapDir = getGapDir(startDirection)
            const gap = routingMargin
            const escapeAxis = first.axis
            const elevatorAxis = getOppositeAxis(first.axis)

            // Calculate Stub End
            let stubEndX = startX
            let stubEndY = startY

            if (escapeAxis === 'x') {
                stubEndX = startX + gapDir * gap
            } else {
                stubEndY = startY + gapDir * gap
            }

            // Create Stub (Fixed length)
            const stub = createSegment(escapeAxis, (escapeAxis === 'x' ? startY : startX), (escapeAxis === 'x' ? startX : startY), (escapeAxis === 'x' ? stubEndX : stubEndY), true)

            // Create Elevator (Zero length initially)
            const elevator = createSegment(elevatorAxis, (escapeAxis === 'x' ? stubEndX : stubEndY), (escapeAxis === 'x' ? stubEndY : stubEndX), (escapeAxis === 'x' ? stubEndY : stubEndX), false)

            // Update original segment to start at end of elevator
            if (first.axis === 'x') {
                first.start = stubEndX
            } else {
                first.start = stubEndY
            }

            return [stub, elevator, ...result]
        } else {
            // Simple Logic (Existing)
            const escapeAxis = getOppositeAxis(first.axis)
            let escapeSegment: Segment
            if (escapeAxis === 'x') {
                escapeSegment = createSegment('x', startY, startX, startX, true)
            } else {
                escapeSegment = createSegment('y', startX, startY, startY, true)
            }
            return [escapeSegment, ...result]
        }
    }

    /**
     * Insert an escape segment at the end to protect the end point.
     */
    private insertEndEscapeSegment(segments: Segment[], ctx: SegmentManagerContext): Segment[] {
        if (segments.length === 0) return segments

        const result = [...segments]
        const last = result[result.length - 1]
        const { hasEndShape, endDirection, routingMargin } = ctx

        // Determine coordinates
        let endX: number, endY: number
        if (last.axis === 'x') {
            endX = last.end
            endY = last.value
        } else {
            endX = last.value
            endY = last.end
        }

        // Check for avoidance logic
        let useAvoidance = false
        if (hasEndShape && endDirection && last.axis === getRequiredAxis(endDirection)) {
            useAvoidance = true
        }

        if (useAvoidance && endDirection) {
            // Avoidance: Insert Stub + Elevator (at end)
            // Note: Stub connects to shape. Elevator connects dragged segment to Stub.
            // Order: [...others, dragged, elevator, stub]

            const gapDir = getGapDir(endDirection)
            const gap = routingMargin
            const escapeAxis = last.axis
            const elevatorAxis = getOppositeAxis(last.axis)

            // Calculate Stub Start (Where elevator ends)
            // "GapDir" is direction OUT from shape.
            // Stub connects (End - Gap) -> End.
            // So Stub Start is End - GapDir * Gap ??
            // Wait. GapDir is "Away".
            // If dragging away, we want the gap to be visible.
            // Stub connects (End + GapDir * Gap) ?? No.
            // Stub connects FROM (End - GapDir * Gap) TO (End).
            // Actually, stub spans the gap.
            // One end is at Shape (EndX, EndY).
            // Other end is at (End - GapDir * Gap)? No.
            // GapDir is "Away".
            // E.g. Right Side. GapDir = +1. Shape at 100.
            // Gap spans 100..120. (Away).
            // Stub connects 120 -> 100.
            // Stub Start (at 120). End (at 100).
            // Stub Start = End + GapDir * Gap.
            // Wait.
            // If EndDirection 'left'. Shape on Left.
            // Path approaches from Left (increasing X).
            // Avoidance is Left (-1).
            // Gap spans 0..-20.
            // Stub connects -20 -> 0.
            // Stub Start = End + GapDir * Gap.

            let stubStartX = endX
            let stubStartY = endY

            if (escapeAxis === 'x') {
                stubStartX = endX + gapDir * gap
            } else {
                stubStartY = endY + gapDir * gap
            }

            // Create Stub (Fixed length)
            const stub = createSegment(escapeAxis, (escapeAxis === 'x' ? endY : endX), (escapeAxis === 'x' ? stubStartX : stubStartY), (escapeAxis === 'x' ? endX : endY), true)

            // Create Elevator (Zero length initially)
            const elevator = createSegment(elevatorAxis, (escapeAxis === 'x' ? stubStartX : stubStartY), (escapeAxis === 'x' ? stubStartY : stubStartX), (escapeAxis === 'x' ? stubStartY : stubStartX), false)

            // Update original segment to end at stub start
            if (last.axis === 'x') {
                last.end = stubStartX
            } else {
                last.end = stubStartY
            }

            return [...result, elevator, stub]
        } else {
            // Simple Logic
            const escapeAxis = getOppositeAxis(last.axis)
            let escapeSegment: Segment
            if (escapeAxis === 'x') {
                escapeSegment = createSegment('x', endY, endX, endX, true)
            } else {
                escapeSegment = createSegment('y', endX, endY, endY, true)
            }
            return [...result, escapeSegment]
        }
    }
}

// Export singleton instance
export const segmentManager = new SegmentManager()

// Helper functions for avoidance logic
function getRequiredAxis(dir: ConnectorDirection): 'x' | 'y' {
    return (dir === 'left' || dir === 'right') ? 'x' : 'y'
}

function getGapDir(dir: ConnectorDirection): 1 | -1 {
    return (dir === 'right' || dir === 'bottom') ? 1 : -1
}



