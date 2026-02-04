import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape } from '../base'

export class DiamondShape extends DiagramShape {
	constructor(x: number, y: number, width = 1, height = 1, fill = '#ffffff', stroke = '#575757', strokeWidth = 4) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path')
		super('diamond', path, x, y, width, height)
		// Set initial state
		this.appearance.fill = fill
		this.appearance.stroke = stroke
		this.appearance.strokeWidth = strokeWidth
		// make corners more rounded
		path.setAttribute('stroke-linejoin', 'round')
		path.setAttribute('stroke-linecap', 'round')
		// Initial render will happen via render loop

		// Configure text bounds calculator (50% of dimensions fits inside the diamond)
		this.shapeText.boundsCalculator = () => ({
			width: this.layout.width / 2,
			height: this.layout.height / 2
		})
	}

	// Build a rounded-diamond path. Corner roundness scales with the smallest dimension.
	private buildPath(): string {
		const w = Math.max(1, this.layout.width)
		const h = Math.max(1, this.layout.height)
		const center = this.layout.center
		const top = { x: center.x, y: this.layout.y }
		const right = { x: this.layout.x + w, y: center.y }
		const bottom = { x: center.x, y: this.layout.y + h }
		const left = { x: this.layout.x, y: center.y }

		// Fixed corner radius in SVG units (px in world coordinates)
		const radius = 10
		// distance from corner along each edge to start/end rounding
		const edgeLen = Math.hypot(w / 2, h / 2) || 1
		// fraction along each edge corresponding to the fixed radius
		const t = Math.min(0.49, radius / edgeLen)

		const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, tt: number) => ({
			x: a.x + (b.x - a.x) * tt,
			y: a.y + (b.y - a.y) * tt,
		})

		// Points on edges entering/leaving each corner (clockwise)
		const top_to_right = lerp(top, right, t)
		const right_to_top = lerp(right, top, t)
		const right_to_bottom = lerp(right, bottom, t)
		const bottom_to_right = lerp(bottom, right, t)
		const bottom_to_left = lerp(bottom, left, t)
		const left_to_bottom = lerp(left, bottom, t)
		const left_to_top = lerp(left, top, t)
		const top_to_left = lerp(top, left, t)

		// Quadratic arcs with the diamond corners as controls
		const d = [
			`M ${top_to_right.x} ${top_to_right.y}`,               // start on top edge near right
			`L ${right_to_top.x} ${right_to_top.y}`,               // line to start of right-corner arc
			`Q ${right.x} ${right.y} ${right_to_bottom.x} ${right_to_bottom.y}`, // arc around right
			`L ${bottom_to_right.x} ${bottom_to_right.y}`,         // line to start of bottom-corner arc
			`Q ${bottom.x} ${bottom.y} ${bottom_to_left.x} ${bottom_to_left.y}`, // arc bottom
			`L ${left_to_bottom.x} ${left_to_bottom.y}`,           // line to start of left-corner arc
			`Q ${left.x} ${left.y} ${left_to_top.x} ${left_to_top.y}`,           // arc left
			`L ${top_to_left.x} ${top_to_left.y}`,                 // line to start of top-corner arc
			`Q ${top.x} ${top.y} ${top_to_right.x} ${top_to_right.y}`,           // arc top back to start
			'Z',
		].join(' ')

		return d
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
