import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape } from '../base'

export class OctagonShape extends DiagramShape {
	constructor(
		x: number,
		y: number,
		width = 1,
		height = 1,
		fill = '#ffffff',
		stroke = '#575757',
		strokeWidth = 4
	) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path')
		super('octagon', path, x, y, width, height)

		this.appearance.fill = fill
		this.appearance.stroke = stroke
		this.appearance.strokeWidth = strokeWidth
		path.setAttribute('stroke-linejoin', 'round')

		// Custom text bounds (approximate inscribed rectangle)
		this.shapeText.boundsCalculator = () => {
			const factor = 0.7
			return {
				width: Math.max(1, this.layout.width * factor),
				height: Math.max(1, this.layout.height * factor)
			}
		}
	}

	private buildPath(): string {
		const w = Math.max(1, this.layout.width)
		const h = Math.max(1, this.layout.height)
		const cornerSize = Math.min(w, h) * 0.3 // 30% of the smaller dimension

		// Create octagon with flat top and bottom, corners cut at 45 degrees
		const points = [
			`M ${this.layout.x + cornerSize} ${this.layout.y}`,
			`L ${this.layout.x + w - cornerSize} ${this.layout.y}`,
			`L ${this.layout.x + w} ${this.layout.y + cornerSize}`,
			`L ${this.layout.x + w} ${this.layout.y + h - cornerSize}`,
			`L ${this.layout.x + w - cornerSize} ${this.layout.y + h}`,
			`L ${this.layout.x + cornerSize} ${this.layout.y + h}`,
			`L ${this.layout.x} ${this.layout.y + h - cornerSize}`,
			`L ${this.layout.x} ${this.layout.y + cornerSize}`,
			'Z'
		]

		return points.join(' ')
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

		const hasHanddrawnStroke = strokeStyle === 'handdrawn'
		const hasHanddrawnFill = fillStyle === 'handdrawn'

		// 1. Standard SVG Element (Path)
		// This path element will render standard fills/strokes or act as a placeholder for roughjs
		path.style.display = 'block'

		// Handle Fill presence
		if (hasHanddrawnFill || shouldRenderRoughFill) {
			path.setAttribute('fill', 'none')
			path.setAttribute('fill-opacity', '0')
		} else {
			const hasFill = this.appearance.fillStyle !== 'none'
			path.setAttribute('fill', hasFill ? this.appearance.fill : 'none')
			path.setAttribute('fill-opacity', hasFill ? String(this.appearance.fillOpacity) : '0')
		}

		// Handle Stroke presence
		if (hasHanddrawnStroke) {
			path.setAttribute('stroke', 'none')
			path.setAttribute('stroke-width', '0')
		} else {
			const hasStroke = this.appearance.strokeStyle !== 'none'
			path.setAttribute('stroke', hasStroke ? this.appearance.stroke : 'none')
			path.setAttribute('stroke-width', hasStroke ? String(this.appearance.strokeWidth) : '0')
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
		}

		// 2. RoughJS Elements (Handdrawn Fill/Stroke)
		const hasRoughElements = hasHanddrawnFill || hasHanddrawnStroke || shouldRenderRoughFill

		if (hasRoughElements) {
			if (!this.roughElement) {
				this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
				group.insertBefore(this.roughElement, path)
			}
			this.roughElement.style.display = 'block'

			// Generate Rough Shape
			const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

			while (this.roughElement.firstChild) {
				this.roughElement.firstChild.remove()
			}

			const svgRoot = this.element.ownerSVGElement
			if (svgRoot) {
				const rc = rough.svg(svgRoot)

				// 2. Rough Fill Element (Handdrawn Fill)
				if ((hasHanddrawnFill || shouldRenderRoughFill) && this.appearance.fillStyle !== 'none') {
					const node = rc.path(d, {
						...getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height),
						stroke: 'none',
						fill: this.appearance.fill,
						fillStyle: this.appearance.fillStyle === 'solid' ? 'solid' : 'hachure',
						fillWeight: this.appearance.strokeWidth / 2,
						hachureGap: 4
					})
					node.setAttribute('opacity', String(this.appearance.fillOpacity ?? 1))
					this.roughElement.appendChild(node)
				}

				// 2. Render Rough Stroke
				if (strokeStyle === 'handdrawn' && this.appearance.strokeStyle !== 'none') {
					const node = rc.path(d, {
						...getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height),
						stroke: this.appearance.stroke,
						strokeWidth: this.appearance.strokeWidth,
						fill: 'none'
					})
					node.setAttribute('opacity', String(this.appearance.strokeOpacity ?? 1))
					// Apply stroke-linecap to rough.js generated elements
					node.querySelectorAll('path').forEach((p: SVGPathElement) => {
						p.setAttribute('stroke-linecap', 'round')
					})
					this.roughElement.appendChild(node)
				}
			}
		} else {
			// Standard
			if (this.roughElement) {
				this.roughElement.style.display = 'none'
			}
			path.style.display = 'block'
			// Standard attributes set above
		}
		
		this.state.needsRender = false
	}


}
