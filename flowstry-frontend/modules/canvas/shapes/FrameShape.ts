import { SVG_NAMESPACE } from '@/src/consts/svg'
import rough from 'roughjs'
import { getRoughOptions } from '../utils/handdrawn'
import { DiagramShape } from './base'

/**
 * Frame options for visual customization
 */
export interface FrameOptions {
	showBackground: boolean
	backgroundColor: string
	backgroundOpacity: number
	showBorder: boolean
	borderColor: string
	borderWidth: number
	borderRadius: number
	padding: number  // Padding for content area
	[key: string]: unknown
}

/**
 * Default frame options
 */
export const DEFAULT_FRAME_OPTIONS: FrameOptions = {
	showBackground: true,
	backgroundColor: '#f8f9fa',
	backgroundOpacity: 0.5,
	showBorder: true,
	borderColor: '#d1d5db',
	borderWidth: 2,
	borderRadius: 8,
	padding: 16
}

// Label configuration
const LABEL_HEIGHT = 32
const LABEL_PADDING_X = 8
const LABEL_BORDER_RADIUS = 4

/**
 * FrameShape - A container that owns children and can be collapsed
 * 
 * Unlike groups:
 * - Has visual representation (background, border, label)
 * - Children can be selected/moved independently
 * - Moving the frame moves all children
 * - Children auto-detach when moved 50%+ outside frame
 */
export class FrameShape extends DiagramShape {
	// Child management (IDs of shapes/groups owned by this frame)
	childIds: string[] = []
	// Nested frames
	childFrameIds: string[] = []
	// Frame label/title
	labelText: string = ''
	// Collapsed state (kept for serialization compatibility but not used for UI)
	collapsed: boolean = false
	// Frame-specific visual options
	options: FrameOptions
	// Whether this frame is nested inside another frame
	isNestedFrame: boolean = false
	
	// SVG elements for frame rendering
	private backgroundElement: SVGRectElement
	private borderElement: SVGRectElement
	private labelGroup: SVGGElement
	private labelBackground: SVGRectElement
	private labelTextElement: SVGTextElement
	
	// Highlight state (when shape is entering frame)
	highlighted: boolean = false

	// Icon support
	public iconContent: string | null = null
	public isIconEditing: boolean = false
	public hasIconPlaceholder: boolean = false
	private iconElement: SVGImageElement | SVGGElement | null = null
	private iconBorderElement: SVGRectElement | null = null
	private iconClipPath: SVGClipPathElement | null = null
	private placeholderElement: SVGRectElement | null = null

	constructor(
		x: number,
		y: number,
		width = 200,
		height = 150,
		labelText = '',
		options: Partial<FrameOptions> = {}
	) {
		// Create the main container rect (used for hit testing)
		const containerRect = document.createElementNS(SVG_NAMESPACE, 'rect')
		containerRect.setAttribute('fill', 'transparent')
		containerRect.setAttribute('stroke', 'none')
		
		super('frame', containerRect, x, y, width, height)
		
		this.labelText = labelText
		this.options = { ...DEFAULT_FRAME_OPTIONS, ...options }
		
		// Create background element
		this.backgroundElement = document.createElementNS(SVG_NAMESPACE, 'rect')
		this.backgroundElement.setAttribute('class', 'frame-background')
		
		// Create border element (separate for highlight effect)
		this.borderElement = document.createElementNS(SVG_NAMESPACE, 'rect')
		this.borderElement.setAttribute('class', 'frame-border')
		this.borderElement.setAttribute('fill', 'none')
		
		// Insert background and border before the main shape element
		this.element.insertBefore(this.borderElement, this.shapeElement)
		this.element.insertBefore(this.backgroundElement, this.borderElement)
		
		// Create label group with background and text
		this.labelGroup = document.createElementNS(SVG_NAMESPACE, 'g')
		this.labelGroup.setAttribute('class', 'frame-label-group')
		this.labelGroup.setAttribute('data-frame-label', 'true')
		// Removed global text cursor for group
		
		// Label background (darker than frame background)
		this.labelBackground = document.createElementNS(SVG_NAMESPACE, 'rect')
		this.labelBackground.setAttribute('class', 'frame-label-background')
		this.labelBackground.style.pointerEvents = 'all'
		
		// Label text
		this.labelTextElement = document.createElementNS(SVG_NAMESPACE, 'text')
		this.labelTextElement.setAttribute('class', 'frame-label-text')
		this.labelTextElement.setAttribute('font-family', 'Inter, system-ui, -apple-system, sans-serif')
		this.labelTextElement.setAttribute('font-size', '16')
		this.labelTextElement.setAttribute('font-weight', '600')
		this.labelTextElement.style.userSelect = 'none'
		this.labelTextElement.style.pointerEvents = 'all'
		this.labelTextElement.style.cursor = 'text' // Only text has text cursor
		
		this.labelGroup.appendChild(this.labelBackground)
		this.labelGroup.appendChild(this.labelTextElement)
		this.element.appendChild(this.labelGroup)
		
		// Frames are always resizable
		this.state.resizable = true
		
		// Set frame-specific defaults
		this.appearance.fill = 'transparent'
		this.appearance.stroke = 'none'

		// Configure text positioning
		this.shapeText.positionCalculator = () => ({
			x: this.layout.x + this.layout.width / 2,
			y: this.layout.y + 32 / 2 // LABEL_HEIGHT / 2 (referencing constant directly or we need to export it but it's local const)
		})

		this.shapeText.boundsCalculator = () => ({
			width: Math.max(1, this.layout.width - (this.options.padding * 2)),
			height: 32 // LABEL_HEIGHT
		})
	}
	
	// Label editing state
	private isEditingLabel: boolean = false
	private labelEditInput: SVGForeignObjectElement | null = null
	private onLabelEditStopCallback: (() => void) | null = null
	
	/**
	 * Check if the label is currently being edited
	 */
	public isLabelEditing(): boolean {
		return this.isEditingLabel
	}
	
	/**
	 * Start editing the frame label
	 */
	public startLabelEditing(onStop?: () => void): void {
		if (this.isEditingLabel) return
		
		this.isEditingLabel = true
		this.onLabelEditStopCallback = onStop || null
		
		// Show the labelGroup (in case it was hidden due to empty label)
		this.labelGroup.style.display = ''

		// Hide the static label (both text and background)
		this.labelTextElement.style.visibility = 'hidden'
		this.labelBackground.style.visibility = 'hidden'
		
		// Get label position
		let labelX: number
		let labelY: number
		
		if (this.isNestedFrame) {
			labelX = this.layout.x + this.options.padding
			labelY = this.layout.y + this.options.padding
		} else {
			labelX = this.layout.x
			labelY = this.layout.y - LABEL_HEIGHT - 4
		}



		// Calculate extra padding for icon if present (don't shift labelX)
		const iconSize = LABEL_HEIGHT - 8 // 24px
		const iconPadding = 12
		let extraLeftPadding = 0

		if (this.iconContent || this.hasIconPlaceholder) {
			extraLeftPadding = (iconSize + iconPadding)
		}

		// Get the dark color for the background
		const baseFillColor = (this.appearance.fill && this.appearance.fill !== 'transparent')
			? this.appearance.fill
			: this.options.backgroundColor
		const darkColor = this.darkenColor(baseFillColor, 0.2)
		const textColor = this.isLightColor(darkColor) ? '#374151' : '#ffffff'

		// Create foreignObject with large width
		this.labelEditInput = document.createElementNS(SVG_NAMESPACE, 'foreignObject')
		this.labelEditInput.setAttribute('x', String(labelX))
		this.labelEditInput.setAttribute('y', String(labelY))
		this.labelEditInput.setAttribute('width', '1000')
		this.labelEditInput.setAttribute('height', String(LABEL_HEIGHT))
		this.labelEditInput.setAttribute('data-text-editor', 'true')
		
		// Use contenteditable div - fits content naturally
		const div = document.createElement('div')
		div.contentEditable = 'true'
		div.textContent = this.labelText
		div.style.cssText = `
			display: inline-block;
			min-width: 1px;
			height: ${LABEL_HEIGHT}px;
			line-height: ${LABEL_HEIGHT}px;
			margin: 0;
			border: none;
			outline: none;
			background: ${darkColor};
			border-radius: ${LABEL_BORDER_RADIUS}px;
			font-family: Inter, system-ui, -apple-system, sans-serif;
			font-size: 16px;
			font-weight: 600;
			color: ${textColor};
			color: ${textColor};
			padding: 0 ${LABEL_PADDING_X}px 0 ${LABEL_PADDING_X + extraLeftPadding}px;
			white-space: nowrap;
			vertical-align: top;
		`
		
		// Handle events
		div.addEventListener('pointerdown', (e) => e.stopPropagation())
		div.addEventListener('mousedown', (e) => e.stopPropagation())
		div.addEventListener('click', (e) => e.stopPropagation())
		div.addEventListener('blur', () => this.stopLabelEditing())
		div.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				this.stopLabelEditing()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				div.textContent = this.labelText
				this.stopLabelEditing()
			}
		})
		div.addEventListener('input', () => {
			this.labelText = div.textContent || ''
		})
		
		this.labelEditInput.appendChild(div)
		this.labelGroup.appendChild(this.labelEditInput)
		
		// Move icon elements to top of stack so they display over the editor background
		if (this.iconElement) this.labelGroup.appendChild(this.iconElement)
		if (this.placeholderElement) this.labelGroup.appendChild(this.placeholderElement)
		if (this.iconBorderElement) this.labelGroup.appendChild(this.iconBorderElement)

		// Focus and select all
		setTimeout(() => {
			div.focus()
			const range = document.createRange()
			range.selectNodeContents(div)
			const sel = window.getSelection()
			sel?.removeAllRanges()
			sel?.addRange(range)
		}, 0)
	}
	
	/**
	 * Stop editing the frame label
	 */
	public stopLabelEditing(): void {
		if (!this.isEditingLabel) return
		
		this.isEditingLabel = false
		
		// Get final value from div
		if (this.labelEditInput) {
			const div = this.labelEditInput.querySelector('div')
			if (div) {
				this.labelText = div.textContent || ''
			}
			this.labelEditInput.remove()
			this.labelEditInput = null
		}
		
		// Show the static label again
		this.labelTextElement.style.visibility = ''
		this.labelBackground.style.visibility = ''
		
		// Trigger re-render to update label
		this.state.needsRender = true
		this.render()
		
		// Notify callback
		if (this.onLabelEditStopCallback) {
			this.onLabelEditStopCallback()
			this.onLabelEditStopCallback = null
		}
	}
	
	/**
	 * Get the label bounds for hit testing
	 */
	public getLabelBounds(): { x: number; y: number; width: number; height: number } | null {
		if (!this.labelText) return null
		
		let labelX: number
		let labelY: number
		
		if (this.isNestedFrame) {
			labelX = this.layout.x + this.options.padding
			labelY = this.layout.y + this.options.padding
		} else {
			labelX = this.layout.x
			labelY = this.layout.y - LABEL_HEIGHT - 4
		}
		
		const labelWidth = this.measureTextWidth(this.labelText)
		
		return {
			x: labelX,
			y: labelY,
			width: labelWidth,
			height: LABEL_HEIGHT
		}
	}

	/**
	 * Darken a hex color by a percentage
	 */
	private darkenColor(hex: string, percent: number): string {
		// Remove # if present
		const color = hex.replace('#', '')
		
		// Parse RGB
		let r = parseInt(color.substring(0, 2), 16)
		let g = parseInt(color.substring(2, 4), 16)
		let b = parseInt(color.substring(4, 6), 16)
		
		// Darken
		r = Math.max(0, Math.floor(r * (1 - percent)))
		g = Math.max(0, Math.floor(g * (1 - percent)))
		b = Math.max(0, Math.floor(b * (1 - percent)))
		
		// Convert back to hex
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
	}

	/**
	 * Determine if a color is light (for text contrast)
	 */
	private isLightColor(hex: string): boolean {
		// Remove # if present
		const color = hex.replace('#', '')
		
		// Parse RGB
		const r = parseInt(color.substring(0, 2), 16)
		const g = parseInt(color.substring(2, 4), 16)
		const b = parseInt(color.substring(4, 6), 16)
		
		// Calculate relative luminance (simplified)
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
		
		return luminance > 0.5
	}

	/**
	 * Lighten a hex color by blending with white
	 */
	private lightenColor(hex: string, percent: number): string {
		// Remove # if present
		const color = hex.replace('#', '')
		
		// Parse RGB
		let r = parseInt(color.substring(0, 2), 16)
		let g = parseInt(color.substring(2, 4), 16)
		let b = parseInt(color.substring(4, 6), 16)
		
		// Blend with white
		r = Math.min(255, Math.floor(r + (255 - r) * percent))
		g = Math.min(255, Math.floor(g + (255 - g) * percent))
		b = Math.min(255, Math.floor(b + (255 - b) * percent))
		
		// Convert back to hex
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
	}

	/**
	 * Calculate text width for label sizing using canvas for accuracy
	 */
	/**
	 * Calculate text width for label sizing using canvas for accuracy
	 */
	private measureTextWidth(text: string): number {
		let width = 0

		// Measure text
		if (text && text.length > 0) {
			const canvas = document.createElement('canvas')
			const ctx = canvas.getContext('2d')
			if (ctx) {
				ctx.font = '600 16px Inter, system-ui, -apple-system, sans-serif'
				const metrics = ctx.measureText(text)
				width = metrics.width + LABEL_PADDING_X * 2
			} else {
				width = text.length * 7 + LABEL_PADDING_X * 2
			}
		} else {
			// Even if empty, if there's an icon, we might need some padding for the container if we want it to look like a pill?
			// But usually if empty text, we just show icon. 
			// So text width is 0.
			width = 0
		}

		// Add icon width if present
		if (this.iconContent || this.hasIconPlaceholder) {
			const iconSize = LABEL_HEIGHT - 8 // 24px
			const iconPadding = 12 // Space between icon and text

			// Try to balance the look:
			// If text is present: [ PADDING_X ICON PADDING_TEXT TEXT PADDING_X ]
			// We already have PADDING_X * 2 from text measurement.
			// So add iconSize + iconPadding.

			if (width > 0) {
				width += iconSize + iconPadding
			} else {
				// Just icon: [ PADDING_X ICON PADDING_X ]
				width = iconSize + LABEL_PADDING_X * 2
			}
		}

		return width
	}



	// Store last move delta for child movement
	private _lastMoveDelta: { dx: number; dy: number } | null = null
	
	getLastMoveDelta(): { dx: number; dy: number } | null {
		const delta = this._lastMoveDelta
		this._lastMoveDelta = null  // Clear after reading
		return delta
	}

	render(): void {
		if (!this.state.needsRender) return
		
		super.render()
		
		const { borderRadius } = this.options
		
		// Determine the base fill color (from StyleMenu or options)
		const baseFillColor = (this.appearance.fill && this.appearance.fill !== 'transparent')
			? this.appearance.fill 
			: this.options.backgroundColor
		
		// Create a lighter version for the background (pastel effect)
		const lightFillColor = this.lightenColor(baseFillColor, 0.7)
		
		// Create a darker version for the label and default stroke
		const darkColor = this.darkenColor(baseFillColor, 0.2)
		
		// Determine the actual stroke color to use
		// If this.stroke is explicitly set (from StyleMenu), use it
		// Otherwise use the dark color that matches the label
		const strokeColor = (this.appearance.stroke && this.appearance.stroke !== 'none')
			? this.appearance.stroke
			: darkColor
		
		// Handle Draw Style Logic
		const fillStyle = this.appearance.fillDrawStyle || 'standard'
		const strokeStyle = this.appearance.strokeDrawStyle || 'standard'

		const shouldRenderRoughFill = this.appearance.fillStyle === 'hachure' || this.appearance.fillStyle === 'cross-hatch'

		const showLabel = (this.labelText && this.labelText.trim().length > 0) || this.iconContent || this.hasIconPlaceholder
		if (showLabel) {
			this.labelGroup.style.display = ''
		} else {
			this.labelGroup.style.display = 'none'
		}

		const svgRoot = this.element.ownerSVGElement
		const seed = this.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

		// 1. Fill Logic (Background)
		if (shouldRenderRoughFill && svgRoot) {
			this.backgroundElement.style.display = 'none'

			if (!this.roughElement) {
				this.roughElement = document.createElementNS(SVG_NAMESPACE, 'g')
				this.element.insertBefore(this.roughElement, this.element.firstChild)
			}
			this.roughElement.style.display = 'block'
			this.roughElement.style.opacity = String(this.appearance.fillOpacity ?? 1)

			while (this.roughElement.firstChild) this.roughElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const w = this.layout.width
			const h = this.layout.height

			if (this.options.showBackground || (this.appearance.fill && this.appearance.fill !== 'transparent')) {
				const optionsBase = {
					...getRoughOptions(this.appearance, seed, w, h),
					stroke: 'none',
					fill: lightFillColor,
					fillStyle: 'solid', 
					hachureGap: 4
				}
				const r = Math.min(12, Math.min(w, h) * 0.2)
				const path = `
					M ${this.layout.x + r} ${this.layout.y}
					L ${this.layout.x + w - r} ${this.layout.y}
					Q ${this.layout.x + w} ${this.layout.y}, ${this.layout.x + w} ${this.layout.y + r}
					L ${this.layout.x + w} ${this.layout.y + h - r}
					Q ${this.layout.x + w} ${this.layout.y + h}, ${this.layout.x + w - r} ${this.layout.y + h}
					L ${this.layout.x + r} ${this.layout.y + h}
					Q ${this.layout.x} ${this.layout.y + h}, ${this.layout.x} ${this.layout.y + h - r}
					L ${this.layout.x} ${this.layout.y + r}
					Q ${this.layout.x} ${this.layout.y}, ${this.layout.x + r} ${this.layout.y}
					Z
				`
				const bgNode = rc.path(path, optionsBase)
				this.roughElement.appendChild(bgNode)
			}
		} else {
			// Standard Fill
			if (this.roughElement) this.roughElement.style.display = 'none'

			if (this.options.showBackground || (this.appearance.fill && this.appearance.fill !== 'transparent')) {
				this.backgroundElement.setAttribute('x', String(this.layout.x))
				this.backgroundElement.setAttribute('y', String(this.layout.y))
				this.backgroundElement.setAttribute('width', String(Math.max(1, this.layout.width)))
				this.backgroundElement.setAttribute('height', String(Math.max(1, this.layout.height)))
				this.backgroundElement.setAttribute('rx', String(borderRadius))
				this.backgroundElement.setAttribute('ry', String(borderRadius))
				this.backgroundElement.setAttribute('fill', lightFillColor)
				this.backgroundElement.setAttribute('fill-opacity', '1')
				this.backgroundElement.style.display = ''
			} else {
				this.backgroundElement.style.display = 'none'
			}
		}

		// 2. Stroke Logic (Border + Label BG)
		if (strokeStyle === 'handdrawn' && svgRoot) {
			this.borderElement.style.display = 'none'
			this.labelBackground.style.visibility = 'hidden'

			if (!this.roughStrokeElement) {
				this.roughStrokeElement = document.createElementNS(SVG_NAMESPACE, 'g')
				this.element.insertBefore(this.roughStrokeElement, this.labelGroup)
			}
			this.roughStrokeElement.style.display = 'block'
			this.roughStrokeElement.style.opacity = String(this.appearance.strokeOpacity ?? 1)

			while (this.roughStrokeElement.firstChild) this.roughStrokeElement.firstChild.remove()

			const rc = rough.svg(svgRoot)
			const w = this.layout.width
			const h = this.layout.height
			const optionsBase = getRoughOptions(this.appearance, seed, w, h)

			// Render Border
			if (this.options.showBorder || (this.appearance.stroke && this.appearance.stroke !== 'none')) {
				const strokeWidth = (this.appearance.stroke && this.appearance.stroke !== 'none' && this.appearance.strokeWidth)
					? this.appearance.strokeWidth
					: this.options.borderWidth

				const r = Math.min(12, Math.min(w, h) * 0.2)
				const path = `
					M ${this.layout.x + r} ${this.layout.y}
					L ${this.layout.x + w - r} ${this.layout.y}
					Q ${this.layout.x + w} ${this.layout.y}, ${this.layout.x + w} ${this.layout.y + r}
					L ${this.layout.x + w} ${this.layout.y + h - r}
					Q ${this.layout.x + w} ${this.layout.y + h}, ${this.layout.x + w - r} ${this.layout.y + h}
					L ${this.layout.x + r} ${this.layout.y + h}
					Q ${this.layout.x} ${this.layout.y + h}, ${this.layout.x} ${this.layout.y + h - r}
					L ${this.layout.x} ${this.layout.y + r}
					Q ${this.layout.x} ${this.layout.y}, ${this.layout.x + r} ${this.layout.y}
					Z
				`
				const borderNode = rc.path(path, {
					...optionsBase,
					stroke: this.highlighted ? '#36C3AD' : strokeColor,
					strokeWidth: this.highlighted ? 3 : strokeWidth,
					fill: 'none' 
				})
				// Apply stroke-linecap to rough.js generated elements
				borderNode.querySelectorAll('path').forEach((p: SVGPathElement) => {
					p.setAttribute('stroke-linecap', 'round')
				})
				this.roughStrokeElement.appendChild(borderNode)
			}

			// Render Label Background
			if (showLabel) {
				const labelWidth = this.measureTextWidth(this.labelText)
				let labelX = this.isNestedFrame ? this.layout.x + this.options.padding : this.layout.x
				let labelY = this.isNestedFrame ? this.layout.y + this.options.padding : this.layout.y - 32 - 4

				const r = 4
				const labelPath = `
					M ${labelX + r} ${labelY}
					L ${labelX + labelWidth - r} ${labelY}
					Q ${labelX + labelWidth} ${labelY}, ${labelX + labelWidth} ${labelY + r}
					L ${labelX + labelWidth} ${labelY + 32 - r}
					Q ${labelX + labelWidth} ${labelY + 32}, ${labelX + labelWidth - r} ${labelY + 32}
					L ${labelX + r} ${labelY + 32}
					Q ${labelX} ${labelY + 32}, ${labelX} ${labelY + 32 - r}
					L ${labelX} ${labelY + r}
					Q ${labelX} ${labelY}, ${labelX + r} ${labelY}
					Z
				`
				const labelNode = rc.path(labelPath, {
					...optionsBase,
					fill: darkColor,
					fillStyle: 'solid',
					stroke: 'none'
				})
				this.roughStrokeElement.appendChild(labelNode)
			}
		} else {
			// Standard Stroke
			if (this.roughStrokeElement) this.roughStrokeElement.style.display = 'none'
			this.labelBackground.style.visibility = ''

			if (this.options.showBorder || (this.appearance.stroke && this.appearance.stroke !== 'none')) {
				this.borderElement.setAttribute('x', String(this.layout.x))
				this.borderElement.setAttribute('y', String(this.layout.y))
				this.borderElement.setAttribute('width', String(Math.max(1, this.layout.width)))
				this.borderElement.setAttribute('height', String(Math.max(1, this.layout.height)))
				this.borderElement.setAttribute('rx', String(borderRadius))
				this.borderElement.setAttribute('ry', String(borderRadius))

				if (this.highlighted) {
					this.borderElement.setAttribute('stroke', '#36C3AD')
					this.borderElement.setAttribute('stroke-width', '3')
				} else {
					this.borderElement.setAttribute('stroke', strokeColor)
					const strokeWidth = (this.appearance.stroke && this.appearance.stroke !== 'none' && this.appearance.strokeWidth)
						? this.appearance.strokeWidth
						: this.options.borderWidth
					this.borderElement.setAttribute('stroke-width', String(strokeWidth))
				}
				this.borderElement.style.display = ''
			} else {
				this.borderElement.style.display = 'none'
			}
		}

		// Render hit-test area (also needs border radius for proper hit detection)
		const hitRect = this.shapeElement as SVGRectElement
		hitRect.setAttribute('x', String(this.layout.x))
		hitRect.setAttribute('y', String(this.layout.y))
		hitRect.setAttribute('width', String(Math.max(1, this.layout.width)))
		hitRect.setAttribute('height', String(Math.max(1, this.layout.height)))
		hitRect.setAttribute('rx', String(borderRadius))
		hitRect.setAttribute('ry', String(borderRadius))
		
		// Render label (only if there's non-empty label text OR an icon)
		if ((this.labelText && this.labelText.trim().length > 0) || this.iconContent || this.hasIconPlaceholder) {
			this.labelGroup.style.display = ''
			
			const labelWidth = this.measureTextWidth(this.labelText)
			
			// Position label based on whether it's nested or top-level
			let labelX: number
			let labelY: number
			
			if (this.isNestedFrame) {
				// Nested frame: label inside at top-left
				labelX = this.layout.x + this.options.padding
				labelY = this.layout.y + this.options.padding
			} else {
				// Top-level frame: label above frame at top-left
				labelX = this.layout.x
				labelY = this.layout.y - LABEL_HEIGHT - 4  // 4px gap above frame
			}
			
			// Label background uses the dark color (same as stroke)
			this.labelBackground.setAttribute('x', String(labelX))
			this.labelBackground.setAttribute('y', String(labelY))
			this.labelBackground.setAttribute('width', String(labelWidth))
			this.labelBackground.setAttribute('height', String(LABEL_HEIGHT))
			this.labelBackground.setAttribute('rx', String(LABEL_BORDER_RADIUS))
			this.labelBackground.setAttribute('ry', String(LABEL_BORDER_RADIUS))
			this.labelBackground.setAttribute('fill', darkColor)
			this.labelBackground.setAttribute('fill-opacity', '1')
			
			// Render Icon / Placeholder
			const iconSize = LABEL_HEIGHT - 8 // 24px
			const iconPadding = 12
			const iconX = labelX + LABEL_PADDING_X
			const iconY = labelY + (LABEL_HEIGHT - iconSize) / 2

			if (this.iconContent) {
				// Remove placeholder if it exists
				if (this.placeholderElement) {
					this.placeholderElement.remove()
					this.placeholderElement = null
				}

				// Create or update ClipPath for rounded corners
				if (!this.iconClipPath) {
					const clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath')
					clipPath.id = `frame-icon-clip-${this.id}`

					const clipRect = document.createElementNS(SVG_NAMESPACE, 'rect')
					clipPath.appendChild(clipRect)

					this.labelGroup.appendChild(clipPath)
					this.iconClipPath = clipPath
				}

				// Update clip rect
				const clipRect = this.iconClipPath.firstChild as SVGRectElement
				clipRect.setAttribute('x', String(iconX))
				clipRect.setAttribute('y', String(iconY))
				clipRect.setAttribute('width', String(iconSize))
				clipRect.setAttribute('height', String(iconSize))
				clipRect.setAttribute('rx', '3') // Proportional to small icon size
				clipRect.setAttribute('ry', '3')

				if (!this.iconElement) {
					const image = document.createElementNS(SVG_NAMESPACE, 'image')
					image.setAttribute('href', this.iconContent)
					image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
					image.setAttribute('class', 'icon-element')
					image.setAttribute('clip-path', `url(#frame-icon-clip-${this.id})`)
					this.labelGroup.appendChild(image)
					this.iconElement = image
				} else {
					this.iconElement.setAttribute('href', this.iconContent)
					this.iconElement.setAttribute('clip-path', `url(#frame-icon-clip-${this.id})`)
				}

				this.iconElement.setAttribute('x', String(iconX))
				this.iconElement.setAttribute('y', String(iconY))
				this.iconElement.setAttribute('width', String(iconSize))
				this.iconElement.setAttribute('height', String(iconSize))

				// Render Highlight/Border for Icon (when editing)
				if (!this.iconBorderElement) {
					const border = document.createElementNS(SVG_NAMESPACE, 'rect')
					border.setAttribute('rx', '3')
					border.setAttribute('ry', '3')
					border.setAttribute('fill', 'transparent')
					border.setAttribute('stroke', 'transparent')
					border.setAttribute('stroke-width', '1')
					border.setAttribute('class', 'icon-hit-area')
					// Add indicator for icon click detection
					border.dataset.iconHit = 'true'
					border.style.pointerEvents = 'all'

					this.labelGroup.appendChild(border)
					this.iconBorderElement = border
				}

				this.iconBorderElement.setAttribute('x', String(iconX))
				this.iconBorderElement.setAttribute('y', String(iconY))
				this.iconBorderElement.setAttribute('width', String(iconSize))
				this.iconBorderElement.setAttribute('height', String(iconSize))

				if (this.isIconEditing) {
					this.iconBorderElement.setAttribute('stroke', '#3b82f6')
					this.iconBorderElement.setAttribute('stroke-width', '2')
				} else {
					this.iconBorderElement.setAttribute('stroke', 'transparent')
				}

			} else if (this.hasIconPlaceholder) {
				// Placeholder logic
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
					placeholder.setAttribute('rx', '3')
					placeholder.setAttribute('ry', '3')
					placeholder.setAttribute('fill', 'rgba(255,255,255,0.2)') // Suitable for dark label bg
					placeholder.setAttribute('stroke', '#ffffff')
					placeholder.setAttribute('stroke-width', '1')
					placeholder.setAttribute('stroke-dasharray', '2 1')
					placeholder.setAttribute('class', 'icon-placeholder-hit')
					placeholder.style.pointerEvents = 'all'

					this.labelGroup.appendChild(placeholder)
					this.placeholderElement = placeholder
				}

				this.placeholderElement.setAttribute('x', String(iconX))
				this.placeholderElement.setAttribute('y', String(iconY))
				this.placeholderElement.setAttribute('width', String(iconSize))
				this.placeholderElement.setAttribute('height', String(iconSize))
			} else {
				// Clean up
				if (this.iconElement) { this.iconElement.remove(); this.iconElement = null; }
				if (this.iconBorderElement) { this.iconBorderElement.remove(); this.iconBorderElement = null; }
				if (this.iconClipPath) { this.iconClipPath.remove(); this.iconClipPath = null; }
				if (this.placeholderElement) { this.placeholderElement.remove(); this.placeholderElement = null; }
			}

			// Label text - dark colors get white text, light colors get dark text
			// Since label background is darkColor (darker version of base), check if it's light or dark
			const textColor = this.isLightColor(darkColor) ? '#374151' : '#ffffff'

			// Calculate Text Position
			let textX = labelX + labelWidth / 2
			// If icon is present, text is shifted
			if (this.iconContent || this.hasIconPlaceholder) {
				// Width calculation was: labelWidth = textWidth + iconSize + iconPadding (roughly)
				// Center of text needs to be calculated relative to its own occupied space?
				// Actually text-anchor is middle.
				// If we want it perfectly centered in the REMAINING space:
				// Remaining width = labelWidth - (iconSize + iconPadding + PADDING_X) - PADDING_X ?

				// Simpler: Just position it after the icon.
				// Text start X = labelX + LABEL_PADDING_X + iconSize + iconPadding
				// But we are using text-anchor middle.
				// So we need center of text area.

				// Re-measure just text to get its width
				// const textMetricsWidth = this.measureTextWidth(this.labelText) - (iconSize + iconPadding)
				// Wait, measureTextWidth returns total width.
				// If I subtract icon part, I get text part + padding.

				// Let's use left align for simplicity when icon is present?
				// Or calculate center.

				const textStartX = labelX + LABEL_PADDING_X + iconSize + iconPadding
				// Available space for text = labelWidth - (LABEL_PADDING_X + iconSize + iconPadding) - LABEL_PADDING_X
				// Center of that space = textStartX + (AvailableSpace / 2)

				// But wait, if measureTextWidth sums them up perfectly, then we can just rely on the math.
				// textWidth (pure text) = labelWidth - 2*PADDING - iconSize - iconPadding
				// Center = textStartX + textWidth / 2

				// Let's try text-anchor start for easier positioning if icon exists? 
				// But consistency with no-icon (centered) is good.

				// Let's stick to middle anchor but calculate center properly.
				const textPartWidth = labelWidth - (LABEL_PADDING_X * 2 + iconSize + iconPadding)
				if (textPartWidth > 0) {
					textX = textStartX + textPartWidth / 2
				} else {
					textX = textStartX // Should not happen if text exists
				}
			}

			this.labelTextElement.setAttribute('x', String(textX))
			this.labelTextElement.setAttribute('y', String(labelY + LABEL_HEIGHT / 2))
			this.labelTextElement.setAttribute('text-anchor', 'middle')
			this.labelTextElement.setAttribute('dominant-baseline', 'central')
			this.labelTextElement.setAttribute('fill', textColor)
			this.labelTextElement.textContent = this.labelText
		} else {
			this.labelGroup.style.display = 'none'
		}
		
		this.state.needsRender = false
	}



	/**
	 * Set the label text
	 */
	setLabel(text: string): void {
		this.labelText = text
		this.state.needsRender = true
	}

	/**
	 * Get the label text
	 */
	getLabel(): string {
		return this.labelText
	}

	/**
	 * Set whether this frame is nested inside another frame
	 * This affects label positioning
	 */
	setIsNestedFrame(nested: boolean): void {
		if (this.isNestedFrame !== nested) {
			this.isNestedFrame = nested
			this.state.needsRender = true
		}
	}

	/**
	 * Set highlighted state (when shape is entering frame)
	 */
	setHighlighted(highlighted: boolean): void {
		if (this.highlighted !== highlighted) {
			this.highlighted = highlighted
			this.state.needsRender = true
		}
	}

	/**
	 * Toggle collapsed state (kept for compatibility but not used in UI)
	 */
	toggleCollapsed(): void {
		this.collapsed = !this.collapsed
		this.state.needsRender = true
	}

	/**
	 * Set collapsed state (kept for compatibility)
	 */
	setCollapsed(collapsed: boolean): void {
		if (this.collapsed !== collapsed) {
			this.collapsed = collapsed
			this.state.needsRender = true
		}
	}

	copy(): DiagramShape {
		const newShape = new FrameShape(
			this.layout.x,
			this.layout.y,
			this.layout.width,
			this.layout.height,
			this.labelText,
			structuredClone(this.options)
		);
		newShape.copyFrom(this);

		newShape.childIds = [...this.childIds];
		newShape.childFrameIds = [...this.childFrameIds];
		newShape.collapsed = this.collapsed;
		newShape.isNestedFrame = this.isNestedFrame;
		if (this.iconContent) newShape.iconContent = this.iconContent;
		newShape.isIconEditing = this.isIconEditing;
		newShape.hasIconPlaceholder = this.hasIconPlaceholder;

		return newShape;
	}

	/**
	 * Check if a point is inside the frame's content area
	 */
	isPointInContentArea(x: number, y: number): boolean {
		return x >= this.layout.x &&
			x <= this.layout.x + this.layout.width &&
			y >= this.layout.y &&
			y <= this.layout.y + this.layout.height
	}

	/**
	 * Check if a shape is fully contained within this frame
	 */
	containsShape(shapeX: number, shapeY: number, shapeWidth: number, shapeHeight: number): boolean {
		return shapeX >= this.layout.x &&
			shapeY >= this.layout.y &&
			shapeX + shapeWidth <= this.layout.x + this.layout.width &&
			shapeY + shapeHeight <= this.layout.y + this.layout.height
	}

	/**
	 * Check if a shape overlaps this frame by at least 50%
	 */
	containsShapeByPercentage(
		shapeX: number, 
		shapeY: number, 
		shapeWidth: number, 
		shapeHeight: number,
		percentage: number = 0.5
	): boolean {
		// Calculate intersection
		const left = Math.max(this.layout.x, shapeX)
		const right = Math.min(this.layout.x + this.layout.width, shapeX + shapeWidth)
		const top = Math.max(this.layout.y, shapeY)
		const bottom = Math.min(this.layout.y + this.layout.height, shapeY + shapeHeight)
		
		// No intersection
		if (left >= right || top >= bottom) {
			return false
		}
		
		// Calculate overlap area
		const intersectionArea = (right - left) * (bottom - top)
		const shapeArea = shapeWidth * shapeHeight
		
		// Check if intersection is at least the specified percentage of shape area
		return intersectionArea >= shapeArea * percentage
	}

	/**
	 * Add a child shape ID
	 */
	addChild(shapeId: string): void {
		if (!this.childIds.includes(shapeId)) {
			this.childIds.push(shapeId)
		}
	}

	/**
	 * Remove a child shape ID
	 */
	removeChild(shapeId: string): void {
		const index = this.childIds.indexOf(shapeId)
		if (index !== -1) {
			this.childIds.splice(index, 1)
		}
	}

	/**
	 * Check if this frame contains a child
	 */
	hasChild(shapeId: string): boolean {
		return this.childIds.includes(shapeId)
	}

	/**
	 * Add a nested frame ID
	 */
	addChildFrame(frameId: string): void {
		if (!this.childFrameIds.includes(frameId)) {
			this.childFrameIds.push(frameId)
		}
	}

	/**
	 * Remove a nested frame ID
	 */
	removeChildFrame(frameId: string): void {
		const index = this.childFrameIds.indexOf(frameId)
		if (index !== -1) {
			this.childFrameIds.splice(index, 1)
		}
	}

	/**
	 * Serialize frame-specific data
	 */
	toJSON(): object {
		return {
			// Base shape properties
			id: this.id,
			type: this.type,
			x: this.layout.x,
			y: this.layout.y,
			width: this.layout.width,
			height: this.layout.height,
			// Frame-specific properties
			labelText: this.labelText,
			collapsed: this.collapsed,
			isNestedFrame: this.isNestedFrame,
			childIds: [...this.childIds],
			childFrameIds: [...this.childFrameIds],
			options: { ...this.options },
			iconContent: this.iconContent,
			hasIconPlaceholder: this.hasIconPlaceholder
		}
	}

	/**
	 * Get the content area bounds
	 */
	getContentBounds(): { x: number; y: number; width: number; height: number } {
		return {
			x: this.layout.x,
			y: this.layout.y,
			width: this.layout.width,
			height: this.layout.height
		}
	}

	isPointOverIcon(x: number, y: number): boolean {
		if (!this.iconContent && !this.hasIconPlaceholder) return false

		// Need to calculate icon position same as render
		// This basically duplicates the logic in render/getLabelBounds
		if (!this.labelText && !this.iconContent && !this.hasIconPlaceholder) return false // Should technically be caught above

		let labelX: number
		let labelY: number

		if (this.isNestedFrame) {
			labelX = this.layout.x + this.options.padding
			labelY = this.layout.y + this.options.padding
		} else {
			labelX = this.layout.x
			labelY = this.layout.y - LABEL_HEIGHT - 4
		}

		const iconSize = LABEL_HEIGHT - 8 // 16px
		const iconX = labelX + LABEL_PADDING_X
		const iconY = labelY + (LABEL_HEIGHT - iconSize) / 2

		return (
			x >= iconX &&
			x <= iconX + iconSize &&
			y >= iconY &&
			y <= iconY + iconSize
		)
	}
}
