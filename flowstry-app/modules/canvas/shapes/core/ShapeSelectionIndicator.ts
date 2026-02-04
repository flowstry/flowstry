import { DiagramShape } from '../base'

export class ShapeSelectionIndicator {
    private shape: DiagramShape
    private element: SVGGraphicsElement | null = null

    constructor(shape: DiagramShape) {
        this.shape = shape
    }

    /**
     * Show the selection indicator
     */
    show() {
        if (typeof (this.shape as any).showSelectionIndicator === 'function') {
            (this.shape as any).showSelectionIndicator()
        }

        if (!this.element) {
            this.element = this.createIndicator()
            // Append indicator after the shape element so it appears on top
            this.shape.element.appendChild(this.element)
        }
        this.element.style.display = ''
        this.update()
    }

    /**
     * Hide the selection indicator
     */
    hide() {
        if (typeof (this.shape as any).hideSelectionIndicator === 'function') {
            (this.shape as any).hideSelectionIndicator()
        }

        if (this.element) {
            this.element.style.display = 'none'
        }
    }

    /**
     * Update the selection indicator position/size
     */
    update() {
        // Delegate to shape if it has custom update logic (e.g. Connectors)
        if (typeof (this.shape as any).updateSelectionIndicator === 'function') {
            (this.shape as any).updateSelectionIndicator()
            return
        }

        if (!this.element) return

        const bbox = this.shape.layout.getBBox()
        this.element.setAttribute('x', String(bbox.x))
        this.element.setAttribute('y', String(bbox.y))
        this.element.setAttribute('width', String(bbox.width))
        this.element.setAttribute('height', String(bbox.height))
    }

    /**
     * Create the localized selection indicator element
     */
    private createIndicator(): SVGGraphicsElement {
        // Allow shape to override indicator creation (e.g. for Connectors)
        if (typeof (this.shape as any).createSelectionIndicator === 'function') {
             return (this.shape as any).createSelectionIndicator()
        }

        const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const bbox = this.shape.layout.getBBox()
        indicator.setAttribute('x', String(bbox.x))
        indicator.setAttribute('y', String(bbox.y))
        indicator.setAttribute('width', String(bbox.width))
        indicator.setAttribute('height', String(bbox.height))
        indicator.setAttribute('fill', 'none')
        indicator.setAttribute('stroke', '#60a5fa') // Light blue color
        indicator.setAttribute('stroke-width', '2')
        indicator.setAttribute('pointer-events', 'none')
        indicator.setAttribute('data-export-ignore', 'true')
        return indicator
    }
    
    /**
     * Direct access to the indicator element if needed
     */
    get indicatorElement(): SVGGraphicsElement | null {
        return this.element
    }
}
