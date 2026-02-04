import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape } from '../base'

export class RectangleShape extends DiagramShape {
	public iconContent: string | null = null
	public isIconEditing: boolean = false
	public hasIconPlaceholder: boolean = false
	private iconElement: SVGImageElement | SVGGElement | null = null
	private iconBorderElement: SVGRectElement | null = null
	private iconClipPath: SVGClipPathElement | null = null
	private placeholderElement: SVGRectElement | null = null

	constructor(x: number, y: number, width = 1, height = 1, fill = '#ffffff', stroke = '#575757', strokeWidth = 4) {
		const group = document.createElementNS(SVG_NAMESPACE, 'g')
		const rect = document.createElementNS(SVG_NAMESPACE, 'rect')
		group.appendChild(rect)

		super('rectangle', group, x, y, width, height)
		this.shapeElement = rect // Keep reference to the main rect for styling

		this.appearance.fill = fill
		this.appearance.stroke = stroke
		this.appearance.strokeWidth = strokeWidth
		rect.setAttribute('rx', '12')
		rect.setAttribute('ry', '12')

		// Configure text bounds calculator to account for icon
		this.shapeText.boundsCalculator = () => {
			// Uniform padding for text
			const textPadding = 12 

			if (this.iconContent || this.hasIconPlaceholder) {
				const iconSize = Math.min(this.layout.height * 0.6, 60)
				const iconPadding = 12
				// Space taken by icon on the left (padding + icon + padding)
				const iconSpace = iconSize + iconPadding * 2

				// Available width is total width minus icon space minus right padding
				// We strip padding from both vertical sides too for safety, though height logic is usually looser
				return {
					width: Math.max(1, this.layout.width - iconSpace - textPadding),
					height: Math.max(1, this.layout.height - textPadding * 2)
				}
			}
			return {
				width: Math.max(1, this.layout.width - textPadding * 2),
				height: Math.max(1, this.layout.height - textPadding * 2)
			}
		}

		// Configure text position calculator to center text in the remaining space
		this.shapeText.positionCalculator = () => {
			if (this.iconContent || this.hasIconPlaceholder) {
				const iconSize = Math.min(this.layout.height * 0.6, 60)
				const iconPadding = 12
				const iconSpace = iconSize + iconPadding * 2
				const textPadding = 12

				// Center of the remaining space (taking right padding into account)
				const availableWidth = this.layout.width - iconSpace - textPadding
				return {
					x: this.layout.x + iconSpace + availableWidth / 2,
					y: this.layout.y + this.layout.height / 2
				}
			}
			// Default center
			return {
				x: this.layout.x + this.layout.width / 2,
				y: this.layout.y + this.layout.height / 2
			}
		}
	}

	render(): void {
		if (!this.state.needsRender) return
		
		super.render()
		
		const group = this.element as SVGGElement
		const rect = this.shapeElement as SVGRectElement

		// Update main rectangle (keep it updated for layout/hit testing even if hidden)
		rect.setAttribute('x', String(this.layout.x))
		rect.setAttribute('y', String(this.layout.y))
		rect.setAttribute('width', String(Math.max(1, this.layout.width)))
		rect.setAttribute('height', String(Math.max(1, this.layout.height)))
		
		// Handle Draw Style Logic
		const fillStyle = this.appearance.fillDrawStyle || 'standard'
		const strokeStyle = this.appearance.strokeDrawStyle || 'standard'

		// Fill rendering
		// Rough fill is used if:
		// 1. fillStyle implies it (hachure, cross-hatch) - THESE ARE INHERENTLY HANDDRAWN
		// 2. OR fillDrawStyle is handdrawn AND fillStyle is not 'none' (though user said solid is never handdrawn, let's stick to the specific "hachure/cross-hatch" rule for now as primary trigger)
		// Actually, user said: "solid: Should render normally... hachure/cross-hatch: imply hand-drawn".
		// So we primarily check if fillStyle is hachure or cross-hatch.
		const shouldRenderRoughFill = this.appearance.fillStyle === 'hachure' || this.appearance.fillStyle === 'cross-hatch'

		// 1. Standard SVG Element (Rect) - handles standard fill and/or standard stroke
		if (fillStyle === 'standard' || strokeStyle === 'standard') {
			rect.style.display = 'block'

			// Handle Fill presence on standard rect
			if (fillStyle === 'standard' && !shouldRenderRoughFill) { // Only render standard fill if not using rough fill
				const hasFill = this.appearance.fillStyle !== 'none'
				rect.setAttribute('fill', hasFill ? this.appearance.fill : 'none')
				rect.setAttribute('fill-opacity', hasFill ? String(this.appearance.fillOpacity) : '0')
			} else {
				rect.setAttribute('fill', 'none')
			}

			// Handle Stroke presence on standard rect
			if (strokeStyle === 'standard') {
				const hasStroke = this.appearance.strokeStyle !== 'none'
				rect.setAttribute('stroke', hasStroke ? this.appearance.stroke : 'none')
				rect.setAttribute('stroke-width', String(this.appearance.strokeWidth))
				rect.setAttribute('stroke-opacity', String(this.appearance.strokeOpacity))
				rect.setAttribute('stroke-linecap', 'round')

				// Map stroke style to dasharray (scaled to strokeWidth)
				const sw = this.appearance.strokeWidth
				if (this.appearance.strokeStyle === 'dashed') {
					rect.setAttribute('stroke-dasharray', `16 ${16 + sw}`)
				} else if (this.appearance.strokeStyle === 'dotted') {
					rect.setAttribute('stroke-dasharray', `${Math.max(1, sw * 0.5)} ${sw * 2.2}`)
				} else {
					rect.removeAttribute('stroke-dasharray')
				}
			} else {
				rect.setAttribute('stroke', 'none')
			}
		} else {
			rect.style.display = 'none'
		}

		const svgRoot = this.element.ownerSVGElement

		// 2. Rough Fill Element (Handdrawn Fill) - Inserted BEFORE rect
		if (shouldRenderRoughFill && svgRoot) {
			if (!this.roughElement) {
				this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
				rect.parentNode?.insertBefore(this.roughElement, rect)
			}
			this.roughElement.style.display = 'block'
			this.roughElement.style.opacity = String(this.appearance.fillOpacity ?? 1)

			const rc = rough.svg(svgRoot)
			const x = this.layout.x
			const y = this.layout.y
			const w = this.layout.width
			const h = this.layout.height
			const r = Math.min(12, Math.min(w, h) * 0.2)

			// Seed based on ID for consistency
			const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

			const options = getRoughOptions(this.appearance, seed, w, h)
			// Override for Fill Only
			options.stroke = 'none'

			const path = `
        M ${x + r} ${y}
        L ${x + w - r} ${y}
        Q ${x + w} ${y}, ${x + w} ${y + r}
        L ${x + w} ${y + h - r}
        Q ${x + w} ${y + h}, ${x + w - r} ${y + h}
        L ${x + r} ${y + h}
        Q ${x} ${y + h}, ${x} ${y + h - r}
        L ${x} ${y + r}
        Q ${x} ${y}, ${x + r} ${y}
        Z
      `

			const node = rc.path(path, options)

			if (this.roughElement.replaceChildren) {
				this.roughElement.replaceChildren(node)
			} else {
				while (this.roughElement.firstChild) this.roughElement.firstChild.remove()
				this.roughElement.appendChild(node)
			}
		} else if (this.roughElement) {
			this.roughElement.style.display = 'none'
		}

		// 3. Rough Stroke Element (Handdrawn Stroke) - Inserted AFTER rect
		if (strokeStyle === 'handdrawn' && svgRoot) {
			if (!this.roughStrokeElement) {
				this.roughStrokeElement = document.createElementNS(SVG_NAMESPACE, 'g')
				rect.parentNode?.insertBefore(this.roughStrokeElement, rect.nextSibling)
			}
			this.roughStrokeElement.style.display = 'block'
			this.roughStrokeElement.style.opacity = String(this.appearance.strokeOpacity ?? 1)

			const rc = rough.svg(svgRoot)
			const x = this.layout.x
			const y = this.layout.y
			const w = this.layout.width
			const h = this.layout.height
			const r = Math.min(12, Math.min(w, h) * 0.2)
			const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

			const options = getRoughOptions(this.appearance, seed, w, h)
			// Override for Stroke Only
			options.fill = 'none'
			options.fillStyle = 'solid' // disable hachure filing

			const path = `
        M ${x + r} ${y}
        L ${x + w - r} ${y}
        Q ${x + w} ${y}, ${x + w} ${y + r}
        L ${x + w} ${y + h - r}
        Q ${x + w} ${y + h}, ${x + w - r} ${y + h}
        L ${x + r} ${y + h}
        Q ${x} ${y + h}, ${x} ${y + h - r}
        L ${x} ${y + r}
        Q ${x} ${y}, ${x + r} ${y}
        Z
      `

			const node = rc.path(path, options)

			// Apply stroke-linecap to rough.js generated elements
			node.querySelectorAll('path').forEach((p: SVGPathElement) => {
				p.setAttribute('stroke-linecap', 'round')
			})

			if (this.roughStrokeElement.replaceChildren) {
				this.roughStrokeElement.replaceChildren(node)
			} else {
				while (this.roughStrokeElement.firstChild) this.roughStrokeElement.firstChild.remove()
				this.roughStrokeElement.appendChild(node)
			}
		} else if (this.roughStrokeElement) {
			this.roughStrokeElement.style.display = 'none'
		}

		// Handle Icon / Placeholder
		const iconSize = Math.min(this.layout.height * 0.6, 60)
		const padding = 12
		const iconX = this.layout.x + padding
		const iconY = this.layout.y + (this.layout.height - iconSize) / 2

		// Render Icon
		if (this.iconContent) {
			// Remove placeholder if it exists
			if (this.placeholderElement) {
				this.placeholderElement.remove()
				this.placeholderElement = null
			}

			// Create or update ClipPath for rounded corners
			if (!this.iconClipPath) {
				const clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath')
				clipPath.id = `icon-clip-${this.id}`

				const clipRect = document.createElementNS(SVG_NAMESPACE, 'rect')
				clipPath.appendChild(clipRect)

				group.appendChild(clipPath)
				this.iconClipPath = clipPath
			}

			// Update clip rect
			const clipRect = this.iconClipPath.firstChild as SVGRectElement
			clipRect.setAttribute('x', String(iconX))
			clipRect.setAttribute('y', String(iconY))
			clipRect.setAttribute('width', String(iconSize))
			clipRect.setAttribute('height', String(iconSize))
			clipRect.setAttribute('rx', '8') // Match proportional look
			clipRect.setAttribute('ry', '8')

			if (!this.iconElement) {
				const image = document.createElementNS(SVG_NAMESPACE, 'image')
				// Check if iconContent is a data URL or a path
				// If it's pure SVG code, we might need to handle it differently (encode it)
				// For now assuming it's a URL (blob or data)
				image.setAttribute('href', this.iconContent)
				image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
				image.setAttribute('class', 'icon-element') // Helper for click detection
				image.setAttribute('clip-path', `url(#icon-clip-${this.id})`)
				group.appendChild(image)
				this.iconElement = image
			} else {
				// Update href in case it changed
				this.iconElement.setAttribute('href', this.iconContent)
				// Ensure clip path is set (in case of restore/undo)
				this.iconElement.setAttribute('clip-path', `url(#icon-clip-${this.id})`)
			}

			this.iconElement.setAttribute('x', String(iconX))
			this.iconElement.setAttribute('y', String(iconY))
			this.iconElement.setAttribute('width', String(iconSize))
			this.iconElement.setAttribute('height', String(iconSize))

			// Render Border/Hit Area for Icon
			if (!this.iconBorderElement) {
				const border = document.createElementNS(SVG_NAMESPACE, 'rect')
				border.setAttribute('rx', '8') // Match icon radius
				border.setAttribute('ry', '8')
				border.setAttribute('fill', 'transparent')
				border.setAttribute('stroke', 'transparent') // Default invisible
				border.setAttribute('stroke-width', '1')
				border.setAttribute('class', 'icon-hit-area') // For click detection and CSS hover
				// Cursor handling is managed by SelectTool or CSS based on state
				border.style.pointerEvents = 'all' // Ensure it captures clicks even if transparent

				// Add a data attribute to indicate this is an icon hit area
				border.dataset.iconHit = 'true'

				group.appendChild(border)
				this.iconBorderElement = border
			}

			this.iconBorderElement.setAttribute('x', String(iconX))
			this.iconBorderElement.setAttribute('y', String(iconY))
			this.iconBorderElement.setAttribute('width', String(iconSize))
			this.iconBorderElement.setAttribute('height', String(iconSize))
			this.iconBorderElement.setAttribute('rx', '8') // Ensure update on resize
			this.iconBorderElement.setAttribute('ry', '8')

			// Show border ONLY if icon editing is active
			if (this.isIconEditing) {
				this.iconBorderElement.setAttribute('stroke', '#3b82f6') // Blue highlight
				this.iconBorderElement.setAttribute('stroke-opacity', '1')
				this.iconBorderElement.setAttribute('stroke-width', '2')
			} else {
				this.iconBorderElement.setAttribute('stroke', 'transparent')
			}
		}
		// Render Placeholder
		else if (this.hasIconPlaceholder) {
			if (this.iconElement) {
				this.iconElement.remove()
				this.iconElement = null
			}
			if (this.iconClipPath) {
				this.iconClipPath.remove()
				this.iconClipPath = null
			}
			if (this.iconBorderElement) {
				this.iconBorderElement.remove()
				this.iconBorderElement = null
			}

			if (!this.placeholderElement) {
				const placeholder = document.createElementNS(SVG_NAMESPACE, 'rect')
				placeholder.setAttribute('rx', '4')
				placeholder.setAttribute('ry', '4')
				placeholder.setAttribute('fill', 'rgba(0,0,0,0.05)')
				placeholder.setAttribute('stroke', '#ccc')
				placeholder.setAttribute('stroke-width', '1')
				placeholder.setAttribute('stroke-dasharray', '4 2')
				placeholder.setAttribute('stroke-width', '1')
				placeholder.setAttribute('stroke-dasharray', '4 2')
				placeholder.setAttribute('class', 'icon-placeholder-hit') // Important for click detection
				// cursor managed by SelectTool
				group.appendChild(placeholder)
				this.placeholderElement = placeholder
			}

			this.placeholderElement.setAttribute('x', String(iconX))
			this.placeholderElement.setAttribute('y', String(iconY))
			this.placeholderElement.setAttribute('width', String(iconSize))
			this.placeholderElement.setAttribute('height', String(iconSize))
		}
		// Neither
		else {
			if (this.iconElement) {
				this.iconElement.remove()
				this.iconElement = null
			}
			if (this.iconBorderElement) {
				this.iconBorderElement.remove()
				this.iconBorderElement = null
			}
			if (this.iconClipPath) {
				this.iconClipPath.remove()
				this.iconClipPath = null
			}
			if (this.placeholderElement) {
				this.placeholderElement.remove()
				this.placeholderElement = null
			}
		}

		this.state.needsRender = false
	}



	isPointOverIcon(x: number, y: number): boolean {
		if (!this.iconContent && !this.hasIconPlaceholder) return false

		const iconSize = Math.min(this.layout.height * 0.6, 60)
		const padding = 12
		const iconX = this.layout.x + padding
		const iconY = this.layout.y + (this.layout.height - iconSize) / 2

		return (
			x >= iconX &&
			x <= iconX + iconSize &&
			y >= iconY &&
			y <= iconY + iconSize
		)
	}

	copy(): DiagramShape {
		const newShape = super.copy() as RectangleShape
		if (this.iconContent) newShape.iconContent = this.iconContent
		newShape.isIconEditing = this.isIconEditing
		newShape.hasIconPlaceholder = this.hasIconPlaceholder
		return newShape
	}
}
