/**
 * Segment-centric data model for bent connectors.
 * 
 * Segments are the source of truth for connector geometry.
 * Points are derived from segments, never mutated directly.
 */

import { ConnectorDirection } from '../../base'

/**
 * Movement axis for a segment.
 * - 'x': Horizontal segment (moves along x-axis, fixed y-value)
 * - 'y': Vertical segment (moves along y-axis, fixed x-value)
 */
export type Axis = 'x' | 'y'

/**
 * Routing mode for the connector.
 * - 'auto': Path fully owned by router, may reroute freely
 * - 'manual': Geometry owned by user, router only assists with endpoints
 * 
 * Invariant: The only legal transition is auto → manual (irreversible)
 */
export type RoutingMode = 'auto' | 'manual'

/**
 * A segment in an orthogonal connector path.
 * 
 * For a horizontal segment (axis='x'):
 *   - value = y coordinate (fixed)
 *   - start/end = x coordinates
 * 
 * For a vertical segment (axis='y'):
 *   - value = x coordinate (fixed)
 *   - start/end = y coordinates
 */
export interface Segment {
  /** Movement axis: 'x' for horizontal, 'y' for vertical */
  axis: Axis
  
  /** Fixed coordinate (y if horizontal, x if vertical) */
  value: number
  
  /** Start coordinate along the movement axis */
  start: number
  
  /** End coordinate along the movement axis */
  end: number
  
  /** Whether this segment is locked (user-modified or forced) */
  locked: boolean
}

/**
 * Types of pointer interactions with a connector.
 */
export type InteractionType = 
  | 'segment_drag'   // Dragging a segment handle
  | 'bend_drag'      // Dragging a bend point
  | 'endpoint_drag'  // Dragging start/end handle
  | 'add_bend'       // Explicitly adding a bend

/**
 * State of an active interaction (drag operation).
 */
export interface InteractionState {
  /** Type of interaction */
  type: InteractionType
  
  /** Index of the segment being interacted with */
  segmentIndex: number
  
  /** Initial pointer position when interaction started */
  initialPointer: { x: number; y: number }
  
  /** Index of newly inserted segment (for segment drag) */
  insertedSegmentIndex: number
  
  /** Original segments before interaction (for undo) */
  originalSegments: Segment[]
}

/**
 * Get the required first segment axis based on the connection direction.
 * 
 * When a connector attaches to a shape, the first (or last) segment
 * MUST be oriented correctly relative to the shape side.
 * 
 * @param direction - The side of the shape being connected to
 * @returns The required axis for the first/last segment
 * 
 * Shape side   | Required axis
 * -------------|---------------
 * left/right   | 'x' (horizontal)
 * top/bottom   | 'y' (vertical)
 */
export function getRequiredSegmentAxis(direction: ConnectorDirection): Axis {
  switch (direction) {
    case 'left':
    case 'right':
      return 'x' // Horizontal exit
    case 'top':
    case 'bottom':
      return 'y' // Vertical exit
  }
}

/**
 * Get the opposite axis.
 */
export function getOppositeAxis(axis: Axis): Axis {
  return axis === 'x' ? 'y' : 'x'
}

/**
 * Check if two segments are on the same axis.
 */
export function areSameAxis(a: Segment, b: Segment): boolean {
  return a.axis === b.axis
}

/**
 * Check if a segment has zero length.
 */
export function isZeroLength(segment: Segment, epsilon: number = 0.01): boolean {
  return Math.abs(segment.end - segment.start) < epsilon
}

/**
 * Get the length of a segment.
 */
export function getSegmentLength(segment: Segment): number {
  return Math.abs(segment.end - segment.start)
}

/**
 * Check if two segments are collinear (same axis and same value).
 */
export function areCollinear(a: Segment, b: Segment, epsilon: number = 0.01): boolean {
  return a.axis === b.axis && Math.abs(a.value - b.value) < epsilon
}

/**
 * Create a new segment.
 */
export function createSegment(
  axis: Axis,
  value: number,
  start: number,
  end: number,
  locked: boolean = false
): Segment {
  return { axis, value, start, end, locked }
}

/**
 * Clone a segment.
 */
export function cloneSegment(segment: Segment): Segment {
  return { ...segment }
}

/**
 * Clone an array of segments.
 */
export function cloneSegments(segments: Segment[]): Segment[] {
  return segments.map(cloneSegment)
}
