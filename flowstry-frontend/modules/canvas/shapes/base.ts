export type ShapeName =
	| 'rectangle'
	| 'ellipse'
	| 'diamond'
	// Geometric
	| 'triangle'
	| 'triangle-down'
	| 'triangle-right'
	| 'triangle-left'
	| 'hexagon'
	| 'pentagon'
	| 'octagon'
	// System
	| 'image'
	| 'service-card'
	| 'todo-card'
	| 'connector'
	| 'freehand'
	// Container
	| 'frame'


export interface ShapeDescriptor {
	name: ShapeName;
	previewSvg: string;
}

import { ShapeAppearance } from './core/ShapeAppearance';
import { CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE, ShapeConnectionPoints } from './core/ShapeConnectionPoints';
import { ShapeLayout } from './core/ShapeLayout';
import { ShapeState } from './core/ShapeState';

import { ShapeText } from './core/ShapeText';

import { ShapeSelectionIndicator } from './core/ShapeSelectionIndicator';

export { ShapeAppearance, ShapeConnectionPoints, ShapeLayout, ShapeSelectionIndicator, ShapeState, ShapeText };

// Re-export constants for compatibility
export { CONNECTOR_POINT_SNAP_RADIUS, EDGE_FOLLOW_DISTANCE };

// Sets the abstract class for all diagram shapes.
export abstract class DiagramShape {
	// Static flag to suppress timestamp updates during loading/deserialization
	private static suppressTimestampUpdates: boolean = false

	static setSuppressTimestampUpdates(suppress: boolean): void {
		DiagramShape.suppressTimestampUpdates = suppress
	}

	copy(): DiagramShape {
		// Default implementation: create new instance with same layout
		// This assumes the subclass has a constructor compatible with (x, y, width, height)
		// Shapes with different constructor requirements MUST override this method
		const Constructor = this.constructor as any
		const newShape = new Constructor(
			this.layout.x,
			this.layout.y,
			this.layout.width,
			this.layout.height
		)
		newShape.copyFrom(this)
		return newShape
	}

	id: string
	type: ShapeName

	element: SVGGElement // The group container
	shapeElement: SVGGraphicsElement // The actual shape (rect, ellipse, path)
	roughElement: SVGGElement | null = null // Container for roughjs output (typically Fill, behind shape)
	roughStrokeElement: SVGGElement | null = null // Container for roughjs output (Stroke, above shape)
	textElement: SVGForeignObjectElement | null = null // foreignObject for text rendering/editing

	public layout: ShapeLayout
	public appearance: ShapeAppearance
	public state: ShapeState
	public shapeText: ShapeText
	public connectionPoints: ShapeConnectionPoints
	public selection: ShapeSelectionIndicator

	parentId: string | null = null


	private _text: string = ''

	get text(): string { return this._text }
	set text(val: string) {
		if (this._text !== val) {
			this._text = val
			this.state.needsRender = true
			if (!DiagramShape.suppressTimestampUpdates && this.type !== 'connector') {
				this.state.lastUpdated = Date.now()
			}
		}
	}

	iconKey: string | null = null // Key of the icon associated with this shape
	options?: Record<string, unknown> // Generic options for extensibility

	constructor(type: ShapeName, shapeElement: SVGGraphicsElement, x = 0, y = 0, width = 1, height = 1) {
		this.id = crypto.randomUUID()
		this.type = type
		this.shapeElement = shapeElement
		
		// Create a group to contain both shape and text
		this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g')
		this.element.dataset.shapeId = this.id
		this.element.dataset.shapeType = type
		this.element.setAttribute('pointer-events', 'visiblePainted')
		
		// Append the shape to the group
		this.element.appendChild(this.shapeElement)
		
		this.layout = new ShapeLayout(x, y, width, height)
		this.appearance = new ShapeAppearance()
		this.state = new ShapeState()
		this.shapeText = new ShapeText(this.layout, this.appearance, this)
		this.connectionPoints = new ShapeConnectionPoints(this.layout)
		this.selection = new ShapeSelectionIndicator(this)

		// Register change listeners
		this.layout.addOnChange(() => {
			this.updateRenderWithTimestamp()
			// Default behavior: text area matches shape bounds
			// Subclasses can override this by adding their own listener or setting constraints
			this.shapeText.updateDimensions(this.layout.width, this.layout.height)
		})
		this.appearance.setOnChange(() => {
			this.state.needsRender = true
			// Appearance changes generally don't update lastUpdated logic as per previous implementation logic
			// But user might want it? The old setters updated needsRender=true only.
			// Let's stick to needsRender=true for appearance.
		})

		// Initialize text text dimensions
		this.shapeText.updateDimensions(width, height)
	}




	// Helper to handle layout updates (triggered by ShapeLayout callback)
	private updateRenderWithTimestamp() {
		this.state.needsRender = true
		if (!DiagramShape.suppressTimestampUpdates && this.type !== 'connector') {
			this.state.lastUpdated = Date.now()
		}
	}

	// Render updates DOM based on current state
	// Subclasses should call super.render() first, then do shape-specific rendering
	render(): void {
		if (!this.state.needsRender) return
		
		// Delegate rendering to components
		this.appearance.render(this.shapeElement)
		this.layout.render(this.shapeElement)
		
		// Update selection indicator if it exists

		// Update selection indicator if needed
		this.selection.update()
		
		this.state.needsRender = false
	}

	// Apply a transform to the entire group (for smooth dragging)
	applyTransform(translateX: number, translateY: number): void {
		this.element.setAttribute('transform', `translate(${translateX}, ${translateY})`)
	}

	// Clear transform and finalize position
	clearTransform(): void {
		this.element.removeAttribute('transform')
	}

	protected copyFrom(other: DiagramShape): void {
		this.layout.x = other.layout.x
		this.layout.y = other.layout.y
		this.layout.width = other.layout.width
		this.layout.height = other.layout.height
		this.text = other.text
		this.iconKey = other.iconKey
		this.options = other.options ? structuredClone(other.options) : undefined

		this.appearance.stroke = other.appearance.stroke
		this.appearance.strokeWidth = other.appearance.strokeWidth
		this.appearance.strokeOpacity = other.appearance.strokeOpacity
		this.appearance.strokeStyle = other.appearance.strokeStyle
		this.appearance.fill = other.appearance.fill
		this.appearance.fillOpacity = other.appearance.fillOpacity
		this.appearance.fillStyle = other.appearance.fillStyle

		this.appearance.textColor = other.appearance.textColor
		this.appearance.fontSize = other.appearance.fontSize
		this.appearance.fontFamily = other.appearance.fontFamily
		this.appearance.fontWeight = other.appearance.fontWeight
		this.appearance.fontStyle = other.appearance.fontStyle
		this.appearance.textDecoration = other.appearance.textDecoration
		this.appearance.textAlign = other.appearance.textAlign
		this.appearance.textJustify = other.appearance.textJustify
		this.appearance.drawStyle = other.appearance.drawStyle
		this.appearance.fillDrawStyle = other.appearance.fillDrawStyle
		this.appearance.strokeDrawStyle = other.appearance.strokeDrawStyle
	}
}
