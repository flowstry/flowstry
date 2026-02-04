import { DiagramShape } from '../base';
import { ConnectorDirection, ConnectorShape, ConnectorType } from './base';

// Midpoint mode types
export type MidpointMode = 'auto' | 'custom';

// Bézier curve utilities
export interface BezierCurve {
    p0: { x: number; y: number }; // Start point
    p1: { x: number; y: number }; // Control point 1
    p2: { x: number; y: number }; // Control point 2
    p3: { x: number; y: number }; // End point
}

/**
 * Compute a point on a cubic Bézier curve at parameter t ∈ [0, 1]
 */
export function bezierPointAt(curve: BezierCurve, t: number): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * curve.p0.x + 3 * mt2 * t * curve.p1.x + 3 * mt * t2 * curve.p2.x + t3 * curve.p3.x,
        y: mt3 * curve.p0.y + 3 * mt2 * t * curve.p1.y + 3 * mt * t2 * curve.p2.y + t3 * curve.p3.y
    };
}

/**
 * Get direction vector for connector directions
 */
function directionVector(dir: ConnectorDirection): { x: number; y: number } {
    switch (dir) {
        case 'top': return { x: 0, y: -1 };
        case 'bottom': return { x: 0, y: 1 };
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
    }
}

// Constants for control point computation
const MIN_TENSION = 20;
const MAX_TENSION = 200;
const TENSION_FACTOR = 0.35;

// Curved connector implementation with Figma-style midpoint logic
export class CurvedConnector extends ConnectorShape {
    readonly connectorType: ConnectorType = 'curved';

    // Midpoint system properties
    midpointMode: MidpointMode = 'auto';
    midpointRatio: number = 0.5; // Used only in auto mode (0-1)
    
    // In custom mode, store the world position directly
    // This ensures the midpoint stays fixed when endpoints move
    customMidpoint: { x: number; y: number } | null = null;
    
    // Legacy property for serialization compatibility
    midpointOffset: { dx: number; dy: number } = { dx: 0, dy: 0 };

    constructor(
        startPoint: { x: number; y: number },
        endPoint: { x: number; y: number },
        startShapeId: string | null = null,
        endShapeId: string | null = null
    ) {
        super(startPoint, endPoint, startShapeId, endShapeId);

        // Listen for layout changes to update customMidpoint
        this.layout.addOnChange((change) => {
            // Only handle external updates (user dragging)
            if (this.isInternalUpdate) return

            // If shape was translated, shift the custom midpoint
            if (change.newX !== change.prevX || change.newY !== change.prevY) {
                const dx = change.newX - change.prevX;
                const dy = change.newY - change.prevY;

                if (this.midpointMode === 'custom' && this.customMidpoint) {
                    this.customMidpoint.x += dx;
                    this.customMidpoint.y += dy;
                }
            }
        });
    }

    /**
     * Compute the base control points based on directions and tension
     * This creates the initial smooth curve before any midpoint adjustments
     */
    private computeBaseControlPoints(): { cp1: { x: number; y: number }; cp2: { x: number; y: number } } {
        const { x: x1, y: y1 } = this.startPoint;
        const { x: x2, y: y2 } = this.endPoint;
        const { startDirection, endDirection } = this.getDirections();

        // Calculate distance between endpoints
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Compute tension based on distance (clamped)
        const tension = Math.min(MAX_TENSION, Math.max(MIN_TENSION, distance * TENSION_FACTOR));

        // Get direction vectors
        const startDir = directionVector(startDirection);
        const endDir = directionVector(endDirection);

        // Control point 1: startPoint + startDir * tension
        const cp1 = {
            x: x1 + startDir.x * tension,
            y: y1 + startDir.y * tension
        };

        // Control point 2: endPoint + endDir * tension
        const cp2 = {
            x: x2 + endDir.x * tension,
            y: y2 + endDir.y * tension
        };

        return { cp1, cp2 };
    }

    /**
     * Get the base Bézier curve (without custom midpoint offset applied)
     */
    private getBaseCurve(): BezierCurve {
        const { cp1, cp2 } = this.computeBaseControlPoints();
        return {
            p0: { ...this.startPoint },
            p1: cp1,
            p2: cp2,
            p3: { ...this.endPoint }
        };
    }

    /**
     * Get the target midpoint position
     * In auto mode: computed from base curve at t=0.5
     * In custom mode: the stored world position
     */
    private getTargetMidpoint(): { x: number; y: number } {
        if (this.midpointMode === 'custom' && this.customMidpoint) {
            return this.customMidpoint;
        }
        // Auto mode: midpoint on base curve
        const curve = this.getBaseCurve();
        const ratio = this.midpointRatio ?? 0.5;
        return bezierPointAt(curve, ratio);
    }

    /**
     * Set the midpoint to a world-space position
     * This switches to custom mode
     */
    setMidpointWorld(worldX: number, worldY: number): void {
        this.midpointMode = 'custom';
        this.customMidpoint = { x: worldX, y: worldY };
        this.state.needsRender = true;
    }

    /**
     * Reset midpoint to auto mode
     */
    resetMidpoint(): void {
        this.midpointMode = 'auto';
        this.midpointRatio = 0.5;
        this.customMidpoint = null;
        this.state.needsRender = true;
    }

    /**
     * Check if the current midpoint is valid
     * Returns false if midpoint is inside a shape
     */
    private isMidpointValid(): boolean {
        if (this.midpointMode === 'auto' || !this.customMidpoint) return true;

        const midpoint = this.customMidpoint;

        // Check if midpoint is inside start or end shape
        if (this.startShapeId) {
            const startShape = this.getShapeById(this.startShapeId);
            if (startShape) {
                if (midpoint.x >= startShape.layout.x && midpoint.x <= startShape.layout.x + startShape.layout.width &&
                    midpoint.y >= startShape.layout.y && midpoint.y <= startShape.layout.y + startShape.layout.height) {
                    return false;
                }
            }
        }

        if (this.endShapeId) {
            const endShape = this.getShapeById(this.endShapeId);
            if (endShape) {
                if (midpoint.x >= endShape.layout.x && midpoint.x <= endShape.layout.x + endShape.layout.width &&
                    midpoint.y >= endShape.layout.y && midpoint.y <= endShape.layout.y + endShape.layout.height) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Compute control points that make the curve pass through the target midpoint at t=0.5.
     * 
     * Approach: Start with direction-based control points (which create nice curves),
     * then shift BOTH by the same offset to make the curve pass through M.
     * 
     * Math: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
     * If we shift both P1 and P2 by d: B_new(0.5) = B_base(0.5) + 0.75*d
     * So: d = (M - B_base(0.5)) / 0.75
     * 
     * This preserves the nice curved shape while making the curve pass through M.
     */
    private computeFinalControlPoints(): { cp1: { x: number; y: number }; cp2: { x: number; y: number } } {
        const base = this.computeBaseControlPoints();
        
        // In auto mode or if custom midpoint is invalid, use base control points
        if (this.midpointMode === 'auto' || !this.customMidpoint || !this.isMidpointValid()) {
            if (this.midpointMode === 'custom' && !this.isMidpointValid()) {
                // Revert to auto if invalid
                this.midpointMode = 'auto';
                this.customMidpoint = null;
            }
            return base;
        }

        const M = this.customMidpoint;

        // Compute the midpoint of the base curve at t=0.5
        const baseCurve: BezierCurve = {
            p0: this.startPoint,
            p1: base.cp1,
            p2: base.cp2,
            p3: this.endPoint
        };
        const baseMidpoint = bezierPointAt(baseCurve, 0.5);

        // Compute offset: d = (M - baseMidpoint) / 0.75
        // This shifts the curve so B(0.5) = M
        const dx = (M.x - baseMidpoint.x) / 0.75;
        const dy = (M.y - baseMidpoint.y) / 0.75;

        // Shift both control points by the same offset
        const cp1 = {
            x: base.cp1.x + dx,
            y: base.cp1.y + dy
        };

        const cp2 = {
            x: base.cp2.x + dx,
            y: base.cp2.y + dy
        };

        return { cp1, cp2 };
    }

    private visualCurve: BezierCurve | null = null;

    updatePath(): void {
        const { x: x1, y: y1 } = this.startPoint;
        const { x: x2, y: y2 } = this.endPoint;

        // Reset visual curve cache
        this.visualCurve = null;

        // Get control points (adjusted to pass through custom midpoint if set)
        const { cp1, cp2 } = this.computeFinalControlPoints();

        // Update pointsCurved array: anchor, control1, control2, anchor
        this.pointsCurved = [
            { x: x1, y: y1 }, // Start anchor
            { x: cp1.x, y: cp1.y }, // Control point 1
            { x: cp2.x, y: cp2.y }, // Control point 2
            { x: x2, y: y2 } // End anchor
        ];
    }

    protected buildPathFromPoints(): string {
        if (this.pointsCurved.length < 4) return '';
        
        // Get the original anchor points and control points
        const p0 = this.pointsCurved[0];
        const cp1 = this.pointsCurved[1];
        const cp2 = this.pointsCurved[2];
        const p3 = this.pointsCurved[3];

        // Create the base curve to compute tangent directions at endpoints
        // const baseCurve: BezierCurve = { p0, p1: cp1, p2: cp2, p3 };

        // Compute tangent directions at the endpoints
        // Start tangent: direction from p0 towards p1
        const startTangentX = cp1.x - p0.x;
        const startTangentY = cp1.y - p0.y;
        const startTangentLen = Math.sqrt(startTangentX * startTangentX + startTangentY * startTangentY);

        // End tangent: direction from p2 towards p3
        const endTangentX = p3.x - cp2.x;
        const endTangentY = p3.y - cp2.y;
        const endTangentLen = Math.sqrt(endTangentX * endTangentX + endTangentY * endTangentY);

        // Calculate offsets: gap + arrowhead size
        const gap = 10; // GRID_SPACING * 0.5 = 20 * 0.5 = 10
        const startArrowheadSize = this.startArrowheadType !== 'none' ? this.getArrowheadSize(this.startArrowheadType) : 0;
        const endArrowheadSize = this.endArrowheadType !== 'none' ? this.getArrowheadSize(this.endArrowheadType) : 0;

        // Gap only applies when connected to a shape, arrowhead offset always applies
        const startGap = this.startShapeId ? gap : 0;
        const endGap = this.endShapeId ? gap : 0;

        let startAnchor = { ...p0 };
        let endAnchor = { ...p3 };
        let arrowheadTipStart = { ...p0 };
        let arrowheadTipEnd = { ...p3 };

        // Offset start point along the tangent direction
        if (startTangentLen > 0.001) {
            const unitX = startTangentX / startTangentLen;
            const unitY = startTangentY / startTangentLen;

            // Arrowhead tip is at gap position (or at p0 if no shape)
            arrowheadTipStart = {
                x: p0.x + unitX * startGap,
                y: p0.y + unitY * startGap
            };

            // Curve starts after gap + arrowhead
            const startOffset = startGap + startArrowheadSize;
            if (startOffset > 0) {
                startAnchor = {
                    x: p0.x + unitX * startOffset,
                    y: p0.y + unitY * startOffset
                };
            }
        }

        // Offset end point along the tangent direction (opposite direction)
        if (endTangentLen > 0.001) {
            const unitX = endTangentX / endTangentLen;
            const unitY = endTangentY / endTangentLen;

            // Arrowhead tip is at gap position (or at p3 if no shape)
            arrowheadTipEnd = {
                x: p3.x - unitX * endGap,
                y: p3.y - unitY * endGap
            };

            // Curve ends before gap + arrowhead
            const endOffset = endGap + endArrowheadSize;
            if (endOffset > 0) {
                endAnchor = {
                    x: p3.x - unitX * endOffset,
                    y: p3.y - unitY * endOffset
                };
            }
        }

        // Save arrowhead tip positions (at gap distance from shape, not at curve endpoints)
        this.pathStart = arrowheadTipStart;
        this.pathEnd = arrowheadTipEnd;

        // Store tangents for arrowhead orientation
        this.startTangent = {
            x: startTangentX,
            y: startTangentY
        };
        this.endTangent = {
            x: endTangentX,
            y: endTangentY
        };

        // Create the visual curve with offset anchors (curve goes from startAnchor to endAnchor)
        const visualCurve: BezierCurve = {
            p0: startAnchor,
            p1: cp1,
            p2: cp2,
            p3: endAnchor
        };

        // Cache the visual curve for point positioning
        this.visualCurve = visualCurve;

        // Build the path command (no trimming needed, offsets already include arrowhead size)
        return `M ${visualCurve.p0.x} ${visualCurve.p0.y} C ${visualCurve.p1.x} ${visualCurve.p1.y}, ${visualCurve.p2.x} ${visualCurve.p2.y}, ${visualCurve.p3.x} ${visualCurve.p3.y}`;
    }

    private startTangent: { x: number; y: number } | null = null;
    private endTangent: { x: number; y: number } | null = null;

    /**
     * Override to use exact tangent angle of the curve at the connection point
     */
    protected override getMarkerOrientAngle(isStart: boolean): number {
        const tangent = isStart ? this.startTangent : this.endTangent;

        if (!tangent) {
            return super.getMarkerOrientAngle(isStart);
        }

        // Calculate angle in degrees
        // If tangent is zero length (unlikely with our curves), fall back to super
        if (Math.abs(tangent.x) < 0.001 && Math.abs(tangent.y) < 0.001) {
            return super.getMarkerOrientAngle(isStart);
        }

        let angle = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);

        // For start marker, it points into the path (opposite to tangent)
        // Tangent is p0 -> p1 (away from start)
        // Arrowhead should point towards start (opposite)
        if (isStart) {
            angle += 180;
        }
        // For end marker, it points into the target (same as tangent)
        // Tangent is p2 -> p3 (towards end)
        // Arrowhead should point towards end (same)

        return angle;
    }

    /**
     * Get the midpoint position for the handle
     * Returns the actual point on the rendered curve at t=0.5
     */
    override getCurvedMidpoint(): { x: number; y: number } {
        const curve = this.getCurrentCurve();
        if (!curve) {
            // Fallback if curve not yet computed
            return this.getTargetMidpoint();
        }
        // Return the actual point on the curve at t=0.5
        return bezierPointAt(curve, 0.5);
    }

    /**
     * Get the world-space midpoint (for serialization compatibility)
     */
    getMidpointWorld(): { x: number; y: number } {
        return this.getCurvedMidpoint();
    }

    /**
     * Get the current Bézier curve (with custom midpoint applied if in custom mode)
     */
    getCurrentCurve(): BezierCurve | null {
        if (this.pointsCurved.length < 4) return null;
        return {
            p0: { x: this.pointsCurved[0].x, y: this.pointsCurved[0].y },
            p1: { x: this.pointsCurved[1].x, y: this.pointsCurved[1].y },
            p2: { x: this.pointsCurved[2].x, y: this.pointsCurved[2].y },
            p3: { x: this.pointsCurved[3].x, y: this.pointsCurved[3].y }
        };
    }

    /**
     * Override getBBox to include control points in the bounding box calculation.
     * This ensures the mask covers the entire curved path, not just the anchor points.
     * For a cubic Bézier curve, the curve is always contained within the convex hull
     * of the control points, so including them gives a proper bounding box.
     */
    /**
     * Override updateBoundingBox to include control points in the bounding box calculation.
     * This ensures the layout bounds cover the entire curved path.
     */
    protected override updateBoundingBox(): void {
        // Ensure we have updated curve points
        if (this.pointsCurved.length < 4) {
            // Can't calculate accurate bounds yet, rely on parent or fallback
            return super.updateBoundingBox()
        }

        const curve = this.getCurrentCurve();
        if (!curve) {
            super.updateBoundingBox();
            return;
        }

        // Include all control points in the bounding box calculation
        const points = [curve.p0, curve.p1, curve.p2, curve.p3];

        // Also sample some points along the curve for maximum accuracy
        for (let t = 0.25; t <= 0.75; t += 0.25) {
            points.push(bezierPointAt(curve, t));
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        // Update layout with accurate bounds
        this.layout.updateBounds(minX, minY, maxX - minX, maxY - minY)
    }

    intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean {
        // Make sure we have updated points
        if (this.pointsCurved.length < 4) {
            this.updatePath();
        }

        const curve = this.getCurrentCurve();
        if (!curve) return false;

        // Sample points along the bezier curve
        let prevX = curve.p0.x;
        let prevY = curve.p0.y;
        const steps = 20; // More steps for better accuracy
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const pt = bezierPointAt(curve, t);

            if (this.lineIntersectsRect(prevX, prevY, pt.x, pt.y, rect)) return true;

            prevX = pt.x;
            prevY = pt.y;
        }
        return false;
    }

    /**
     * Get a point at a specific position along the curved path
     * Uses the Bézier curve parameter directly (ratio = t)
     * @param ratio Value from 0.0 (start) to 1.0 (end)
     */
    getPointAtPosition(ratio: number): { x: number; y: number } {
        // Use visual curve if available (accounts for arrowheads/gaps)
        // This ensures the point is exactly uniquely on the rendered line
        const curve = this.visualCurve || this.getCurrentCurve();
        if (!curve) {
            // Fallback to linear interpolation if curve not ready
            return {
                x: this.startPoint.x + (this.endPoint.x - this.startPoint.x) * ratio,
                y: this.startPoint.y + (this.endPoint.y - this.startPoint.y) * ratio
            };
        }
        return bezierPointAt(curve, ratio);
    }

    /**
     * Find the closest position (ratio) on the curved path for a given point
     * Samples the curve at many points and finds the closest
     */
    getClosestPositionOnPath(point: { x: number; y: number }): number {
        const curve = this.getCurrentCurve();
        if (!curve) {
            // Fallback to linear interpolation
            const dx = this.endPoint.x - this.startPoint.x;
            const dy = this.endPoint.y - this.startPoint.y;
            const lengthSq = dx * dx + dy * dy;
            if (lengthSq < 0.001) return 0.5;
            const t = ((point.x - this.startPoint.x) * dx + (point.y - this.startPoint.y) * dy) / lengthSq;
            return Math.max(0, Math.min(1, t));
        }

        // Sample the curve at many points and find closest
        const steps = 100;
        let bestT = 0.5;
        let bestDistance = Infinity;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pt = bezierPointAt(curve, t);
            const dist = Math.sqrt(
                (point.x - pt.x) ** 2 + (point.y - pt.y) ** 2
            );

            if (dist < bestDistance) {
                bestDistance = dist;
                bestT = t;
            }
        }

        // Refine with binary search around best t
        let low = Math.max(0, bestT - 0.02);
        let high = Math.min(1, bestT + 0.02);

        for (let i = 0; i < 10; i++) {
            const mid1 = low + (high - low) / 3;
            const mid2 = high - (high - low) / 3;

            const pt1 = bezierPointAt(curve, mid1);
            const pt2 = bezierPointAt(curve, mid2);

            const dist1 = Math.sqrt((point.x - pt1.x) ** 2 + (point.y - pt1.y) ** 2);
            const dist2 = Math.sqrt((point.x - pt2.x) ** 2 + (point.y - pt2.y) ** 2);

            if (dist1 < dist2) {
                high = mid2;
            } else {
                low = mid1;
            }
        }

        return Math.max(0, Math.min(1, (low + high) / 2));
    }

    copy(): DiagramShape {
        const newShape = new CurvedConnector(
            { ...this.startPoint },
            { ...this.endPoint },
            this.startShapeId,
            this.endShapeId
        );
        newShape.copyFrom(this);
        newShape.copyConnectorProperties(this);
        newShape.midpointMode = this.midpointMode;
        newShape.midpointRatio = this.midpointRatio;
        if (this.customMidpoint) newShape.customMidpoint = { ...this.customMidpoint };
        return newShape;
    }
}

