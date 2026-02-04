import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape } from '../base'

export class EllipseShape extends DiagramShape {
	constructor(x: number, y: number, width = 1, height = 1, fill = '#ffffff', stroke = '#575757', strokeWidth = 4) {
		const ellipse = document.createElementNS(SVG_NAMESPACE, 'ellipse')
		super('ellipse', ellipse, x, y, width, height)
		this.appearance.fill = fill
		this.appearance.stroke = stroke
		this.appearance.strokeWidth = strokeWidth

		// Configure text bounds calculator for inscribed rectangle
		this.shapeText.boundsCalculator = () => ({
			width: this.layout.width / Math.sqrt(2),
			height: this.layout.height / Math.sqrt(2)
		})
	}

	render(): void {
		if (!this.state.needsRender) return
		
		super.render()
		
		const group = this.element as SVGGElement
		const ellipse = this.shapeElement as SVGEllipseElement
		const center = this.layout.center

		// Update standard ellipse
		ellipse.setAttribute('cx', String(center.x))
		ellipse.setAttribute('cy', String(center.y))
		ellipse.setAttribute('rx', String(Math.max(0.5, this.layout.width / 2)))
		ellipse.setAttribute('ry', String(Math.max(0.5, this.layout.height / 2)))

		// Handle Draw Style Logic
		const fillStyle = this.appearance.fillDrawStyle || 'standard'
		const strokeStyle = this.appearance.strokeDrawStyle || 'standard'
		const shouldRenderRoughFill = this.appearance.fillStyle === 'hachure' || this.appearance.fillStyle === 'cross-hatch'

		// 1. Standard SVG Element (Ellipse)
		if (fillStyle === 'standard' || strokeStyle === 'standard') {
			ellipse.style.display = 'block'

			// Handle Fill presence on standard ellipse
			if (fillStyle === 'standard' && !shouldRenderRoughFill) {
				const hasFill = this.appearance.fillStyle !== 'none'
				this.element.setAttribute('fill', hasFill ? this.appearance.fill : 'none')
				this.element.setAttribute('fill-opacity', hasFill ? String(this.appearance.fillOpacity) : '0')
			} else {
				this.element.setAttribute('fill', 'none')
			}

			// Handle Stroke presence on standard ellipse
			if (strokeStyle === 'standard') {
				const hasStroke = this.appearance.strokeStyle !== 'none'
				ellipse.setAttribute('stroke', hasStroke ? this.appearance.stroke : 'none')
				ellipse.setAttribute('stroke-width', String(this.appearance.strokeWidth))
				ellipse.setAttribute('stroke-opacity', String(this.appearance.strokeOpacity))
				ellipse.setAttribute('stroke-linecap', 'round')

				// Map stroke style to dasharray (scaled to strokeWidth)
				const sw = this.appearance.strokeWidth
				if (this.appearance.strokeStyle === 'dashed') {
					ellipse.setAttribute('stroke-dasharray', `16 ${16 + sw}`)
				} else if (this.appearance.strokeStyle === 'dotted') {
					ellipse.setAttribute('stroke-dasharray', `${Math.max(1, sw * 0.5)} ${sw * 2.2}`)
				} else {
					ellipse.removeAttribute('stroke-dasharray')
				}
			} else {
				ellipse.setAttribute('stroke', 'none')
			}
		} else {
			ellipse.style.display = 'none'
		}

		const svgRoot = this.element.ownerSVGElement
		const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

		// 2. Rough Fill Element (Handdrawn Fill)
		if (shouldRenderRoughFill && svgRoot) {
			if (!this.roughElement) {
				this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
				group.insertBefore(this.roughElement, ellipse)
			}
			this.roughElement.style.display = 'block'
			this.roughElement.style.opacity = String(this.appearance.fillOpacity ?? 1)

			while (this.roughElement.firstChild) this.roughElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const options = getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height)
			options.stroke = 'none'

			const node = rc.ellipse(
				center.x, center.y,
				this.layout.width, this.layout.height,
				options
			)
			this.roughElement.appendChild(node)
		} else if (this.roughElement) {
			this.roughElement.style.display = 'none'
		}

		// 3. Rough Stroke Element (Handdrawn Stroke)
		if (strokeStyle === 'handdrawn' && svgRoot) {
			if (!this.roughStrokeElement) {
				this.roughStrokeElement = document.createElementNS(SVG_NAMESPACE, 'g')
				group.insertBefore(this.roughStrokeElement, ellipse.nextSibling)
			}
			this.roughStrokeElement.style.display = 'block'
			this.roughStrokeElement.style.opacity = String(this.appearance.strokeOpacity ?? 1)

			while (this.roughStrokeElement.firstChild) this.roughStrokeElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const options = getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height)
			options.fill = 'none'
			options.fillStyle = 'solid'

			const node = rc.ellipse(
				center.x, center.y,
				this.layout.width, this.layout.height,
				options
			)

			// Apply stroke-linecap to rough.js generated elements
			node.querySelectorAll('path').forEach((p: SVGPathElement) => {
				p.setAttribute('stroke-linecap', 'round')
			})

			this.roughStrokeElement.appendChild(node)
		} else if (this.roughStrokeElement) {
			this.roughStrokeElement.style.display = 'none'
		}
		
		this.state.needsRender = false
	}


}
