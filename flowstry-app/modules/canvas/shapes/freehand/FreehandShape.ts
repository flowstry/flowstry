import { DiagramShape, ShapeName } from '../base'

export type FreehandMarkerType = 'brush' | 'pen' | 'pencil' | 'highlighter'

// Marker type configurations
export interface MarkerConfig {
  strokeWidth: number
  opacity: number
  lineCap: 'round' | 'square'
  label: string
}

export const MARKER_CONFIGS: Record<FreehandMarkerType, MarkerConfig> = {
  brush: {
    strokeWidth: 8,
    opacity: 0.8,
    lineCap: 'round',
    label: 'Brush'
  },
  pen: {
    strokeWidth: 3,
    opacity: 1,
    lineCap: 'round',
    label: 'Pen'
  },
  pencil: {
    strokeWidth: 2,
    opacity: 0.7,
    lineCap: 'round',
    label: 'Pencil'
  },
  highlighter: {
    strokeWidth: 16,
    opacity: 0.4,
    lineCap: 'square',
    label: 'Highlighter'
  }
}

// Freehand shape for pencil/drawing tool
export class FreehandShape extends DiagramShape {
  markerType: FreehandMarkerType
  points: Array<{ x: number; y: number }> = []
  private isInternalUpdate: boolean = false

  constructor(
    points: Array<{ x: number; y: number }>,
    markerType: FreehandMarkerType = 'pen'
  ) {
    // Create the path element
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pathElement.setAttribute('fill', 'none')
    pathElement.setAttribute('stroke-linejoin', 'round')

    // Calculate bounding box from points
    const bounds = FreehandShape.calculateBounds(points)

    super('freehand' as ShapeName, pathElement, bounds.x, bounds.y, bounds.width, bounds.height)

    this.points = points
    this.markerType = markerType

    // Freehand shapes should have no fill - only stroke
    this.appearance.fillStyle = 'none'
    
    // Set default stroke color (black) if not already set
    if (!this.appearance.stroke || this.appearance.stroke === 'transparent') {
      this.appearance.stroke = '#000000'
    }

    // Apply marker-specific styles
    this.applyMarkerStyle()

    // Initial render
    this.updatePath()

    // Listen for layout changes to update points
    this.layout.addOnChange((change) => {
      if (this.isInternalUpdate) return

      // Handle scaling (width or height changed)
      if (change.newWidth !== change.prevWidth || change.newHeight !== change.prevHeight) {
        const scaleX = change.newWidth / Math.max(1, change.prevWidth)
        const scaleY = change.newHeight / Math.max(1, change.prevHeight)

        this.points = this.points.map(point => ({
          x: change.newX + (point.x - change.prevX) * scaleX,
          y: change.newY + (point.y - change.prevY) * scaleY
        }))
      }
      // Handle translation (only x/y changed)
      else if (change.newX !== change.prevX || change.newY !== change.prevY) {
        const dx = change.newX - change.prevX
        const dy = change.newY - change.prevY
        this.points = this.points.map(point => ({
          x: point.x + dx,
          y: point.y + dy
        }))
      }

      this.state.needsRender = true
    })
  }

  /**
   * Calculate bounding box from points array
   */
  static calculateBounds(points: Array<{ x: number; y: number }>): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 1, height: 1 }
    }

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

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    }
  }

  /**
   * Apply marker-specific visual styles
   */
  applyMarkerStyle(): void {
    const config = MARKER_CONFIGS[this.markerType]
    this.appearance.strokeWidth = config.strokeWidth
    this.appearance.strokeOpacity = config.opacity
    this.shapeElement.setAttribute('stroke-linecap', config.lineCap)
    this.state.needsRender = true
  }

  /**
   * Set marker type and update visual style
   */
  setMarkerType(type: FreehandMarkerType): void {
    if (this.markerType !== type) {
      this.markerType = type
      this.applyMarkerStyle()
    }
  }

  /**
   * Add a point to the path
   */
  addPoint(x: number, y: number): void {
    this.points.push({ x, y })
    this.updateBoundsFromPoints()
    this.state.needsRender = true
  }

  /**
   * Update bounding box from current points
   */
  private updateBoundsFromPoints(): void {
    const bounds = FreehandShape.calculateBounds(this.points)
    // Add stroke width padding directly to layout for accurate selection
    const padding = this.appearance.strokeWidth / 2
    this.isInternalUpdate = true
    this.layout.updateBounds(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + this.appearance.strokeWidth,
      bounds.height + this.appearance.strokeWidth
    )
    this.isInternalUpdate = false
  }

  /**
   * Build SVG path string from points
   */
  private buildPathFromPoints(): string {
    if (this.points.length === 0) {
      return ''
    }

    if (this.points.length === 1) {
      // Single point - draw a dot
      const p = this.points[0]
      return `M ${p.x} ${p.y} L ${p.x} ${p.y}`
    }

    // Use Catmull-Rom spline for smooth curves
    return this.buildSmoothPath()
  }

  /**
   * Build a smooth path using Catmull-Rom spline interpolation
   */
  private buildSmoothPath(): string {
    const points = this.points
    if (points.length < 2) return ''

    // For very few points, use simple lines
    if (points.length < 4) {
      let d = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`
      }
      return d
    }

    // Use Catmull-Rom to Bezier conversion for smooth curves
    let d = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[0]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = i + 2 < points.length ? points[i + 2] : p2

      // Convert Catmull-Rom to cubic Bezier
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }

    return d
  }

  /**
   * Update the SVG path element
   */
  private updatePath(): void {
    const d = this.buildPathFromPoints()
    this.shapeElement.setAttribute('d', d)
  }

  /**
   * Override render to update path
   */
  render(): void {
    if (!this.state.needsRender) return

    // Apply marker style before rendering
    const config = MARKER_CONFIGS[this.markerType]
    this.shapeElement.setAttribute('stroke-linecap', config.lineCap)

    super.render()
    this.updatePath()
  }

  /**
   * Override resize to scale points
   */


  /**
   * Override getBBox to return accurate bounds
   */


  copy(): DiagramShape {
    // deep clone points
    const newPoints = this.points.map(p => ({ x: p.x, y: p.y }));
    const newShape = new FreehandShape(newPoints, this.markerType);
    newShape.copyFrom(this);
    return newShape;
  }
}
