import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../../utils/handdrawn'
import { DiagramShape, type ShapeName } from '../base'

export abstract class ImageShape extends DiagramShape {
	protected iconPath: string = ''
	protected iconViewBox: string = '0 0 24 24'
	public imageUrl: string | null = null
	public squareIcon: boolean = false
	protected backgroundRect: SVGRectElement | null = null
	protected iconElement: SVGElement | null = null

	// Padding around the icon when a background/stroke is active
	protected static readonly ICON_PADDING = 12

	constructor(
		type: ShapeName,
		x: number,
		y: number,
		width = 60,
		height = 60,
		imageUrl: string | null = null,
		squareIcon: boolean = false,
		initialText: string
	) {
		// Create a group for the icon
		const group = document.createElementNS(SVG_NAMESPACE, 'g')
		super(type, group, x, y, width, height)
		
		this.imageUrl = imageUrl
		this.squareIcon = squareIcon

		// Set the text directly
		this.text = initialText

		// Default to no fill and no stroke for icon shapes
		// Default to no fill and no stroke for icon shapes

		this.appearance.fillStyle = 'none'
		this.appearance.strokeStyle = 'none'

		this.createIcon()

		// Set custom text positioning (below the shape)
		this.shapeText.positionCalculator = () => {
			const center = this.layout.center
			return {
				x: center.x,
				y: this.layout.y + this.layout.height + 20 // 20px padding below shape
			}
		}

		// Set custom text bounds (wider than shape)
		this.shapeText.boundsCalculator = () => {
			return {
				width: Math.max(100, this.layout.width * 1.5),
				height: 50 // Initial height, will expand
			}
		}
	}

	/**
	 * Check if fill or stroke styling is currently active
	 */
	protected hasStyling(): boolean {
		return this.appearance.fillStyle !== 'none' || this.appearance.strokeStyle !== 'none'
	}

	/**
	 * Get the padding to use based on whether styling is active
	 */
	protected getCurrentPadding(): number {
		return this.hasStyling() ? ImageShape.ICON_PADDING : 0
	}

	protected createIcon() {
		// Clear existing content
		this.shapeElement.innerHTML = ''
		this.backgroundRect = null
		this.iconElement = null

		// Create background rectangle (always exists, visibility controlled in render)
		const rect = document.createElementNS(SVG_NAMESPACE, 'rect')
		rect.setAttribute('rx', '6')
		rect.setAttribute('ry', '6')
		rect.setAttribute('pointer-events', 'all')
		this.backgroundRect = rect
		this.shapeElement.appendChild(rect)

		// Create the icon element
		if (this.imageUrl) {
			const image = document.createElementNS(SVG_NAMESPACE, 'image')
			image.setAttribute('href', this.imageUrl)
			image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
			image.setAttribute('pointer-events', 'none')
			this.iconElement = image
			this.shapeElement.appendChild(image)
		} else {
			const iconSvg = document.createElementNS(SVG_NAMESPACE, 'svg')
			iconSvg.setAttribute('viewBox', this.iconViewBox)
			iconSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
			iconSvg.setAttribute('pointer-events', 'none')
			iconSvg.innerHTML = this.iconPath
			this.iconElement = iconSvg
			this.shapeElement.appendChild(iconSvg)
		}
	}



	render(): void {
		if (!this.state.needsRender) return
		
		const hasStyling = this.hasStyling()
		const padding = this.getCurrentPadding()

		// Render background rectangle
		if (this.backgroundRect) {
			// Always position and size the background to match shape bounds
			this.backgroundRect.setAttribute('x', String(this.layout.x))
			this.backgroundRect.setAttribute('y', String(this.layout.y))
			this.backgroundRect.setAttribute('width', String(Math.max(1, this.layout.width)))
			this.backgroundRect.setAttribute('height', String(Math.max(1, this.layout.height)))

			if (hasStyling) {
				// Render fill
				if (this.appearance.fillStyle === 'none') {
					this.backgroundRect.setAttribute('fill', 'none')
				} else {
					this.backgroundRect.setAttribute('fill', this.appearance.fill)
					this.backgroundRect.setAttribute('fill-opacity', String(this.appearance.fillOpacity))
				}

				// Render stroke
				if (this.appearance.strokeStyle === 'none') {
					this.backgroundRect.setAttribute('stroke', 'none')
				} else {
					this.backgroundRect.setAttribute('stroke', this.appearance.stroke)
					this.backgroundRect.setAttribute('stroke-width', String(this.appearance.strokeWidth))
					this.backgroundRect.setAttribute('stroke-opacity', String(this.appearance.strokeOpacity))
					this.backgroundRect.setAttribute('stroke-linecap', 'round')

					// Map stroke style to dasharray (scaled to strokeWidth)
					const sw = this.appearance.strokeWidth
					if (this.appearance.strokeStyle === 'dashed') {
						this.backgroundRect.setAttribute('stroke-dasharray', `16 ${16 + sw}`)
					} else if (this.appearance.strokeStyle === 'dotted') {
						this.backgroundRect.setAttribute('stroke-dasharray', `${Math.max(1, sw * 0.5)} ${sw * 2.2}`)
					} else {
						this.backgroundRect.removeAttribute('stroke-dasharray')
					}
				}
			} else {
				// No styling - make background invisible but keep for hit testing
				this.backgroundRect.setAttribute('fill', 'transparent')
				this.backgroundRect.setAttribute('stroke', 'none')
			}
		}

		// Position and size the icon element
		if (this.iconElement) {
			const iconX = this.layout.x + padding
			const iconY = this.layout.y + padding
			const iconWidth = Math.max(1, this.layout.width - padding * 2)
			const iconHeight = Math.max(1, this.layout.height - padding * 2)

			this.iconElement.setAttribute('x', String(iconX))
			this.iconElement.setAttribute('y', String(iconY))
			this.iconElement.setAttribute('width', String(iconWidth))
			this.iconElement.setAttribute('height', String(iconHeight))
		}

		// Update selection indicator if it exists
		// Update selection indicator if it exists
		this.selection.update()
		
		// Handle Draw Style Logic
		const fillStyle = this.appearance.fillDrawStyle || 'standard'
		const strokeStyle = this.appearance.strokeDrawStyle || 'standard'
		const hasHanddrawn = fillStyle === 'handdrawn' || strokeStyle === 'handdrawn'

		if (hasHanddrawn) {
		// Manage standard element visibility
			if (this.backgroundRect && hasStyling) {
				// We need to keep the rect for hit testing, but hide visual parts
				// If fill is handdrawn, hide standard fill
				const standardFill = fillStyle === 'standard' ? this.appearance.fill : 'none'
				const standardFillOpacity = fillStyle === 'standard' ? String(this.appearance.fillOpacity) : '0'

				// If stroke is handdrawn, hide standard stroke
				const standardStroke = strokeStyle === 'standard' ? this.appearance.stroke : 'none'
				// Note: if stroke is handdrawn, we set stroke to none on standard element

				// Apply updates to standard element
				if (this.appearance.fillStyle !== 'none') {
					this.backgroundRect.setAttribute('fill', standardFill)
					this.backgroundRect.setAttribute('fill-opacity', standardFillOpacity)
				}
				if (this.appearance.strokeStyle !== 'none') {
					this.backgroundRect.setAttribute('stroke', standardStroke)
					// Keep other props if standard
				}
			}

			if (hasStyling) {
				if (!this.roughElement) {
					this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
					if (this.backgroundRect) {
						this.shapeElement.insertBefore(this.roughElement, this.backgroundRect)
					} else {
						this.shapeElement.insertBefore(this.roughElement, this.shapeElement.firstChild)
					}
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

					// 1. Render Rough Fill
					if (fillStyle === 'handdrawn' && this.appearance.fillStyle !== 'none') {
						const options = {
							...getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height),
							stroke: 'none',
							fill: this.appearance.fill,
							fillStyle: this.appearance.fillStyle === 'solid' ? 'solid' : 'hachure',
							fillWeight: this.appearance.strokeWidth / 2,
							hachureGap: 4
						}
						const node = rc.rectangle(
							this.layout.x,
							this.layout.y,
							Math.max(1, this.layout.width),
							Math.max(1, this.layout.height),
							options
						)
						node.setAttribute('opacity', String(this.appearance.fillOpacity ?? 1))
						this.roughElement.appendChild(node)
					}

					// 2. Render Rough Stroke
					if (strokeStyle === 'handdrawn' && this.appearance.strokeStyle !== 'none') {
						const options = {
							...getRoughOptions(this.appearance, seed, this.layout.width, this.layout.height),
							stroke: this.appearance.stroke,
							strokeWidth: this.appearance.strokeWidth,
							fill: 'none'
						}
						const node = rc.rectangle(
							this.layout.x,
							this.layout.y,
							Math.max(1, this.layout.width),
							Math.max(1, this.layout.height),
							options
						)
						node.setAttribute('opacity', String(this.appearance.strokeOpacity ?? 1))
						// Apply stroke-linecap to rough.js generated elements
						node.querySelectorAll('path').forEach((p: SVGPathElement) => {
							p.setAttribute('stroke-linecap', 'round')
						})
						this.roughElement.appendChild(node)
					}
				}
			} else {
				if (this.roughElement) this.roughElement.style.display = 'none'
			}
		} else {
			// Standard only
			if (this.roughElement) {
				this.roughElement.style.display = 'none'
			}
			// Standard render block already ran and set attributes correctly
		}

		this.state.needsRender = false
	}



	public setImage(url: string): void {
		this.imageUrl = url
		this.createIcon()
		this.state.needsRender = true
	}
}

export class GenericImageShape extends ImageShape {
	constructor(x: number, y: number, width: number, height: number, imageUrl: string, imageName?: string, squareIcon: boolean = false) {
		const name = (imageName && typeof imageName === 'string' && imageName.trim()) ? imageName.trim() : 'Image'
		super('image', x, y, width, height, imageUrl, squareIcon, name)
	}

	copy(): DiagramShape {
		const newShape = new GenericImageShape(
			this.layout.x,
			this.layout.y,
			this.layout.width,
			this.layout.height,
			this.imageUrl || '',
			this.text,
			this.squareIcon
		);
		newShape.copyFrom(this);
		return newShape;
	}
}
