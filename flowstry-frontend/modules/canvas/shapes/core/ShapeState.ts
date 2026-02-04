
export class ShapeState {
	isEditingText: boolean = false
	editingTriggeredByClick: boolean = false
	editingClickPosition?: { x: number; y: number }
	selected: boolean = false
	active: boolean = false
	locked: boolean = false
	hovered: boolean = false
	resizable: boolean = true // Whether the shape can be resized (false for fixed-size shapes like ServiceCard)
	needsRender: boolean = true // Flag to indicate if shape needs to be rendered
	lastUpdated: number = Date.now() // Timestamp of last update (for scroll to content)

	// Copy state from another state object (e.g. for cloning)
	copyFrom(other: ShapeState): void {
		this.isEditingText = other.isEditingText
		this.editingTriggeredByClick = other.editingTriggeredByClick
		this.editingClickPosition = other.editingClickPosition ? { ...other.editingClickPosition } : undefined
		this.selected = other.selected
		this.active = other.active
		this.locked = other.locked
		this.hovered = other.hovered
		this.resizable = other.resizable
		this.needsRender = other.needsRender
		this.lastUpdated = other.lastUpdated
	}
}
