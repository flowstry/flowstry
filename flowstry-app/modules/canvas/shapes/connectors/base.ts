import rough from 'roughjs';
import { GRID_SPACING } from '../../consts/canvas';
import { getRoughOptions } from '../../utils/handdrawn';
import { DiagramShape, ShapeName } from '../base';

export type ConnectorType = 'straight' | 'bent' | 'curved'
export type ConnectorDirection = 'top' | 'bottom' | 'left' | 'right'

import { ArrowheadManager } from './arrowheads/ArrowheadManager';
import { ArrowheadType } from './arrowheads/types';
import { ConnectorContext, ConnectorHandleManager } from './handles/ConnectorHandleManager';
import { defaultDynamicDirections, getMarkerOrientAngle, lineIntersectsRect, offsetPointByDirection } from './utils/geometry';

export type { ArrowheadType };

// Point type with optional axis constraints and metadata used by bent connectors
export type ConnectorPoint = {
    x: number
    y: number

    // Axis-level constraints (set when user manually adjusts segments)
    // A point can be fixed on one or both axes independently
    fixedX?: boolean    // X coordinate is user-fixed (vertical segment moved)
    fixedY?: boolean    // Y coordinate is user-fixed (horizontal segment moved)

    // Optional direction for this waypoint (used by bent connector routing)
    direction?: ConnectorDirection

    // Optional endpoint role flags (used by bent connector routing)
    startPrimary?: boolean
    startSecondary?: boolean
    endSecondary?: boolean
    endPrimary?: boolean
}

// Control point type for curved connectors
export type ControlPoint = { x: number; y: number }

// Abstract base class for all connector types
export abstract class ConnectorShape extends DiagramShape {
    startPoint: { x: number; y: number }
    endPoint: { x: number; y: number }
    abstract readonly connectorType: ConnectorType
    startShapeId: string | null = null
    endShapeId: string | null = null
    startConnectorPoint: ConnectorDirection | null = null
    endConnectorPoint: ConnectorDirection | null = null
    public startConnectorPointDirection: ConnectorDirection | null = null
    public endConnectorPointDirection: ConnectorDirection | null = null

    // Optional method for connector types that support segment handles (e.g. BentConnector)
    public shouldShowSegmentHandle?(segmentIndex: number): boolean

    // Arrowhead configuration - separate for start and end
    startArrowheadType: ArrowheadType = 'none' // Default to no arrowhead at start
    endArrowheadType: ArrowheadType = 'open-arrow' // Default to directed association at end

    // Point arrays for each connector type
    pointsStraight: ConnectorPoint[] = []
    pointsBent: ConnectorPoint[] = []
    pointsCurved: (ConnectorPoint | ControlPoint)[] = [] // Alternates: anchor, control1, control2, anchor, ...

    // Handle Manager
    protected handleManager: ConnectorHandleManager

    // Hit testing path (invisible, thicker)
    hitPathElement: SVGGraphicsElement

    // Arrowhead paths
    startArrowheadPath: SVGPathElement
    endArrowheadPath: SVGPathElement

    // Mask for text label (created lazily when text is present)
    maskElement: SVGMaskElement | null = null
    maskRect: SVGRectElement | null = null // The white visible part (background)
    maskTextHole: SVGRectElement | null = null // The black hidden part (text area)
    maskStartBlocker: SVGRectElement | null = null // Black rect to hide stroke at start arrow
    maskEndBlocker: SVGRectElement | null = null // Black rect to hide stroke at end arrow

    // Flow animation state
    animated: boolean = false

    // Label position along the path (0.0 = start, 1.0 = end, default = 0.5 = middle)
    labelPosition: number = 0.5

    // Actual start/end points of the rendered path (for arrowhead positioning)
    protected pathStart: { x: number; y: number } = { x: 0, y: 0 }
    protected pathEnd: { x: number; y: number } = { x: 0, y: 0 }

    // Cache for text bounds to avoid layout thrashing
    private _cachedTextBounds: { width: number; height: number } | null = null
    private _lastMeasuredText: string = ''



    constructor(
        startPoint: { x: number; y: number },
        endPoint: { x: number; y: number },
        startShapeId: string | null = null,
        endShapeId: string | null = null
    ) {
        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        pathElement.setAttribute('fill', 'none')
        pathElement.setAttribute('stroke-linecap', 'round')
        pathElement.setAttribute('stroke-linejoin', 'round')

        // Calculate bounding box for the super constructor
        const minX = Math.min(startPoint.x, endPoint.x)
        const minY = Math.min(startPoint.y, endPoint.y)
        const width = Math.abs(endPoint.x - startPoint.x)
        const height = Math.abs(endPoint.y - startPoint.y)

        // Create hit path (invisible, thicker)
        const hitPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        hitPathElement.setAttribute('fill', 'none')
        hitPathElement.setAttribute('stroke', 'transparent')
        hitPathElement.setAttribute('stroke-width', '8') // Thicker for easier hitting, but not too wide
        hitPathElement.setAttribute('stroke-linecap', 'round')
        hitPathElement.setAttribute('stroke-linejoin', 'round')
        hitPathElement.setAttribute('pointer-events', 'stroke') // Capture events on this stroke
        // Note: Handles will be appended after this, so they'll be on top and can capture events first

        super('connector' as ShapeName, pathElement, minX, minY, width, height)

        this.hitPathElement = hitPathElement

        // Create arrowhead paths
        this.startArrowheadPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        this.startArrowheadPath.setAttribute('fill', 'none')
        this.startArrowheadPath.setAttribute('stroke-linecap', 'round')
        this.startArrowheadPath.setAttribute('stroke-linejoin', 'round')
        this.startArrowheadPath.setAttribute('pointer-events', 'auto') // Make arrowheads clickable

        this.endArrowheadPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        this.endArrowheadPath.setAttribute('fill', 'none')
        this.endArrowheadPath.setAttribute('stroke-linecap', 'round')
        this.endArrowheadPath.setAttribute('stroke-linejoin', 'round')
        this.endArrowheadPath.setAttribute('stroke-linejoin', 'round')
        this.endArrowheadPath.setAttribute('pointer-events', 'auto') // Make arrowheads clickable

        // Mask elements are created lazily in updateMask() when text is present
        // This improves performance for connectors without text labels

        // Add hit path to group (before visible path so it's behind)
        this.element.appendChild(this.hitPathElement)
        this.element.appendChild(this.shapeElement)

        // Add arrowheads on top
        this.element.appendChild(this.startArrowheadPath)
        this.element.appendChild(this.endArrowheadPath)

        // Disable pointer events on the group container so it doesn't capture clicks in the bounding box
        // Use BOTH attribute and style to be absolutely sure
        this.element.setAttribute('pointer-events', 'none')
        this.element.style.pointerEvents = 'none'

        // Ensure no fill captures events
        this.element.setAttribute('fill', 'none')
        this.element.style.fill = 'none'

        // Enable pointer events on the visible path and hit path
        // Use visibleStroke to ensure it only captures on the stroke
        this.shapeElement.setAttribute('pointer-events', 'stroke')
        this.shapeElement.style.pointerEvents = 'stroke'

        this.hitPathElement.setAttribute('pointer-events', 'stroke')
        this.hitPathElement.style.pointerEvents = 'stroke'

        this.startPoint = startPoint
        this.endPoint = endPoint
        this.startShapeId = startShapeId
        this.endShapeId = endShapeId

        // Initialize point arrays from start/end points
        this.pointsStraight = [
            { x: startPoint.x, y: startPoint.y },
            { x: endPoint.x, y: endPoint.y }
        ]
        this.pointsBent = [
            { x: startPoint.x, y: startPoint.y },
            { x: endPoint.x, y: endPoint.y }
        ]
        this.pointsCurved = [
            { x: startPoint.x, y: startPoint.y },
            { x: endPoint.x, y: endPoint.y }
        ]

        // Initialize handle manager
        this.handleManager = new ConnectorHandleManager(this.element)

        // Set default styles
        this.appearance.stroke = '#000000'
        this.appearance.strokeWidth = 2

        // Ensure fill is always 'none' for connectors
        this.appearance.fill = 'none'
        this.appearance.fillOpacity = 0
        this.appearance.fillStyle = 'none'


        // Initialize path (this will populate the arrays)
        this.updatePath()

        // Arrow markers will be set in render() based on arrowheadType

        // Listen for layout changes (movements)
        this.layout.addOnChange((change) => {
            if (this.isInternalUpdate) return

            // Handle translation
            if (change.newX !== change.prevX || change.newY !== change.prevY) {
                const dx = change.newX - change.prevX
                const dy = change.newY - change.prevY

                // Only if sizes match (simple move), otherwise it's a resize which we don't fully support via layout yet, 
                // or it's a "scale" which connectors don't really do via layout bounds usually.
                // Assuming simple translation if x/y changed.

                this.startPoint.x += dx
                this.startPoint.y += dy
                this.endPoint.x += dx
                this.endPoint.y += dy

                // Update all point arrays
                const updatePoint = (p: { x: number, y: number }) => {
                    p.x += dx
                    p.y += dy
                }

                this.pointsStraight.forEach(updatePoint)
                this.pointsBent.forEach(updatePoint)
                this.pointsCurved.forEach(updatePoint)

                this.state.needsRender = true
            }
        })

        // Use ShapeText calculators
        this.shapeText.positionCalculator = () => this.getPointAtPosition(this.labelPosition)
        this.shapeText.boundsCalculator = () => ({ width: 0, height: 0 })
    }

    public copyConnectorProperties(from: ConnectorShape): void {
        this.startShapeId = from.startShapeId
        this.endShapeId = from.endShapeId
        this.startConnectorPoint = from.startConnectorPoint
        this.endConnectorPoint = from.endConnectorPoint
        this.startConnectorPointDirection = from.startConnectorPointDirection
        this.endConnectorPointDirection = from.endConnectorPointDirection
        this.startArrowheadType = from.startArrowheadType
        this.endArrowheadType = from.endArrowheadType
        this.animated = from.animated
        this.labelPosition = from.labelPosition

        // Copy points arrays (deep clone)
        this.pointsStraight = from.pointsStraight.map(p => ({ ...p }))
        this.pointsBent = from.pointsBent.map(p => ({ ...p }))
        this.pointsCurved = from.pointsCurved.map(p => ({ ...p }))

        // Also copy styles that might be specific to connectors if any
    }

    protected isInternalUpdate: boolean = false

    // Connectors use Appearance setters directly via base class listeners
    // We don't need to override setFill/Stroke etc as they are removed from base.
    // However, we need to enforce connector specifics.
    // We can do this by listening to appearance changes? 
    // Or just setting defaults and trusting they aren't changed to invalid values?
    // For now, let's just leave it. If appearance.fill is set, it will render.
    // But connectors shouldn't be filled.
    // We can override the appearance property? No.
    // We can just rely on render() to enforce 'none' fill?
    // In render, super.render() is called.
    // Let's modify render() to enforce fill='none' if needed.
    // BaseConnector.render() calls super.render().
    // super.render uses appearance.fill.
    // So we should force appearance.fill = 'none' in constructor?
    // Or just let it be. users shouldn't set fill on connectors.
    

    // Invalidate bounds cache when text changes
    get text(): string {
        return super.text
    }

    set text(val: string) {
        if (this.text !== val) {
            super.text = val
            this._cachedTextBounds = null
        }
    }

    // Invalidate bounds on font changes (override common setters)
    // Actually we can't override setters easily if they depend on internal data.
    // But we can hook into appearance change?
    // We already have a listener in base class that sets needsRender.
    // We need to ALSO clear cache.
    // We can add a specialized listener in constructor?
    // Yes.
    
    // NOTE: setFontSize etc are removed from base. 
    // We should add a listener in constructor to clear cache on appearance change.

    // Abstract method for type-specific path generation
    // This should only update the point arrays, not render
    abstract updatePath(): void

    // Get current points array based on connector type
    protected getCurrentPoints(): ConnectorPoint[] {
        switch (this.connectorType) {
            case 'straight':
                return this.pointsStraight
            case 'bent':
                return this.pointsBent
            case 'curved':
                // For curved, filter to only anchor points (every 3rd point: 0, 3, 6, ...)
                return this.pointsCurved.filter((_, i) => i % 3 === 0) as ConnectorPoint[]
            default:
                return this.pointsStraight
        }
    }

    // Sync startPoint and endPoint from current point arrays
    protected syncStartEndPoints(): void {
        const points = this.getCurrentPoints()
        if (points.length > 0) {
            this.startPoint = { x: points[0].x, y: points[0].y }
        }
        if (points.length > 1) {
            this.endPoint = { x: points[points.length - 1].x, y: points[points.length - 1].y }
        }
    }

    // Abstract method to build path string from point arrays
    // Each connector type implements this to build its own path
    protected abstract buildPathFromPoints(): string

    /**
     * Offset a point by a specific amount in the given direction
     */
    protected offsetPointByDirection(point: { x: number; y: number }, direction: ConnectorDirection, amount: number): { x: number; y: number } {
        return offsetPointByDirection(point, direction, amount)
    }

    /**
     * Get the arrowhead size (refX) for a given arrowhead type, scaled by stroke width
     * @param arrowheadType The arrowhead type
     * @returns The scaled refX value (distance from endpoint to arrowhead start)
     */
    protected getArrowheadSize(arrowheadType: ArrowheadType): number {
        return ArrowheadManager.getArrowheadSize(arrowheadType, this.appearance.strokeWidth);
    }

    /**
     * Offset a point by 0.5 * GRID_SPACING away from a connected shape
     * Only applies if the point is connected to a shape
     * This maintains a constant gap between the shape and connector
     * @param point The point to offset
     * @param isStart Whether this is the start point (true) or end point (false)
     * @returns The offset point, or the original point if not connected to a shape
     */
    protected offsetPointFromShape(point: { x: number; y: number }, isStart: boolean): { x: number; y: number } {
        const shapeId = isStart ? this.startShapeId : this.endShapeId
        if (!shapeId) {
            return point
        }

        // Try to get direction from stored values first
        let direction: ConnectorDirection | null = isStart 
            ? (this.startConnectorPointDirection || this.startConnectorPoint)
            : (this.endConnectorPointDirection || this.endConnectorPoint)

        // If no stored direction, try to get it from the shape
        if (!direction) {
            const shape = this.getShapeById(shapeId)
            if (shape) {
                const edgeSide = shape.connectionPoints.getEdgeSide(point)
                // Store the direction for future use
                if (isStart) {
                    this.startConnectorPointDirection = edgeSide
                } else {
                    this.endConnectorPointDirection = edgeSide
                }
                direction = edgeSide
            } else {
                return point
            }
        }

        // Calculate offset amount (constant gap from shape)
        const offset = GRID_SPACING * 0.5

        if (!direction) {
            return point
        }

        return this.offsetPointByDirection(point, direction, offset)
    }

    /**
     * Add arrowhead offset to a point to stop the path before the arrowhead
     * This is applied after the gap offset to maintain constant gap from shape
     * @param point The point to offset (already offset from shape)
     * @param isStart Whether this is the start point (true) or end point (false)
     * @returns The offset point with arrowhead size added
     */
    protected addArrowheadOffset(point: { x: number; y: number }, isStart: boolean): { x: number; y: number } {
        const arrowheadType = isStart ? this.startArrowheadType : this.endArrowheadType
        if (arrowheadType === 'none') {
            return point
        }

        const arrowheadSize = this.getArrowheadSize(arrowheadType)
        const direction: ConnectorDirection | null = isStart 
            ? (this.startConnectorPointDirection || this.startConnectorPoint)
            : (this.endConnectorPointDirection || this.endConnectorPoint)

        if (!direction) {
            return point
        }

        return this.offsetPointByDirection(point, direction, arrowheadSize)
    }

    /**
     * Ensure that start and end directions are set if not already set
     * This is needed for proper gap offset calculation
     */
    private ensureDirectionsAreSet(): void {
        // Ensure start direction is set
        if (this.startShapeId && !this.startConnectorPointDirection && !this.startConnectorPoint) {
            const shape = this.getShapeById(this.startShapeId)
            if (shape) {
                this.startConnectorPointDirection = shape.connectionPoints.getEdgeSide(this.startPoint)
            }
        }

        // Ensure end direction is set
        if (this.endShapeId && !this.endConnectorPointDirection && !this.endConnectorPoint) {
            const shape = this.getShapeById(this.endShapeId)
            if (shape) {
                this.endConnectorPointDirection = shape.connectionPoints.getEdgeSide(this.endPoint)
            }
        }
    }

    /**
     * Update arrowheads by setting their path data and transform
     */
    protected updateArrowheads(): void {
        this.updateArrowhead(this.startArrowheadPath, this.startArrowheadType, true)
        this.updateArrowhead(this.endArrowheadPath, this.endArrowheadType, false)
        this.updateArrowheadMasks()
    }

    private updateArrowheadMasks(): void {
        // Only update arrowhead masks if mask exists (i.e., connector has text)
        if (this.maskStartBlocker) {
            this.updateArrowheadMask(this.maskStartBlocker, this.startArrowheadType, true)
        }
        if (this.maskEndBlocker) {
            this.updateArrowheadMask(this.maskEndBlocker, this.endArrowheadType, false)
        }
    }

    private updateArrowheadMask(rect: SVGRectElement, type: ArrowheadType, isStart: boolean): void {
        if (type === 'none') {
            rect.setAttribute('width', '0')
            return
        }

        const arrowheadSize = this.getArrowheadSize(type)
        const point = isStart ? this.pathStart : this.pathEnd
        const angle = this.getMarkerOrientAngle(isStart)

        // Block height needs to be enough to cover the stroke width plus cap
        // 20px is safe for most stroke widths
        const blockHeight = 20

        // We want to block FROM the endpoint BACKWARDS into the line
        // The arrowhead points OUT from the line
        // The angle points OUT from the line (opposite to flow) or IN to the line?
        // Let's check getMarkerOrientAngle:
        // "Arrow always points OPPOSITE to the path direction... pointing TOWARD the connected shape"
        // So angle is pointing AWAY from the line path.
        // We want the mask to start at the tip (point) and go backwards (into the line).
        // Since 'angle' is the direction of the arrow tip, rotating by 'angle' gives us X axis pointing same way as arrow.
        // The arrow points AWAY from the line.
        // So the line is BEHIND the arrow.
        // If we place a rect at (0, -height/2), it covers X>0.
        // So we want to cover X>0 (the arrow direction) or X<0 (the line direction)?
        // Wait, the stroke we want to hide is UNDER the arrowhead.
        // The arrowhead extends from 'point' in direction 'angle'.
        // So the mask should also extend from 'point' in direction 'angle'.
        // Yes, so we align with the arrow.

        // Rect dimensions
        const width = Math.max(0, arrowheadSize - 1) // -1 to avoid gap artifact at connector join
        const height = blockHeight

        rect.setAttribute('width', String(width))
        rect.setAttribute('height', String(height))

        // Transform: translate to point, rotate, then center vertically
        // We want the rect to start at x=0 (the tip) and go to x=width
        // And be centered vertically (y = -height/2)
        const transform = `translate(${point.x}, ${point.y}) rotate(${angle}) translate(0, ${-height / 2})`

        rect.setAttribute('transform', transform)
    }

    private updateArrowhead(pathElement: SVGPathElement, type: ArrowheadType, isStart: boolean): void {
        if (type === 'none') {
            pathElement.setAttribute('d', '')
            return
        }

        // Use the actual path endpoints for proper alignment
        const point = isStart ? this.pathStart : this.pathEnd
        const angle = this.getMarkerOrientAngle(isStart)

        // Helper to update the path element using the manager
        ArrowheadManager.updateArrowheadPath(
            pathElement,
            type,
            point,
            angle,
            this.appearance.stroke,
            this.appearance.strokeWidth
        )
        const opacity = this.appearance.strokeOpacity ?? 1
        pathElement.setAttribute('stroke-opacity', String(opacity))
        pathElement.setAttribute('fill-opacity', String(opacity))
    }



    /**
     * Calculate the marker orientation angle based on connector point direction.
     * The arrowhead paths are designed pointing RIGHT (positive X).
     * 
     * Both start and end markers use the SAME logic - they point opposite to
     * their connector point direction (into the path, away from the shape).
     * Start and end points are interchangeable.
     * 
     *   - direction 'top' → arrowhead points DOWN → 90°
     *   - direction 'bottom' → arrowhead points UP → 270°
     *   - direction 'left' → arrowhead points RIGHT → 0°
     *   - direction 'right' → arrowhead points LEFT → 180°
     */
    protected getMarkerOrientAngle(isStart: boolean): number {
        const direction = isStart
            ? (this.startConnectorPointDirection || this.startConnectorPoint)
            : (this.endConnectorPointDirection || this.endConnectorPoint)

        return getMarkerOrientAngle(direction, this.startPoint, this.endPoint, isStart)
    }

    /**
     * Get marker ID for arrowhead type
     * @deprecated Markers are no longer used
     */
    protected getMarkerId(_arrowheadType: ArrowheadType, isStart: boolean = false): string {
        return `marker-${this.id}-${isStart ? 'start' : 'end'}`
    }

    // Helper method to update path attributes and bounding box
    protected updatePathAttributes(d: string) {
        this.shapeElement.setAttribute('d', d)
        this.hitPathElement.setAttribute('d', d)

        // Update bounding box from point arrays
        this.updateBoundingBox()
    }

    // Update bounding box from current point arrays
    protected updateBoundingBox(): void {
        const points = this.getCurrentPoints()
        if (points.length === 0) return

        let minX = points[0].x
        let minY = points[0].y
        let maxX = points[0].x
        let maxY = points[0].y

        for (const point of points) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
        }

        this.isInternalUpdate = true
        this.layout.updateBounds(minX, minY, maxX - minX, maxY - minY)
        this.isInternalUpdate = false
    }

    // Update mask based on text position and size
    // Mask is lazily created when text is present and removed when text is cleared
    protected updateMask(): void {
        // Helper to update attribute only if changed
        const setAttr = (el: Element, name: string, val: string) => {
            if (el.getAttribute(name) !== val) {
                el.setAttribute(name, val)
            }
        }

        // If no text (or whitespace-only, or empty HTML tags), remove mask if it exists
        // Strip HTML tags to check for actual text content
        const textContent = this.text ? this.text.replace(/<[^>]*>/g, '').trim() : ''
        if (!textContent) {
            this._cachedTextBounds = null
            this.removeMask()
            return
        }

        // Text is present - ensure mask exists (lazy creation)
        this.ensureMaskExists()

        // Calculate dynamic bounds for the mask
        const bbox = this.layout.getBBox()
        const margin = 50 // Reduced from 1000 to improve performance
        const maskX = bbox.x - margin
        const maskY = bbox.y - margin
        const maskWidth = bbox.width + margin * 2
        const maskHeight = bbox.height + margin * 2

        // Update the mask element viewport to cover the area
        setAttr(this.maskElement!, 'x', String(maskX))
        setAttr(this.maskElement!, 'y', String(maskY))
        setAttr(this.maskElement!, 'width', String(maskWidth))
        setAttr(this.maskElement!, 'height', String(maskHeight))

        // Get actual text dimensions (cached if available)
        let textBounds = this._cachedTextBounds
        if (!textBounds || this.text !== this._lastMeasuredText) {
            textBounds = this.shapeText.measureActualTextBounds()
            if (textBounds) {
                this._cachedTextBounds = textBounds
                this._lastMeasuredText = this.text
            }
        }

        if (!textBounds) return

        const textPos = this.shapeText.getPosition()
        const width = Math.max(15, textBounds.width)
        const height = Math.max(15, textBounds.height)

        // Add a small padding around the text
        const padding = 8
        const holeX = textPos.x - width / 2 - padding
        const holeY = textPos.y - height / 2 - padding
        const holeWidth = width + padding * 2
        const holeHeight = height + padding * 2

        // Update the hole (black rect)
        setAttr(this.maskTextHole!, 'x', String(holeX))
        setAttr(this.maskTextHole!, 'y', String(holeY))
        setAttr(this.maskTextHole!, 'width', String(holeWidth))
        setAttr(this.maskTextHole!, 'height', String(holeHeight))

        // Update the background (white rect)
        setAttr(this.maskRect!, 'x', String(maskX))
        setAttr(this.maskRect!, 'y', String(maskY))
        setAttr(this.maskRect!, 'width', String(maskWidth))
        setAttr(this.maskRect!, 'height', String(maskHeight))

        // Also update the text element position to ensure it stays in sync with the connector
        // The main TextRenderer only updates on completion, but determining the render loop
        // requires updating the element directly for smooth interactions
        if (this.textElement) {
            // Match dimensions from TextRenderer
            const width = 500
            const height = 200
            setAttr(this.textElement, 'x', String(textPos.x - width / 2))
            setAttr(this.textElement, 'y', String(textPos.y - height / 2))
        }
    }

    // Lazily create mask elements when text is first added
    private ensureMaskExists(): void {
        if (this.maskElement) return // Already exists

        // Create mask element
        this.maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'mask')
        const maskId = `mask-${this.id}`
        this.maskElement.setAttribute('id', maskId)
        this.maskElement.setAttribute('maskUnits', 'userSpaceOnUse')
        this.maskElement.setAttribute('maskContentUnits', 'userSpaceOnUse')

        // White rect covers everything (visible)
        this.maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        this.maskRect.setAttribute('fill', 'white')
        this.maskElement.appendChild(this.maskRect)

        // Black rect creates hole for text
        this.maskTextHole = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        this.maskTextHole.setAttribute('fill', 'black')
        this.maskElement.appendChild(this.maskTextHole)

        // Create blockers for arrowheads
        this.maskStartBlocker = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        this.maskStartBlocker.setAttribute('fill', 'black')
        this.maskElement.appendChild(this.maskStartBlocker)

        this.maskEndBlocker = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        this.maskEndBlocker.setAttribute('fill', 'black')
        this.maskElement.appendChild(this.maskEndBlocker)

        // Insert mask before shapeElement in the group
        this.element.insertBefore(this.maskElement, this.shapeElement)

        // Apply mask to the visible connector path
        this.shapeElement.setAttribute('mask', `url(#${maskId})`)
    }

    // Remove mask elements when text is cleared
    private removeMask(): void {
        if (!this.maskElement) return // Already removed

        // Remove mask attribute from path
        this.shapeElement.removeAttribute('mask')

        // Remove mask element from DOM
        this.element.removeChild(this.maskElement)

        // Clear references
        this.maskElement = null
        this.maskRect = null
        this.maskTextHole = null
        this.maskStartBlocker = null
        this.maskEndBlocker = null
    }

    render(): void {
        if (!this.state.needsRender) return

        super.render()

        // Update path arrays (this manages state, not rendering)
        this.updatePath()

        // Sync start/end points from arrays
        this.syncStartEndPoints()

        // Ensure directions are set before building path (needed for gap offset)
        this.ensureDirectionsAreSet()

        // Build and render path from point arrays
        const pathString = this.buildPathFromPoints()

        // Update visible path
        this.shapeElement.setAttribute('d', pathString)

        // Update bounding box to reflect new path geometry
        this.updateBoundingBox()

        // Apply flow animation if enabled
        if (this.animated) {
            this.shapeElement.setAttribute('stroke-dasharray', '10 10')
            this.shapeElement.style.animation = 'flow-animation 1s linear infinite'
        } else {
            // Revert to standard stroke dasharray styles handled by super.render()
            // super.render() sets the attribute based on strokeStyle
            this.shapeElement.style.animation = ''
        }

        // Update hit path
        this.hitPathElement.setAttribute('d', pathString)

        // Update arrowheads (must be after path is set)
        this.updateArrowheads()

        // Update selection indicator and handles
        this.handleManager.updateSelectionIndicator(this.getHandleContext())
        this.handleManager.updateHandleFill(this.getHandleContext())
        this.handleManager.updateHandleFill(this.getHandleContext())
        this.handleManager.updateBentSegmentHandles(this.getHandleContext())

        // Update mask state
        this.updateMask()

        // Handle Draw Style
        if (this.appearance.strokeDrawStyle === 'handdrawn') {
            const group = this.element as SVGGElement
            this.shapeElement.style.display = 'none'
            this.startArrowheadPath.style.display = 'none'
            this.endArrowheadPath.style.display = 'none'

            if (!this.roughElement) {
                this.roughElement = document.createElementNS('http://www.w3.org/2000/svg', 'g')
                group.appendChild(this.roughElement)
            }
            this.roughElement.style.display = 'block'
            this.roughElement.style.opacity = String(this.appearance.strokeOpacity ?? 1)

            // Generate Rough Shape
            const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

            while (this.roughElement.firstChild) {
                this.roughElement.firstChild.remove()
            }

                const svgRoot = this.element.ownerSVGElement
                const roughElement = this.roughElement
                if (svgRoot && roughElement) {
                const rc = rough.svg(svgRoot)
                const options = {
                    ...getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height),
                    stroke: this.appearance.stroke,
                    strokeWidth: this.appearance.strokeWidth,
                    fill: 'none', // Connectors generally don't fill
                    fillStyle: 'hachure',
                    fillWeight: this.appearance.strokeWidth / 2,
                    hachureGap: 4
                }

                // Render main path
                const pathNode = rc.path(pathString, options)
                // Apply stroke-linecap to rough.js generated elements
                pathNode.querySelectorAll('path').forEach((p: SVGPathElement) => {
                    p.setAttribute('stroke-linecap', 'round')
                })
                this.roughElement.appendChild(pathNode)

                // Render arrowheads (respect transform + fill from original paths)
                const renderArrowhead = (pathElement: SVGPathElement) => {
                    const d = pathElement.getAttribute('d')
                    if (!d) return

                    const fill = pathElement.getAttribute('fill') || 'none'
                    const arrowOptions = {
                        ...options,
                        fill,
                        fillStyle: fill === 'none' ? 'hachure' : options.fillStyle
                    }

                    const node = rc.path(d, arrowOptions)
                    const transform = pathElement.getAttribute('transform')
                    if (transform) {
                        node.setAttribute('transform', transform)
                    }
                    node.querySelectorAll('path').forEach((p: SVGPathElement) => {
                        p.setAttribute('stroke-linecap', 'round')
                        p.setAttribute('stroke-linejoin', 'round')
                    })
                    roughElement.appendChild(node)
                }

                renderArrowhead(this.startArrowheadPath)
                renderArrowhead(this.endArrowheadPath)
            }
        } else {
            // Standard
            if (this.roughElement) {
                this.roughElement.style.display = 'none'
            }
            this.shapeElement.style.display = 'block'
            this.startArrowheadPath.style.display = 'block'
            this.endArrowheadPath.style.display = 'block'
        }

        this.state.needsRender = false
    }



    /**
     * Get a point along the connector path at a specific position (0-1)
     * Default implementation mainly for linear segments (Straight/Bent)
     * Curved connectors should override this for better precision
     */
    public getPointAtPosition(t: number): { x: number; y: number } {
        const points = this.getCurrentPoints()
        if (points.length === 0) return { x: 0, y: 0 }
        if (points.length === 1) return points[0]

        // Calculate total length
        let totalLength = 0
        const segmentLengths: number[] = []
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x
            const dy = points[i + 1].y - points[i].y
            const len = Math.sqrt(dx * dx + dy * dy)
            segmentLengths.push(len)
            totalLength += len
        }

        if (totalLength === 0) return points[0]

        // Find segment
        const targetLen = totalLength * t
        let currentLen = 0
        for (let i = 0; i < segmentLengths.length; i++) {
            const len = segmentLengths[i]
            if (currentLen + len >= targetLen) {
                const segmentT = len === 0 ? 0 : (targetLen - currentLen) / len
                const p1 = points[i]
                const p2 = points[i + 1]
                return {
                    x: p1.x + (p2.x - p1.x) * segmentT,
                    y: p1.y + (p2.y - p1.y) * segmentT
                }
            }
            currentLen += len
        }
        return points[points.length - 1]
    }

    /**
     * Get the midpoint for the curved connector handle
     */
    public getCurvedMidpoint(): { x: number; y: number } {
        return this.getPointAtPosition(0.5)
    }

    private getHandleContext(): ConnectorContext {
        return {
            startPoint: this.startPoint,
            endPoint: this.endPoint,
            connectorType: this.connectorType,
            pointsBent: this.pointsBent,
            getBBox: () => this.layout.getBBox(),
            getCurvedMidpoint: () => this.getCurvedMidpoint(),
            startShapeId: this.startShapeId,
            endShapeId: this.endShapeId,
            selected: this.state.selected,
            shouldShowSegmentHandle: this.shouldShowSegmentHandle ? this.shouldShowSegmentHandle.bind(this) : undefined
        }
    }

    setAnimated(animated: boolean) {
        this.animated = animated
        this.state.needsRender = true
    }



    setStartPoint(x: number, y: number) {
        this.startPoint = { x, y }
        this.state.needsRender = true
    }

    setEndPoint(x: number, y: number) {
        this.endPoint = { x, y }
        this.state.needsRender = true
    }







    // Set the shape reference getter (called by DiagramManager)
    private _getShapeById: ((id: string) => DiagramShape | null) | null = null
    private _getAllShapes: (() => DiagramShape[]) | null = null

    setShapeGetter(getter: (id: string) => DiagramShape | null) {
        this._getShapeById = getter
    }

    setAllShapesGetter(getter: () => DiagramShape[]) {
        this._getAllShapes = getter
    }

    // Helper method to get shape by ID
    protected getShapeById(id: string): DiagramShape | null {
        return this._getShapeById ? this._getShapeById(id) : null
    }

    // Helper method to get all shapes (for obstacle detection)
    protected getAllShapes(): DiagramShape[] {
        return this._getAllShapes ? this._getAllShapes() : []
    }

    // Update connector point positions based on attached shapes
    // This is called when shapes move or resize to keep connectors attached
    // If delta is provided, moves by that amount. Otherwise recalculates from shape positions.
    // updateEnd: 'start' | 'end' | 'both' - which end(s) to update when delta is provided
    updateConnectorPoints(dx?: number, dy?: number, updateEnd: 'start' | 'end' | 'both' = 'both') {
        // Update start point if attached to a shape
        if (this.startShapeId && (updateEnd === 'start' || updateEnd === 'both')) {
            const startShape = this.getShapeById(this.startShapeId)
            if (startShape) {
                if (this.startConnectorPoint) {
                    // Attached to a specific connector point - use that point
                    const points = startShape.connectionPoints.getConnectorPoints()
                    this.startPoint = { ...points[this.startConnectorPoint] }
                    this.startConnectorPointDirection = this.startConnectorPoint
                } else {
                    // Attached to an edge - recalculate side dynamically
                    if (dx !== undefined && dy !== undefined) {
                        // Get the current edge direction (use stored if available, otherwise calculate)
                        const currentDirection = this.startConnectorPointDirection || startShape.connectionPoints.getEdgeSide(this.startPoint)
                        
                        // For vertical edges (left/right), move y by dy and keep x on the edge
                        // For horizontal edges (top/bottom), move x by dx and keep y on the edge
                        // This preserves the exact relative position along the edge
                        if (currentDirection === 'left' || currentDirection === 'right') {
                            // Vertical edge: preserve y position (move by dy), x stays on edge
                            const newY = this.startPoint.y + dy
                            const projectedPoint = startShape.connectionPoints.getPointOnEdge(this.startPoint.x, newY, currentDirection)
                            this.startPoint = projectedPoint
                        } else {
                            // Horizontal edge: preserve x position (move by dx), y stays on edge
                            const newX = this.startPoint.x + dx
                            const projectedPoint = startShape.connectionPoints.getPointOnEdge(newX, this.startPoint.y, currentDirection)
                            this.startPoint = projectedPoint
                        }
                        this.startConnectorPointDirection = currentDirection
                    } else {
                        // Recalculate closest edge point (for resize operations)
                        const edgePoint = startShape.connectionPoints.getClosestEdgePoint(this.startPoint.x, this.startPoint.y)
                        this.startPoint = edgePoint
                        // Update connector point direction based on current edge side
                        this.startConnectorPointDirection = startShape.connectionPoints.getEdgeSide(edgePoint)
                    }
                }
            }
        }

        // Update end point if attached to a shape
        if (this.endShapeId && (updateEnd === 'end' || updateEnd === 'both')) {
            const endShape = this.getShapeById(this.endShapeId)
            if (endShape) {
                if (this.endConnectorPoint) {
                    // Attached to a specific connector point - use that point
                    const points = endShape.connectionPoints.getConnectorPoints()
                    this.endPoint = { ...points[this.endConnectorPoint] }
                    this.endConnectorPointDirection = this.endConnectorPoint
                } else {
                    // Attached to an edge - recalculate side dynamically
                    if (dx !== undefined && dy !== undefined) {
                        // Get the current edge direction (use stored if available, otherwise calculate)
                        const currentDirection = this.endConnectorPointDirection || endShape.connectionPoints.getEdgeSide(this.endPoint)
                        
                        // For vertical edges (left/right), move y by dy and keep x on the edge
                        // For horizontal edges (top/bottom), move x by dx and keep y on the edge
                        // This preserves the exact relative position along the edge
                        if (currentDirection === 'left' || currentDirection === 'right') {
                            // Vertical edge: preserve y position (move by dy), x stays on edge
                            const newY = this.endPoint.y + dy
                            const projectedPoint = endShape.connectionPoints.getPointOnEdge(this.endPoint.x, newY, currentDirection)
                            this.endPoint = projectedPoint
                        } else {
                            // Horizontal edge: preserve x position (move by dx), y stays on edge
                            const newX = this.endPoint.x + dx
                            const projectedPoint = endShape.connectionPoints.getPointOnEdge(newX, this.endPoint.y, currentDirection)
                            this.endPoint = projectedPoint
                        }
                        this.endConnectorPointDirection = currentDirection
                    } else {
                        // Recalculate closest edge point (for resize operations)
                        const edgePoint = endShape.connectionPoints.getClosestEdgePoint(this.endPoint.x, this.endPoint.y)
                        this.endPoint = edgePoint
                        // Update connector point direction based on current edge side
                        this.endConnectorPointDirection = endShape.connectionPoints.getEdgeSide(edgePoint)
                    }
                }
            }
        }

        this.state.needsRender = true
    }



    /**
     * Set the label position along the path
     * @param ratio Value from 0.0 (start) to 1.0 (end)
     */
    setLabelPosition(ratio: number): void {
        this.labelPosition = Math.max(0, Math.min(1, ratio))
        this.state.needsRender = true
    }

    /**
     * Find the closest position (ratio) on the path for a given point
     */
    public getClosestPositionOnPath(point: { x: number; y: number }): number {
        const points = this.getCurrentPoints()
        if (points.length < 2) return 0.5

        let minDist = Infinity
        let closestT = 0.5
        let totalLength = 0

        const segmentLengths: number[] = []
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x
            const dy = points[i + 1].y - points[i].y
            const len = Math.sqrt(dx * dx + dy * dy)
            segmentLengths.push(len)
            totalLength += len
        }

        if (totalLength === 0) return 0.5

        let currentLen = 0
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i]
            const p2 = points[i + 1]
            const len = segmentLengths[i]

            if (len === 0) continue

            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            const t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (len * len)
            const clampedT = Math.max(0, Math.min(1, t))

            const projX = p1.x + clampedT * dx
            const projY = p1.y + clampedT * dy
            const dist = Math.sqrt(Math.pow(projX - point.x, 2) + Math.pow(projY - point.y, 2))

            if (dist < minDist) {
                minDist = dist
                closestT = (currentLen + clampedT * len) / totalLength
            }
            currentLen += len
        }

        return Math.max(0, Math.min(1, closestT))
    }





    // Override selection indicator to show handles instead of box when single selected
    createSelectionIndicator(): SVGGraphicsElement {
        return this.handleManager.createSelectionIndicator(this.getHandleContext())
    }

    setSelectionMode(mode: 'handles' | 'box') {
        this.handleManager.setSelectionMode(mode, this.getHandleContext())
    }

    updateSelectionIndicator() {
        this.handleManager.updateSelectionIndicator(this.getHandleContext())
    }

    hideSelectionIndicator(): void {
        this.handleManager.hideSelectionIndicator(this.getHandleContext())
    }

    // Update handle fill color based on attachment state
    // Handles should be filled with active color when attached to a shape
    updateHandleFill() {
        this.handleManager.updateHandleFill(this.getHandleContext())
    }

    // Update handle scale to maintain constant pixel size regardless of zoom
    updateScale(scale: number): void {
        this.handleManager.updateScale(scale, this.getHandleContext())
    }

    /**
     * Set the segment currently being dragged.
     * When set, only that segment's handle will be shown.
     * Pass -1 to clear and show all handles.
     */
    setDraggingSegment(segmentIndex: number): void {
        this.handleManager.setDraggingSegment(segmentIndex, this.getHandleContext())
    }

    // Abstract method for type-specific intersection testing
    // Abstract method for type-specific intersection testing
    public intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean {
        const points = this.getCurrentPoints()
        for (let i = 0; i < points.length - 1; i++) {
            if (lineIntersectsRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, rect)) return true
        }
        return false
    }

    // Helper method to calculate start and end directions based on relative positions
    protected getDirections(): { startDirection: ConnectorDirection; endDirection: ConnectorDirection } {
        const { startDefaultDirection, endDefaultDirection } = this.defaultDynamicDirections(this.startPoint, this.endPoint)
        const startDirection = this.resolveConnectorDirection('start', startDefaultDirection)
        const endDirection = this.resolveConnectorDirection('end', endDefaultDirection)
        this.startConnectorPointDirection = startDirection
        this.endConnectorPointDirection = endDirection
        return { startDirection, endDirection }
    }

    private resolveConnectorDirection(which: 'start' | 'end', fallback: ConnectorDirection): ConnectorDirection {
        const shapeId = which === 'start' ? this.startShapeId : this.endShapeId
        const lockedDirection = which === 'start' ? this.startConnectorPoint : this.endConnectorPoint
        const referencePoint = which === 'start' ? this.startPoint : this.endPoint

        if (lockedDirection) {
            return lockedDirection
        }

        if (shapeId) {
            const shape = this.getShapeById(shapeId)
            if (shape) {
                return shape.connectionPoints.getEdgeSide(referencePoint)
            }
        }

        return fallback
    }

    protected defaultDynamicDirections(startPoint: { x: number, y: number }, endPoint: { x: number, y: number }): { startDefaultDirection: ConnectorDirection, endDefaultDirection: ConnectorDirection } {
        return defaultDynamicDirections(startPoint, endPoint)
    }

    // Check if the start and end connector point directions are the same as the dynamic default directions
    protected isDynamicDefaultDirectionPoints(startDirection: ConnectorDirection | null | undefined, endDirection: ConnectorDirection | null | undefined) {
        const defaultDirections = this.defaultDynamicDirections(this.startPoint, this.endPoint)

        if (startDirection === defaultDirections.startDefaultDirection && endDirection === defaultDirections.endDefaultDirection) {
            return true
        }

        return false
    }

    protected isFixedDefaultDirectionPoints(startDirection: ConnectorDirection | null | undefined, endDirection: ConnectorDirection | null | undefined) {
        const opposites: Record<ConnectorDirection, ConnectorDirection> = {
            top: 'bottom',
            bottom: 'top',
            left: 'right',
            right: 'left'
        }

        if (
            startDirection &&
            endDirection &&
            opposites[startDirection] === endDirection
        ) {
            return true;
        }

        return false
    }
    // Helper method for line segment intersection testing (used by subclasses)
    protected lineIntersectsRect(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        rect: { x: number; y: number; width: number; height: number }
    ): boolean {
        return lineIntersectsRect(x1, y1, x2, y2, rect)
    }
}

