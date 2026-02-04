import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape, type ShapeName } from '../base'

export class PolygonShape extends DiagramShape {
	private sides: number

	constructor(
		type: ShapeName,
		sides: number,
		x: number,
		y: number,
		width = 1,
		height = 1,
		fill = '#ffffff',
		stroke = '#575757',
		strokeWidth = 4
	) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path')
		super(type, path, x, y, width, height)

		this.sides = sides
		this.appearance.fill = fill
		this.appearance.stroke = stroke
		this.appearance.strokeWidth = strokeWidth
		path.setAttribute('stroke-linejoin', 'round')

		// Custom text bounds (approximate inscribed rectangle)
		this.shapeText.boundsCalculator = () => {
			const factor = 0.6
			return {
				width: Math.max(1, this.layout.width * factor),
				height: Math.max(1, this.layout.height * factor)
			}
		}
	}

	private buildPath(): string {
		const center = this.layout.center
		const rx = this.layout.width / 2
		const ry = this.layout.height / 2
		const startAngle = -Math.PI / 2 // Start from top
		
		const points: string[] = []
		for (let i = 0; i < this.sides; i++) {
			const angle = startAngle + (i * 2 * Math.PI) / this.sides
			const px = center.x + rx * Math.cos(angle)
			const py = center.y + ry * Math.sin(angle)
			points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
		}
		
		return points.join(' ') + ' Z'
	}



	render(): void {
		if (!this.state.needsRender) return
		
		super.render()
		
		const group = this.element as SVGGElement
		const path = this.shapeElement as SVGPathElement
		const d = this.buildPath()
		path.setAttribute('d', d)

		// Handle Draw Style Logic
		const fillStyle = this.appearance.fillDrawStyle || 'standard'
		const strokeStyle = this.appearance.strokeDrawStyle || 'standard'

		const shouldRenderRoughFill = this.appearance.fillStyle === 'hachure' || this.appearance.fillStyle === 'cross-hatch'

		// 1. Standard SVG Element (Path)
		if (fillStyle === 'standard' || strokeStyle === 'standard') {
			path.style.display = 'block'

			// Handle Fill presence
			if (fillStyle === 'standard' && !shouldRenderRoughFill) {
				const hasFill = this.appearance.fillStyle !== 'none'
				path.setAttribute('fill', hasFill ? this.appearance.fill : 'none')
				path.setAttribute('fill-opacity', hasFill ? String(this.appearance.fillOpacity) : '0')
			} else {
				path.setAttribute('fill', 'none')
			}

			// Handle Stroke presence
			if (strokeStyle === 'standard') {
				const hasStroke = this.appearance.strokeStyle !== 'none'
				path.setAttribute('stroke', hasStroke ? this.appearance.stroke : 'none')
				path.setAttribute('stroke-width', String(this.appearance.strokeWidth))
				path.setAttribute('stroke-opacity', String(this.appearance.strokeOpacity))
				path.setAttribute('stroke-linecap', 'round')

				// Map stroke style to dasharray (scaled to strokeWidth)
				const sw = this.appearance.strokeWidth
				if (this.appearance.strokeStyle === 'dashed') {
					path.setAttribute('stroke-dasharray', `16 ${16 + sw}`)
				} else if (this.appearance.strokeStyle === 'dotted') {
					path.setAttribute('stroke-dasharray', `${Math.max(1, sw * 0.5)} ${sw * 2.2}`)
				} else {
					path.removeAttribute('stroke-dasharray')
				}
			} else {
				path.setAttribute('stroke', 'none')
			}
		} else {
			path.style.display = 'none'
		}

		const svgRoot = this.element.ownerSVGElement
		const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

		// 2. Rough Fill Element (Handdrawn Fill)
		if (shouldRenderRoughFill && svgRoot) {
			if (!this.roughElement) {
				this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
				group.insertBefore(this.roughElement, path)
			}
			this.roughElement.style.display = 'block'
			this.roughElement.style.opacity = String(this.appearance.fillOpacity ?? 1)

			while (this.roughElement.firstChild) this.roughElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const options = getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height)
			options.stroke = 'none'

			const node = rc.path(d, options)
			this.roughElement.appendChild(node)
		} else if (this.roughElement) {
			this.roughElement.style.display = 'none'
		}

		// 3. Rough Stroke Element (Handdrawn Stroke)
		if (strokeStyle === 'handdrawn' && svgRoot) {
			if (!this.roughStrokeElement) {
				this.roughStrokeElement = document.createElementNS(SVG_NAMESPACE, 'g')
				group.insertBefore(this.roughStrokeElement, path.nextSibling)
			}
			this.roughStrokeElement.style.display = 'block'
			this.roughStrokeElement.style.opacity = String(this.appearance.strokeOpacity ?? 1)

			while (this.roughStrokeElement.firstChild) this.roughStrokeElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const options = getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height)
			options.fill = 'none'
			options.fillStyle = 'solid'

			const node = rc.path(d, options)

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
