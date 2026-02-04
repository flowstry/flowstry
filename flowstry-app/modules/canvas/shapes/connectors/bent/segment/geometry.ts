/**
 * Segment geometry utilities for bent connectors.
 * 
 * Core functions for converting between segments and points,
 * validating geometry, and cleaning up segment arrays.
 */

import { ConnectorDirection, ConnectorPoint } from '../../base'
import {
  areCollinear, cloneSegment,
  createSegment,
  getOppositeAxis,
  getRequiredSegmentAxis,
  isZeroLength,
  Segment
} from './types'

/**
 * Convert an array of segments to an array of points.
 * 
 * Points exist at:
 * - Segment endpoints
 * - Segment intersections (where adjacent segments meet)
 * 
 * Invariant: Points are derived, never mutated to resolve routing.
 * 
 * @param segments - Array of segments to convert
 * @returns Array of connector points
 */
export function segmentsToPoints(segments: Segment[]): ConnectorPoint[] {
  if (segments.length === 0) {
    return []
  }

  const points: ConnectorPoint[] = []

  // First point from first segment
  const first = segments[0]
  if (first.axis === 'x') {
    // Horizontal segment: y is fixed, x varies
    points.push({ x: first.start, y: first.value })
  } else {
    // Vertical segment: x is fixed, y varies
    points.push({ x: first.value, y: first.start })
  }

  // Add intersection points and segment endpoints
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    
    if (seg.axis === 'x') {
      // Horizontal segment: add end point
      points.push({ x: seg.end, y: seg.value })
    } else {
      // Vertical segment: add end point
      points.push({ x: seg.value, y: seg.end })
    }
  }

  return points
}

/**
 * Convert an array of points to an array of segments.
 * 
 * This is used for migrating from the old point-based model
 * and for converting router output to segments.
 * 
 * @param points - Array of connector points
 * @param defaultLocked - Whether to mark segments as locked by default
 * @returns Array of segments
 */
export function pointsToSegments(points: ConnectorPoint[], defaultLocked: boolean = false): Segment[] {
  if (points.length < 2) {
    return []
  }

  const segments: Segment[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]

    const dx = Math.abs(p2.x - p1.x)
    const dy = Math.abs(p2.y - p1.y)

    // Determine axis based on which direction has more movement
    // For truly orthogonal paths, one should be ~0
    if (dx >= dy) {
      // Horizontal segment (axis = 'x')
      segments.push(createSegment(
        'x',
        p1.y, // Fixed y value
        p1.x, // Start x
        p2.x, // End x
        defaultLocked || (p1.fixedY === true) // Lock if point was fixed
      ))
    } else {
      // Vertical segment (axis = 'y')
      segments.push(createSegment(
        'y',
        p1.x, // Fixed x value
        p1.y, // Start y
        p2.y, // End y
        defaultLocked || (p1.fixedX === true) // Lock if point was fixed
      ))
    }
  }

  return segments
}

/**
 * Validate that adjacent segments alternate axes.
 * 
 * This is a core invariant: no two adjacent segments can have the same axis.
 * 
 * @param segments - Array of segments to validate
 * @returns true if valid, false otherwise
 */
export function validateAxisAlternation(segments: Segment[]): boolean {
  if (segments.length < 2) {
    return true
  }

  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].axis === segments[i + 1].axis) {
      return false
    }
  }

  return true
}

/**
 * Clean up segment array by removing zero-length segments
 * and merging collinear segments.
 * 
 * Preserves locked status: if any merged segment was locked,
 * the result is locked.
 * 
 * @param segments - Array of segments to clean up
 * @returns Cleaned up array of segments
 */
export function cleanupSegments(segments: Segment[]): Segment[] {
  if (segments.length === 0) {
    return []
  }

  // Step 1: Remove zero-length segments (preserving first/last)
  let result = segments.filter((seg, i) => {
    // Always keep first and last
    if (i === 0 || i === segments.length - 1) {
      return true
    }
    return !isZeroLength(seg)
  })

  // Step 2: Merge collinear segments
  let merged = true
  while (merged) {
    merged = false
    const newResult: Segment[] = []

    for (let i = 0; i < result.length; i++) {
      const current = result[i]
      const next = result[i + 1]

      if (next && areCollinear(current, next)) {
        // Merge: extend current to include next
        const mergedSegment = cloneSegment(current)
        mergedSegment.end = next.end
        mergedSegment.locked = current.locked || next.locked // Preserve lock
        newResult.push(mergedSegment)
        i++ // Skip next
        merged = true
      } else {
        newResult.push(cloneSegment(current))
      }
    }

    result = newResult
  }

  // Step 3: Ensure axis alternation by inserting zero-length connectors if needed
  // (This shouldn't happen if segments are generated correctly, but safety check)
  const validated: Segment[] = []
  for (let i = 0; i < result.length; i++) {
    validated.push(result[i])
    
    if (i < result.length - 1 && result[i].axis === result[i + 1].axis) {
      // Insert a connector segment between them
      const current = result[i]
      const next = result[i + 1]
      const oppositeAxis = getOppositeAxis(current.axis)
      
      if (oppositeAxis === 'x') {
        // Insert horizontal segment
        validated.push(createSegment(
          'x',
          current.axis === 'x' ? current.value : current.end,
          current.end,
          next.start,
          false
        ))
      } else {
        // Insert vertical segment
        validated.push(createSegment(
          'y',
          current.axis === 'y' ? current.value : current.end,
          current.end,
          next.start,
          false
        ))
      }
    }
  }

  return validated
}

/**
 * Ensure the first segment has the correct axis for the start direction.
 * 
 * If the first segment is the wrong axis, we insert a normalization segment
 * that goes from the connection point in the required direction, then update
 * the original first segment to connect properly.
 * 
 * @param segments - Current segments
 * @param startDirection - Direction at the start point
 * @param routingMargin - Minimum length for normalization segment
 * @returns Updated segments with normalization applied
 */
export function normalizeStartSegment(
  segments: Segment[],
  startDirection: ConnectorDirection | null,
  routingMargin: number
): Segment[] {
  if (segments.length === 0 || !startDirection) {
    return segments
  }

  const requiredAxis = getRequiredSegmentAxis(startDirection)
  const first = segments[0]

  if (first.axis === requiredAxis) {
    return segments // Already correct
  }

  // Need to insert a normalization segment
  const result = [...segments]
  
  // Get the connection point coordinates from the first segment
  // For horizontal (axis='x'): start=X starting position, value=Y fixed coordinate
  // For vertical (axis='y'): start=Y starting position, value=X fixed coordinate
  const connectionX = first.axis === 'y' ? first.value : first.start
  const connectionY = first.axis === 'x' ? first.value : first.start

  let normalizationSegment: Segment
  
  if (requiredAxis === 'x') {
    // Need horizontal first segment (exits left or right)
    const direction = startDirection === 'left' ? -1 : 1
    const normEndX = connectionX + direction * routingMargin

    normalizationSegment = createSegment(
      'x',
      connectionY,      // value = Y coordinate (fixed)
      connectionX,      // start = X at connection point
      normEndX,         // end = X after avoidance gap
      true
    )

    // Original first segment (now second) must connect to normalization end
    // For vertical segment: value=X, start=Y
    result[0] = {
      ...first,
      value: normEndX,        // X position is now at avoidance gap
      start: connectionY      // Y starts at connection point Y
    }

    // CRITICAL: Update the segment after the first to connect to the new position
    // The second segment's start must match the updated first segment's value
    if (result.length > 1) {
      const second = result[1]
      result[1] = {
        ...second,
        start: normEndX
      }
    }
  } else {
    // Need vertical first segment (exits top or bottom)
    const direction = startDirection === 'top' ? -1 : 1
    const normEndY = connectionY + direction * routingMargin

    normalizationSegment = createSegment(
      'y',
      connectionX,      // value = X coordinate (fixed)
      connectionY,      // start = Y at connection point
      normEndY,         // end = Y after avoidance gap
      true
    )

    // Original first segment (now second) must connect to normalization end
    // For horizontal segment: value=Y, start=X
    result[0] = {
      ...first,
      value: normEndY,        // Y position is now at avoidance gap
      start: connectionX      // X starts at connection point X
    }

    // CRITICAL: Update the segment after the first to connect to the new position
    // The second segment's start must match the updated first segment's value
    if (result.length > 1) {
      const second = result[1]
      result[1] = {
        ...second,
        start: normEndY
      }
    }
  }

  return [normalizationSegment, ...result]
}

/**
 * Ensure the last segment has the correct axis for the end direction.
 * 
 * If the last segment is the wrong axis, we insert a normalization segment
 * that goes toward the connection point, then update the original last segment
 * to connect properly.
 * 
 * @param segments - Current segments
 * @param endDirection - Direction at the end point
 * @param routingMargin - Minimum length for normalization segment
 * @returns Updated segments with normalization applied
 */
export function normalizeEndSegment(
  segments: Segment[],
  endDirection: ConnectorDirection | null,
  routingMargin: number
): Segment[] {
  if (segments.length === 0 || !endDirection) {
    return segments
  }

  const requiredAxis = getRequiredSegmentAxis(endDirection)
  const last = segments[segments.length - 1]

  if (last.axis === requiredAxis) {
    return segments // Already correct
  }

  // Need to insert a normalization segment
  const result = [...segments]
  
  // Get the connection point coordinates from the last segment
  // For horizontal (axis='x'): end=X ending position, value=Y fixed coordinate
  // For vertical (axis='y'): end=Y ending position, value=X fixed coordinate
  const connectionX = last.axis === 'y' ? last.value : last.end
  const connectionY = last.axis === 'x' ? last.value : last.end

  let normalizationSegment: Segment
  
  if (requiredAxis === 'x') {
    // Need horizontal last segment (arrives from left or right)
    // When arriving at 'left' side, avoidance extends to the LEFT (negative X)
    // When arriving at 'right' side, avoidance extends to the RIGHT (positive X)
    const direction = endDirection === 'left' ? -1 : 1
    const normStartX = connectionX + direction * routingMargin

    normalizationSegment = createSegment(
      'x',
      connectionY,      // value = Y coordinate (fixed)
      normStartX,       // start = X at avoidance gap  
      connectionX,      // end = X at connection point
      true
    )

    // Original last segment (now second-to-last) must connect to normalization start
    // For vertical segment: value=X, end=Y
    result[result.length - 1] = {
      ...last,
      value: normStartX,      // X position is now at avoidance gap
      end: connectionY        // Y ends at connection point Y
    }

    // CRITICAL: Update the segment before the last to connect to the new position
    // The second-to-last segment's end must match the updated last segment's value
    if (result.length > 1) {
      const secondLast = result[result.length - 2]
      result[result.length - 2] = {
        ...secondLast,
        end: normStartX
      }
    }
  } else {
    // Need vertical last segment (arrives from top or bottom)
    // When arriving at 'top' side, avoidance extends UP (negative Y)
    // When arriving at 'bottom' side, avoidance extends DOWN (positive Y)
    const direction = endDirection === 'top' ? -1 : 1
    const normStartY = connectionY + direction * routingMargin

    normalizationSegment = createSegment(
      'y',
      connectionX,      // value = X coordinate (fixed)
      normStartY,       // start = Y at avoidance gap
      connectionY,      // end = Y at connection point
      true
    )

    // Original last segment (now second-to-last) must connect to normalization start
    // For horizontal segment: value=Y, end=X
    result[result.length - 1] = {
      ...last,
      value: normStartY,      // Y position is now at avoidance gap
      end: connectionX        // X ends at connection point X
    }

    // CRITICAL: Update the segment before the last to connect to the new position
    // The second-to-last segment's end must match the updated last segment's value
    if (result.length > 1) {
      const secondLast = result[result.length - 2]
      result[result.length - 2] = {
        ...secondLast,
        end: normStartY
      }
    }
  }

  return [...result, normalizationSegment]
}

/**
 * Split a segment at a given position, inserting a new movable segment.
 * 
 * This is Figma-style behavior: dragging a segment always inserts new geometry.
 * The inserted segment is perpendicular to the original and will be the one
 * that moves during drag.
 * 
 * For a horizontal segment (axis='x'), we insert a vertical segment.
 * For a vertical segment (axis='y'), we insert a horizontal segment.
 * 
 * @param segments - Current segments
 * @param segmentIndex - Index of segment to split
 * @param position - Position along the segment's axis to split at
 * @returns Object with new segments array and the index of the inserted segment
 */
export function splitSegmentForDrag(
  segments: Segment[],
  segmentIndex: number,
  position: number
): { segments: Segment[]; insertedIndex: number } {
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return { segments, insertedIndex: -1 }
  }

  const result: Segment[] = []

  for (let i = 0; i < segments.length; i++) {
    if (i === segmentIndex) {
      const seg = segments[i]

      if (seg.axis === 'x') {
        // Horizontal segment: y is fixed (value), x varies (start/end)
        // Split at x = position
        // Insert a vertical segment at x = position
        
        // First part: from start to split point
        const firstPart = createSegment(
          'x',      // axis
          seg.value, // y value (fixed)
          seg.start, // start x
          position,  // end x (where we split)
          true       // locked
        )

        // New movable segment (vertical): x is fixed at split position, y can move
        // Initially it has zero length (start y = end y = the horizontal segment's y)
        const newSegment = createSegment(
          'y',       // axis (perpendicular)
          position,  // x value (fixed at split position)
          seg.value, // start y (same as horizontal segment's y)
          seg.value, // end y (initially same, will be dragged)
          false      // not locked - this is the one we're dragging
        )

        // Second part: from split point to end
        const secondPart = createSegment(
          'x',       // axis
          seg.value, // y value (fixed, same as first part)
          position,  // start x
          seg.end,   // end x
          true       // locked
        )

        result.push(firstPart, newSegment, secondPart)
      } else {
        // Vertical segment: x is fixed (value), y varies (start/end)
        // Split at y = position
        // Insert a horizontal segment at y = position
        
        // First part: from start to split point
        const firstPart = createSegment(
          'y',       // axis
          seg.value, // x value (fixed)
          seg.start, // start y
          position,  // end y (where we split)
          true       // locked
        )

        // New movable segment (horizontal): y is fixed at split position, x can move
        // Initially it has zero length (start x = end x = the vertical segment's x)
        const newSegment = createSegment(
          'x',       // axis (perpendicular)
          position,  // y value (fixed at split position)
          seg.value, // start x (same as vertical segment's x)
          seg.value, // end x (initially same, will be dragged)
          false      // not locked - this is the one we're dragging
        )

        // Second part: from split point to end
        const secondPart = createSegment(
          'y',       // axis
          seg.value, // x value (fixed, same as first part)
          position,  // start y
          seg.end,   // end y
          true       // locked
        )

        result.push(firstPart, newSegment, secondPart)
      }
    } else {
      result.push(cloneSegment(segments[i]))
    }
  }

  // The inserted segment is at segmentIndex + 1
  return { segments: result, insertedIndex: segmentIndex + 1 }
}


/**
 * Update a segment's position during drag.
 * 
 * Only the segment at the given index is modified.
 * The position update respects axis constraints.
 * 
 * @param segments - Current segments
 * @param segmentIndex - Index of segment being dragged
 * @param newValue - New fixed coordinate value
 * @returns Updated segments array
 */
export function updateSegmentDrag(
  segments: Segment[],
  segmentIndex: number,
  newValue: number
): Segment[] {
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return segments
  }


  const result = segments.map((seg, i) => {
    if (i === segmentIndex) {
      return { ...seg, value: newValue }
    }
    // Update adjacent segments' start/end to maintain connectivity
    if (i === segmentIndex - 1) {
      return { ...seg, end: newValue }
    }
    if (i === segmentIndex + 1) {
      return { ...seg, start: newValue }
    }
    return seg
  })

  return result
}




/**
 * Lock all segments (used when transitioning from auto to manual mode).
 * 
 * @param segments - Segments to lock
 * @returns New array with all segments locked
 */
export function freezeAllSegments(segments: Segment[]): Segment[] {
  return segments.map(seg => ({ ...seg, locked: true }))
}
