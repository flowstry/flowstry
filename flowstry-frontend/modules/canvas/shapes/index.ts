import { ServiceCardContent } from '../components/canvas-shapes/ServiceCardContent'
import { TodoCardContent } from '../components/canvas-shapes/TodoCardContent'
import { GRID_SPACING } from '../consts/canvas'
import { DEFAULT_FONT_FAMILY, HAND_DRAWN_FONT_FAMILY } from '../consts/fonts'
import { RichTextManager } from '../core/RichTextManager'
import { DiagramShape, type ShapeName } from './base'
import { DiamondShape } from './basic/diamond'
import { EllipseShape } from './basic/ellipse'
import { RectangleShape } from './basic/rectangle'
import { ArrowheadType, BentConnector, ConnectorShape, ConnectorType, CurvedConnector, StraightConnector } from './connectors'
import { FrameShape } from './FrameShape'
import { FreehandMarkerType, FreehandShape } from './freehand'
import { OctagonShape } from './geometric/octagon'
import { HexagonShape, PentagonShape } from './geometric/polygons'
import { TriangleShape } from './geometric/triangle'
import { GenericImageShape } from './image/base'
import { ReactShape } from './react/ReactShape'
import { QuickConnectSide, SelectionOverlay } from './SelectionOverlay'
import { TextRenderer } from './TextRenderer'
export { DiagramShape, GenericImageShape }
export type { QuickConnectSide }

import { DiagramTool } from '../tools/base'
import { DragTool } from '../tools/DragTool'
import { DrawingTool } from '../tools/DrawingTool'
import { PanTool } from '../tools/PanTool'
import { SelectTool } from '../tools/SelectTool'
import { TextEditTool } from '../tools/TextEditTool'




import { ShapeAppearanceData } from '../core/storage/types'

// DiagramManager is responsible for managing the diagram shapes.
export class DiagramManager {
	private shapes: DiagramShape[] = []
	private selectionOverlay: SelectionOverlay | null = null
	private groupBoundaryOverlays: SelectionOverlay[] = [] // Pool of overlays for group boundaries
	private contentLayer: SVGGElement | null = null
	private editingShape: DiagramShape | null = null
	private snapToGrid: boolean = true
	private onTextEditingStop: (() => void) | null = null
	private onShapesModified: (() => void) | null = null
	private onQuickConnectDragStart: ((connector: ConnectorShape, side: QuickConnectSide, clientX: number, clientY: number) => void) | null = null

	private defaultShapeAppearance: Partial<ShapeAppearanceData> = {}

	// Groups registry - logical containers (not rendered)
	// Key: group ID, Value: { parentId: parent group ID or null for top-level groups }
	private groups: Map<string, { parentId: string | null }> = new Map()
	// Currently "focused" group (when double-clicked to select individual shape inside)
	private focusedGroupId: string | null = null

	// Currently highlighted frame (when dragging shape over it)
	private highlightedFrameId: string | null = null

	// Quick Connect preview - stores actual shapes with transparent styling
	// On click, these are committed (opacity restored, added to shapes array)
	private quickConnectPreviewConnectors: ConnectorShape[] = []
	private quickConnectPreviewShapes: DiagramShape[] = []
	private quickConnectPreviewSide: QuickConnectSide | null = null
	private quickConnectPreviewShapeId: string | null = null
	private quickConnectPreviewCount: number = 0
	private readonly QUICK_CONNECT_SPACING = GRID_SPACING * 6 // Distance between original and cloned shape
	private readonly QUICK_CONNECT_STACK_GAP = GRID_SPACING * 3 // Gap between stacked shapes

	// Tools
	private selectTool: SelectTool
	private panTool: PanTool
	private drawTool: DrawingTool
	private textEditTool: TextEditTool
	private dragTool: DragTool

	private activeTool: DiagramTool | null = null
	private tools: Map<string, DiagramTool> = new Map()
	private renderAnimationFrameId: number | null = null

	constructor(
		// private _container?: HTMLElement,
		// private _width?: number,
		// private _height?: number,
		// private _theme: 'light' | 'dark' = 'light'
	) {
		// Initialize tools
		this.selectTool = new SelectTool(this)
		this.panTool = new PanTool(this)
		this.drawTool = new DrawingTool(this)
		this.textEditTool = new TextEditTool(this)
		this.dragTool = new DragTool(this)

		// Register tools
		this.registerTool(this.selectTool)
		this.registerTool(this.panTool)
		this.registerTool(this.drawTool)
		this.registerTool(this.textEditTool)
		this.registerTool(this.dragTool)

		// Set default tool
		this.setActiveTool('Select')
		
		// Start render loop only in browser environment
		if (typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
			this.startRenderLoop()
		}
	}
	
	private startRenderLoop(): void {
		const render = () => {
			// Render all shapes that need rendering
			this.shapes.forEach(shape => {
				if (shape.state.needsRender) {
					shape.render()
				}
			})
			
			// Continue render loop
			if (typeof requestAnimationFrame !== 'undefined') {
				this.renderAnimationFrameId = requestAnimationFrame(render)
			}
		}
		
		if (typeof requestAnimationFrame !== 'undefined') {
			this.renderAnimationFrameId = requestAnimationFrame(render)
		}
	}
	
	public stopRenderLoop(): void {
		if (this.renderAnimationFrameId !== null) {
			cancelAnimationFrame(this.renderAnimationFrameId)
			this.renderAnimationFrameId = null
		}
	}

	public registerTool(tool: DiagramTool) {
		this.tools.set(tool.name, tool)
	}

	public setActiveTool(toolName: string) {
		const tool = this.tools.get(toolName)
		if (!tool) return

		if (this.activeTool) {
			this.activeTool.deactivate()
		}

		this.activeTool = tool
		this.activeTool.activate()
	}

	public getActiveTool(): DiagramTool | null {
		return this.activeTool
	}

	public createImageShape(x: number, y: number, imageUrl: string, imageName?: string, squareIcon: boolean = false): DiagramShape | null {
		const shape = new GenericImageShape(x, y, 100, 100, imageUrl, imageName, squareIcon)
		this.addShape(shape)
		this.selectShape(shape)
		return shape
	}

	// Initialize selection overlay with content layer
	public initializeSelectionOverlay(contentLayer: SVGGElement): void {
		this.contentLayer = contentLayer
		this.selectionOverlay = new SelectionOverlay()
		this.contentLayer.appendChild(this.selectionOverlay.getElement())
		this.selectionOverlay.hide()
		
		// Set up quick connect callbacks
		this.selectionOverlay.setQuickConnectCallbacks(
			(side) => this.handleQuickConnectHover(side),
			(side) => this.handleQuickConnectClick(side),
			(side, clientX, clientY) => this.handleQuickConnectDragStart(side, clientX, clientY)
		)

		// Group boundary overlays are created dynamically as needed

		// Attach any existing shapes that weren't added to DOM yet
		// This can happen if shapes were loaded before contentLayer was initialized
		this.shapes.forEach(shape => {
			if (!shape.element.parentNode && this.contentLayer) {
				this.contentLayer.appendChild(shape.element)
			}
		})
	}

	public setSnapToGrid(enabled: boolean): void {
		this.snapToGrid = enabled
	}

	public getSnapToGrid(): boolean {
		return this.snapToGrid
	}

	public setDefaultShapeAppearance(appearance: Partial<ShapeAppearanceData>) {
		this.defaultShapeAppearance = appearance
	}

	public setDrawStyle(style: 'standard' | 'handdrawn') {
		console.log("Setting global draw style (Stroke Only):", style)
		// Update selected shapes
		const selected = this.getSelectedShapes()
		let modified = false

		selected.forEach(shape => {
			if (shape.appearance.strokeDrawStyle !== style) {
				shape.appearance.strokeDrawStyle = style

				// Automatically switch to handdrawn font when enabling handdrawn style
				// Only if the current font is the default one
				if (style === 'handdrawn') {
					if (shape.appearance.fontFamily === DEFAULT_FONT_FAMILY) {
						shape.appearance.fontFamily = HAND_DRAWN_FONT_FAMILY
					}
				} else {
					// Revert to default Inter if it was the handwriting font
					if (shape.appearance.fontFamily === HAND_DRAWN_FONT_FAMILY) {
						shape.appearance.fontFamily = DEFAULT_FONT_FAMILY
					}
				}

				modified = true
			}
		})

		// Also update default for future shapes (Stroke only)
		if (this.defaultShapeAppearance.strokeDrawStyle !== style) {
			this.defaultShapeAppearance.strokeDrawStyle = style
		}

		// Notify if changes occured
		if (modified) {
			this.notifyShapesModified()
		}
	}

	public setStrokeStyle(style: 'solid' | 'dashed' | 'dotted' | 'none') {
		const selected = this.getSelectedShapes()
		let modified = false

		selected.forEach(shape => {
			if (shape.appearance.strokeStyle !== style) {
				shape.appearance.strokeStyle = style
				modified = true
			}
		})

		if (this.defaultShapeAppearance.strokeStyle !== style) {
			this.defaultShapeAppearance.strokeStyle = style
		}

		if (modified) {
			this.notifyShapesModified()
		}
	}

	public setStrokeDrawStyle(style: 'standard' | 'handdrawn') {
		const selected = this.getSelectedShapes()
		let modified = false

		selected.forEach(shape => {
			if (shape.appearance.strokeDrawStyle !== style) {
				shape.appearance.strokeDrawStyle = style
				modified = true
			}
		})

		if (this.defaultShapeAppearance.strokeDrawStyle !== style) {
			this.defaultShapeAppearance.strokeDrawStyle = style
		}

		if (modified) {
			this.notifyShapesModified()
		}
	}

	public setFillDrawStyle(style: 'standard' | 'handdrawn') {
		const selected = this.getSelectedShapes()
		let modified = false

		selected.forEach(shape => {
			if (shape.appearance.fillDrawStyle !== style) {
				shape.appearance.fillDrawStyle = style
				modified = true
			}
		})

		if (this.defaultShapeAppearance.fillDrawStyle !== style) {
			this.defaultShapeAppearance.fillDrawStyle = style
		}

		if (modified) {
			this.notifyShapesModified()
		}
	}

	public setOnTextEditingStop(callback: () => void): void {
		this.onTextEditingStop = callback
	}

	public setOnShapesModified(callback: (() => void) | null): void {
		this.onShapesModified = callback
	}

	private notifyShapesModified(): void {
		// Notify external listeners (e.g., for storage saves)
		if (this.onShapesModified) {
			this.onShapesModified()
		}
	}

	// Public method for tools to notify that shapes were modified
	public notifyShapeModified(): void {
		this.notifyShapesModified()
	}

	initializeShapes(shapes: DiagramShape[]) {
		const connectors: Array<{ connector: ConnectorShape; data: any }> = []
		const frameData: Array<{ frame: FrameShape; data: any }> = []
		
		// First pass: add all non-connector shapes (including frames)
		shapes.forEach(s => {
			let shape: DiagramShape | null = null;
			switch (s.type) {
				case 'rectangle':
					shape = new RectangleShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				case 'ellipse':
					shape = new EllipseShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				case 'diamond':
					shape = new DiamondShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				// Geometric
				case 'triangle':
				case 'triangle-down':
				case 'triangle-left':
				case 'triangle-right':
					shape = new TriangleShape(s.type, s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				case 'hexagon':
					shape = new HexagonShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				case 'pentagon':
					shape = new PentagonShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				case 'octagon':
					shape = new OctagonShape(s.layout.x, s.layout.y, s.layout.width, s.layout.height, s.appearance.fill, s.appearance.stroke, s.appearance.strokeWidth)
					break
				// System
				case 'frame':
					// Create frame and store data for relationship restoration
					const frameDataTyped = s as any
					const frame = new FrameShape(
						s.layout.x, s.layout.y, s.layout.width, s.layout.height,
						// Use saved labelText if it exists, otherwise default to empty (not 'Frame')
						// 'Frame' is only the default when creating NEW frames via createShape
						frameDataTyped.labelText !== undefined ? frameDataTyped.labelText : '',
						frameDataTyped.options || {}
					)
					// Restore frame ID to maintain references
					if (frameDataTyped.id) {
						(frame as any).id = frameDataTyped.id
						frame.element.dataset.shapeId = frameDataTyped.id
					}
					frame.collapsed = frameDataTyped.collapsed || false
					frameData.push({ frame, data: frameDataTyped })
					shape = frame
					break
				case 'connector':
					// Defer connector initialization until after all shapes are loaded
					connectors.push({ connector: null as any, data: s })
					break
			}

			if (shape) {
				// Restore drawStyle
				if (s.appearance.drawStyle) {
					shape.appearance.drawStyle = s.appearance.drawStyle
				}
				// Restore specific draw styles
				if (s.appearance.fillDrawStyle) {
					shape.appearance.fillDrawStyle = s.appearance.fillDrawStyle
				}
				if (s.appearance.strokeDrawStyle) {
					shape.appearance.strokeDrawStyle = s.appearance.strokeDrawStyle
				}

				this.addShape(shape)
			}
		})
		
		// Second pass: add connectors now that all shapes exist
		connectors.forEach(({ data: connectorData }) => {
			if (connectorData.startPoint && connectorData.endPoint && connectorData.connectorType) {
				const connector = this.createConnector(
					connectorData.connectorType,
					connectorData.startPoint,
					connectorData.endPoint,
					connectorData.startShapeId,
					connectorData.endShapeId
				)
				if (connector) {
					// Restore connector point attachments if they exist
					if (connectorData.startConnectorPoint) {
						connector.startConnectorPoint = connectorData.startConnectorPoint
					}
					if (connectorData.endConnectorPoint) {
						connector.endConnectorPoint = connectorData.endConnectorPoint
					}
					// Restore point arrays if they exist
					if (connectorData.pointsStraight) {
						connector.pointsStraight = connectorData.pointsStraight
					}
					if (connectorData.pointsBent) {
						connector.pointsBent = connectorData.pointsBent
					}
					if (connectorData.pointsCurved) {
						connector.pointsCurved = connectorData.pointsCurved
					}
					// Restore midpoint properties for curved connectors
					if (connectorData.connectorType === 'curved') {
						const curvedConnector = connector as any
						if (connectorData.midpointMode !== undefined) {
							curvedConnector.midpointMode = connectorData.midpointMode
						}
						if (connectorData.midpointRatio !== undefined) {
							curvedConnector.midpointRatio = connectorData.midpointRatio
						}
						if (connectorData.midpointOffset !== undefined) {
							curvedConnector.midpointOffset = connectorData.midpointOffset
						}
						if (connectorData.customMidpoint !== undefined) {
							curvedConnector.customMidpoint = connectorData.customMidpoint
						}
					}
					// Restore arrowhead types (always set, even if undefined, to ensure defaults are used)
					connector.startArrowheadType = connectorData.startArrowheadType ?? 'none'
					connector.endArrowheadType = connectorData.endArrowheadType ?? 'open-arrow'
					this.addShape(connector)
				}
			}
		})
		
		// Third pass: restore frame-child relationships
		frameData.forEach(({ frame, data }) => {
			// Restore childIds
			if (data.childIds && Array.isArray(data.childIds)) {
				data.childIds.forEach((childId: string) => {
					const child = this.getShapeById(childId)
					if (child) {
						child.layout.frameId = frame.id
						frame.addChild(childId)
					}
				})
			}
			// Restore childFrameIds
			if (data.childFrameIds && Array.isArray(data.childFrameIds)) {
				data.childFrameIds.forEach((childFrameId: string) => {
					const childFrame = this.getFrameById(childFrameId)
					if (childFrame) {
						childFrame.layout.frameId = frame.id
						frame.addChildFrame(childFrameId)
					}
				})
			}
			// Update visibility based on collapsed state
			if (frame.collapsed) {
				this.updateFrameChildrenVisibility(frame)
			}
		})

		// Fourth pass: update all connectors now that they're all added
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape
				connector.updateConnectorPoints()
			}
		})
	}

	// Manage diagram shapes
	public addShape(shape: DiagramShape) {
		this.shapes.push(shape)
		
		// Set shape getter for connectors so they can update their points
		if (shape.type === 'connector') {
			const connector = shape as ConnectorShape
			connector.setShapeGetter((id: string) => this.getShapeById(id))
			connector.setAllShapesGetter(() => this.getShapes())
		}
		
		// Set up self-resize callback for ReactShape (service-card and todo-card)
		if (shape.type === 'service-card' || shape.type === 'todo-card') {
			const reactShape = shape as ReactShape
			reactShape.onSelfResize = () => {
				// Update connected connectors when shape auto-resizes
				this.updateConnectedConnectorsOnResize(shape)
				// Update selection overlay if this shape is selected
				if (shape.state.selected) {
					this.updateSelectionOverlay()
				}
				// Mark as modified for storage
				this.notifyShapesModified()
			}
			// Set up selection callback - called when buttons are clicked in React components
			// This performs "deep selection" - directly selecting the shape even if it's in a group
			reactShape.onSelectShape = () => {
				// Only select if not already selected
				if (!shape.state.selected) {
					// Deselect all shapes (including any group members)
					this.shapes.forEach(s => {
						if (s.state.selected) {
							s.state.selected = false
							s.selection.hide()
						}
					})
					// Directly select just this shape (bypassing group selection logic)
					shape.state.selected = true
					shape.selection.show()
					this.updateSelectionOverlay()
				}
			}
		}

		// Add shape element to the DOM if content layer exists
		if (this.contentLayer) {
			this.contentLayer.appendChild(shape.element)
		}
		
		this.notifyShapesModified()
	}

	/**
	 * Dismiss all interactions on React shapes (close modals, blur inputs).
	 * Called when canvas receives pointerdown outside of shapes.
	 * Dispatches a global event that React shape components listen for.
	 */
	public dismissReactShapeInteractions(): void {
		window.dispatchEvent(new CustomEvent('reactshape-dismiss'))
	}

	public removeShape(shape: DiagramShape) {
		this.shapes = this.shapes.filter(s => s !== shape)
		
		// Remove shape element from DOM
		if (shape.element.parentNode) {
			shape.element.parentNode.removeChild(shape.element)
		}
		
		// Clear connector references to the deleted shape
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape
				let updated = false
				if (connector.startShapeId === shape.id) {
					connector.startShapeId = null
					connector.startConnectorPoint = null
					connector.startConnectorPointDirection = null
					updated = true
				}
				if (connector.endShapeId === shape.id) {
					connector.endShapeId = null
					connector.endConnectorPoint = null
					connector.endConnectorPointDirection = null
					updated = true
				}
				if (updated) {
					// Force immediate render to update handle fill
					connector.state.needsRender = true
					connector.render()
				}
			}
		})

		this.notifyShapesModified()
	}

	public getShapes() {
		return this.shapes
	}

	// Manage shape selection
	public selectShape(shape: DiagramShape) {	
		shape.state.selected = true
	}

	public deselectShape(shape: DiagramShape) {	
		shape.state.selected = false
		// Trigger re-render so React components can respond to selection change
		shape.state.needsRender = true
		// Hide individual selection indicator when deselected
		shape.selection.hide()
	}

	public deselectAllShapes() {
		this.shapes.forEach(s => {
			s.state.selected = false
			// Trigger re-render so React components can respond to selection change
			s.state.needsRender = true
			s.selection.hide()
		})
	}

	public getSelectedShapes() {
		return this.shapes.filter(s => s.state.selected)
	}

	// =====================================
	// Grouping functionality
	// =====================================

	/**
	 * Create a group from selected shapes (⌘G / Ctrl+G)
	 * Supports nested grouping - can group groups together with other groups/shapes
	 */
	public groupSelectedShapes(): string | null {
		const selected = this.getSelectedShapes()

		if (selected.length < 2) {
			return null
		}

		// Identify which groups are fully selected, and which shapes are ungrouped
		const { fullySelectedGroupIds, ungroupedShapes, commonParentLevel } = this.analyzeSelectionForGrouping(selected)

		// We need at least 2 "things" to group (groups count as 1 thing each, ungrouped shapes count as 1 each)
		const totalItems = fullySelectedGroupIds.size + ungroupedShapes.length
		if (totalItems < 2) {
			return null
		}

		// Create a new parent group
		const newGroupId = crypto.randomUUID()
		this.groups.set(newGroupId, { parentId: commonParentLevel })

		// For fully selected groups: update their parentId in the groups map
		fullySelectedGroupIds.forEach(groupId => {
			const groupData = this.groups.get(groupId)
			if (groupData) {
				groupData.parentId = newGroupId
			}
		})

		// For ungrouped shapes: set their parentId
		ungroupedShapes.forEach(shape => {
			shape.layout.parentId = newGroupId
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
		return newGroupId
	}

	/**
	 * Analyze selection to understand what groups/shapes are selected for grouping
	 */
	private analyzeSelectionForGrouping(selected: DiagramShape[]): {
		fullySelectedGroupIds: Set<string>,
		ungroupedShapes: DiagramShape[],
		commonParentLevel: string | null
	} {
		const topmostGroupIds = new Set<string>()
		const ungroupedShapes: DiagramShape[] = []
		const parentLevels = new Set<string | null>()

		// Collect TOPMOST groups for each shape (not immediate parent)
		selected.forEach(shape => {
			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId) {
				topmostGroupIds.add(topmostGroupId)
				// The parent of this topmost group is the level
				const groupData = this.groups.get(topmostGroupId)
				parentLevels.add(groupData?.parentId ?? null)
			} else {
				ungroupedShapes.push(shape)
				parentLevels.add(shape.layout.parentId)
			}
		})

		// Check which TOPMOST groups have all their shapes selected (fully selected)
		const fullySelectedGroupIds = new Set<string>()
		topmostGroupIds.forEach(groupId => {
			const groupShapes = this.getAllShapesInGroupRecursive(groupId)
			const allSelected = groupShapes.every(s => s.state.selected)
			if (allSelected) {
				fullySelectedGroupIds.add(groupId)
			}
		})

		// Determine common parent level - for simplicity, use null if mixed
		const commonParentLevel = parentLevels.size === 1 ? Array.from(parentLevels)[0] : null

		return {
			fullySelectedGroupIds,
			ungroupedShapes,
			commonParentLevel
		}
	}

	/**
	 * Ungroup selected shapes (⌘⇧G / Ctrl+Shift+G)
	 * Only removes the OUTERMOST grouping - keeps nested groups intact
	 */
	public ungroupSelectedShapes(): void {
		const selected = this.getSelectedShapes()
		if (selected.length === 0) return

		// Find the topmost group that contains all selected shapes
		const topmostGroupId = this.getTopmostGroupId(selected[0])
		if (!topmostGroupId || !this.groups.has(topmostGroupId)) {
			// Fallback: try the direct parent
			const directGroupId = selected[0].layout.parentId
			if (!directGroupId || !this.groups.has(directGroupId)) return
			this.ungroupSingleGroup(directGroupId)
			return
		}

		this.ungroupSingleGroup(topmostGroupId)
	}

	/**
	 * Helper to ungroup a single group - promotes its direct children (shapes and child groups) to parent level
	 */
	private ungroupSingleGroup(groupId: string): void {
		const groupData = this.groups.get(groupId)
		if (!groupData) return

		const parentGroupId = groupData.parentId ?? null

		// Promote all DIRECT shapes in this group to the parent level
		const directShapes = this.getShapesInGroup(groupId)
		directShapes.forEach(shape => {
			shape.layout.parentId = parentGroupId
		})

		// Promote all CHILD GROUPS of this group to the parent level
		const childGroupIds = this.getChildGroupIds(groupId)
		childGroupIds.forEach(childGroupId => {
			const childGroupData = this.groups.get(childGroupId)
			if (childGroupData) {
				childGroupData.parentId = parentGroupId
			}
		})

		// Remove the group from registry
		this.groups.delete(groupId)

		// Clear focused group if it was this group
		if (this.focusedGroupId === groupId) {
			this.focusedGroupId = null
		}

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Get all shapes that belong DIRECTLY to a group (one level only)
	 */
	public getShapesInGroup(groupId: string): DiagramShape[] {
		return this.shapes.filter(s => s.layout.parentId === groupId)
	}

	/**
	 * Get all child group IDs that are direct children of the given group
	 */
	public getChildGroupIds(groupId: string): string[] {
		const childGroupIds: string[] = []
		this.groups.forEach((data, id) => {
			if (data.parentId === groupId) {
				childGroupIds.push(id)
			}
		})
		return childGroupIds
	}

	/**
	 * Get ALL shapes in a group including those in nested child groups (recursive)
	 */
	public getAllShapesInGroupRecursive(groupId: string): DiagramShape[] {
		const directShapes = this.getShapesInGroup(groupId)
		const childGroupIds = this.getChildGroupIds(groupId)

		// Recursively get shapes from child groups
		let allShapes = [...directShapes]
		childGroupIds.forEach(childGroupId => {
			const childShapes = this.getAllShapesInGroupRecursive(childGroupId)
			allShapes = allShapes.concat(childShapes)
		})

		return allShapes
	}

	/**
	 * Get the topmost group ID for a shape (for selection)
	 * If focusedGroupId is set, stop at that level
	 */
	public getTopmostGroupId(shape: DiagramShape): string | null {
		if (!shape.layout.parentId) return null

		let currentGroupId: string | null = shape.layout.parentId
		let topmostGroupId: string | null = shape.layout.parentId

		while (currentGroupId) {
			// If we've reached the focused group, stop here
			if (currentGroupId === this.focusedGroupId) {
				return currentGroupId
			}

			const groupData = this.groups.get(currentGroupId)
			if (!groupData) break

			if (groupData.parentId) {
				// This group has a parent - keep going up
				topmostGroupId = groupData.parentId
				currentGroupId = groupData.parentId
			} else {
				// Top-level group
				break
			}
		}

		return topmostGroupId
	}

	/**
	 * Find the smallest group that contains ALL the given shapes
	 * Returns null if shapes have no common group
	 */
	public findSmallestContainingGroup(shapes: DiagramShape[]): string | null {
		if (shapes.length === 0) return null

		// Get all ancestor chains for each shape (from immediate parent up to root)
		const getAncestorChain = (shape: DiagramShape): string[] => {
			const chain: string[] = []
			let groupId = shape.layout.parentId
			while (groupId && this.groups.has(groupId)) {
				chain.push(groupId)
				const groupData = this.groups.get(groupId)
				groupId = groupData?.parentId ?? null
			}
			return chain
		}

		// Get first shape's ancestor chain
		const firstChain = getAncestorChain(shapes[0])
		if (firstChain.length === 0) return null

		// Find first common ancestor (check each level from bottom up)
		for (const groupId of firstChain) {
			const groupShapes = this.getAllShapesInGroupRecursive(groupId)
			// If this group contains ALL selected shapes, it's a candidate
			const containsAll = shapes.every(s => groupShapes.includes(s))
			if (containsAll) {
				return groupId
			}
		}

		return null
	}

	/**
	 * Get the parent ID of a group
	 */
	public getGroupParentId(groupId: string): string | null {
		const groupData = this.groups.get(groupId)
		return groupData?.parentId ?? null
	}

	/**
	 * Check if a given ID is a registered group
	 */
	public isGroup(id: string): boolean {
		return this.groups.has(id)
	}

	/**
	 * Select all shapes in a group (including nested groups)
	 */
	public selectAllShapesInGroup(groupId: string): void {
		const shapes = this.getAllShapesInGroupRecursive(groupId)
		shapes.forEach(shape => this.selectShape(shape))
	}

	/**
	 * Expand selection to include all shapes in any group that has a member selected
	 * Resolves to the TOPMOST group (outermost parent) for nested groups
	 * This ensures that if ANY shape in a nested group is selected, ALL shapes in the outermost group are selected
	 */
	public expandSelectionToIncludeFullGroups(): void {
		const selectedShapes = this.getSelectedShapes()
		const topmostGroupIds = new Set<string>()

		// Find all unique TOPMOST group IDs from selected shapes
		selectedShapes.forEach(shape => {
			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId) {
				topmostGroupIds.add(topmostGroupId)
			}
		})

		// Select all shapes in each topmost group (using recursive to include nested groups)
		topmostGroupIds.forEach(groupId => {
			const allGroupShapes = this.getAllShapesInGroupRecursive(groupId)
			allGroupShapes.forEach(shape => {
				if (!shape.state.selected) {
					this.selectShape(shape)
				}
			})
		})
	}

	/**
	 * Set the focused group (for double-click to select individual shapes)
	 */
	public setFocusedGroup(groupId: string | null): void {
		this.focusedGroupId = groupId
	}

	public getFocusedGroup(): string | null {
		return this.focusedGroupId
	}

	/**
	 * Check if selected shapes can be grouped
	 * Supports nested grouping - checks if there are at least 2 groupable items (groups or ungrouped shapes)
	 */
	public canGroupSelectedShapes(): boolean {
		const selected = this.getSelectedShapes()
		if (selected.length < 2) return false

		const { fullySelectedGroupIds, ungroupedShapes } = this.analyzeSelectionForGrouping(selected)
		const totalItems = fullySelectedGroupIds.size + ungroupedShapes.length
		return totalItems >= 2
	}

	/**
	 * Check if selected shapes can be ungrouped
	 * Returns true if all selected shapes belong to the same topmost group
	 */
	public canUngroupSelectedShapes(): boolean {
		const selected = this.getSelectedShapes()
		if (selected.length === 0) return false

		// Check if all shapes resolve to the same topmost group
		const firstTopmostGroupId = this.getTopmostGroupId(selected[0])
		if (!firstTopmostGroupId || !this.groups.has(firstTopmostGroupId)) return false

		const allSameTopmost = selected.every(s => this.getTopmostGroupId(s) === firstTopmostGroupId)
		if (!allSameTopmost) return false

		// Check if entire topmost group is selected
		const allGroupShapes = this.getAllShapesInGroupRecursive(firstTopmostGroupId)
		return allGroupShapes.length === selected.length && allGroupShapes.every(s => s.state.selected)
	}

	/**
	 * Get groups for serialization
	 */
	public getGroups(): Record<string, { parentId: string | null }> {
		const result: Record<string, { parentId: string | null }> = {}
		this.groups.forEach((data, id) => {
			result[id] = { parentId: data.parentId }
		})
		return result
	}

	/**
	 * Set groups from deserialization
	 */
	public setGroups(groups: Record<string, { parentId: string | null }>): void {
		this.groups.clear()
		for (const [id, data] of Object.entries(groups)) {
			this.groups.set(id, { parentId: data.parentId })
		}
	}

	/**
	 * Clear all groups
	 */
	public clearGroups(): void {
		this.groups.clear()
		this.focusedGroupId = null
	}

	// =====================================
	// Frame Management
	// =====================================

	/**
	 * Create a new frame at the specified position
	 */
	public createFrame(x: number, y: number, width = 200, height = 150, label = 'Frame'): FrameShape {
		const frame = new FrameShape(x, y, width, height, label)
		this.addShape(frame)
		return frame
	}

	/**
	 * Get all frames in the diagram
	 */
	public getFrames(): FrameShape[] {
		return this.shapes.filter(s => s.type === 'frame') as FrameShape[]
	}

	/**
	 * Get a frame by ID
	 */
	public getFrameById(id: string): FrameShape | null {
		const shape = this.getShapeById(id)
		return shape?.type === 'frame' ? (shape as FrameShape) : null
	}

	/**
	 * Add a shape to a frame
	 * Also ensures the shape is rendered above the frame (higher z-order)
	 */
	public addShapeToFrame(shapeId: string, frameId: string): void {
		const shape = this.getShapeById(shapeId)
		const frame = this.getFrameById(frameId)

		if (!shape || !frame) return
		if (shape.type === 'frame') {
			// If adding a frame to a frame, use child frames list
			frame.addChildFrame(shapeId)
		} else {
			frame.addChild(shapeId)
		}
		shape.layout.frameId = frameId

		// Ensure the shape is above the frame in z-order
		// Move the shape to just after the frame (or to end if frame is already at end)
		this.ensureShapeAboveFrame(shape, frame)

		this.notifyShapesModified()
	}

	/**
	 * Ensure a shape is rendered above a frame (higher z-order)
	 * Also elevates connectors connected to this shape
	 */
	private ensureShapeAboveFrame(shape: DiagramShape, frame: FrameShape): void {
		const frameIndex = this.shapes.indexOf(frame)
		const shapeIndex = this.shapes.indexOf(shape)

		if (frameIndex === -1 || shapeIndex === -1) return

		// If shape is already above frame, nothing to do for the shape itself
		if (shapeIndex <= frameIndex) {
			// Remove shape from current position
			this.shapes.splice(shapeIndex, 1)

			// Find the new frame index after removal
			const newFrameIndex = this.shapes.indexOf(frame)

			// Insert shape right after the frame
			this.shapes.splice(newFrameIndex + 1, 0, shape)

			// Update DOM order
			if (this.contentLayer) {
				this.contentLayer.appendChild(shape.element)
			}
		}

		// Also elevate connectors connected to this shape
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape
				if (connector.startShapeId === shape.id || connector.endShapeId === shape.id) {
					const connectorIndex = this.shapes.indexOf(connector)
					const currentFrameIndex = this.shapes.indexOf(frame)

					if (connectorIndex !== -1 && connectorIndex <= currentFrameIndex) {
						// Remove connector from current position
						this.shapes.splice(connectorIndex, 1)
						// Find new frame index
						const updatedFrameIndex = this.shapes.indexOf(frame)
						// Insert after frame
						this.shapes.splice(updatedFrameIndex + 1, 0, connector)
						// Update DOM
						if (this.contentLayer) {
							this.contentLayer.appendChild(connector.element)
						}
					}
				}
			}
		})

		// Ensure selection overlay stays on top
		if (this.contentLayer && this.selectionOverlay) {
			this.contentLayer.appendChild(this.selectionOverlay.getElement())
		}
	}

	/**
	 * Remove a shape from its current frame
	 */
	public removeShapeFromFrame(shapeId: string): void {
		const shape = this.getShapeById(shapeId)
		if (!shape || !shape.layout.frameId) return

		const frame = this.getFrameById(shape.layout.frameId)
		if (frame) {
			if (shape.type === 'frame') {
				frame.removeChildFrame(shapeId)
			} else {
				frame.removeChild(shapeId)
			}
		}
		shape.layout.frameId = null
		this.notifyShapesModified()
	}

	/**
	 * Get the frame that contains a shape
	 */
	public getFrameForShape(shapeId: string): FrameShape | null {
		const shape = this.getShapeById(shapeId)
		if (!shape || !shape.layout.frameId) return null
		return this.getFrameById(shape.layout.frameId)
	}

	/**
	 * Rebuild frame relationships and fix z-order after loading
	 * This ensures frame.childIds are populated from shape.layout.frameId
	 * and all frame children are rendered above their parent frames
	 */
	public rebuildFrameRelationshipsAndZOrder(): void {
		const frames = this.getFrames()

		// Clear existing childIds as we'll rebuild them
		for (const frame of frames) {
			frame.childIds = []
			frame.childFrameIds = []
		}

		// Rebuild childIds from shape.layout.frameId
		for (const shape of this.shapes) {
			if (shape.layout.frameId) {
				const frame = this.getFrameById(shape.layout.frameId)
				if (frame) {
					if (shape.type === 'frame') {
						frame.addChildFrame(shape.id)
							; (shape as FrameShape).setIsNestedFrame(true)
					} else {
						frame.addChild(shape.id)
					}
				}
			}
		}

		// Now fix z-order: ensure all children are above their parent frames
		// We do this by processing frames in order and moving their children after them
		for (const frame of frames) {
			const frameIndex = this.shapes.indexOf(frame)
			if (frameIndex === -1) continue

			// Get all direct children (both shapes and nested frames)
			const childShapes = this.shapes.filter(s =>
				s.layout.frameId === frame.id && s.id !== frame.id
			)

			// Move each child that's before the frame to after the frame
			for (const child of childShapes) {
				const childIndex = this.shapes.indexOf(child)
				if (childIndex !== -1 && childIndex < frameIndex) {
					// Remove child from current position
					this.shapes.splice(childIndex, 1)
					// Find new frame index after removal
					const newFrameIndex = this.shapes.indexOf(frame)
					// Insert child after frame
					this.shapes.splice(newFrameIndex + 1, 0, child)
				}
			}
		}

		// Update DOM order to match shapes array
		if (this.contentLayer) {
			// Remove all shapes from DOM
			for (const shape of this.shapes) {
				if (shape.element.parentNode) {
					shape.element.parentNode.removeChild(shape.element)
				}
			}
			// Re-append in correct order
			for (const shape of this.shapes) {
				this.contentLayer.appendChild(shape.element)
			}
			// Ensure selection overlay is on top
			if (this.selectionOverlay) {
				this.contentLayer.appendChild(this.selectionOverlay.getElement())
			}
		}
	}

	/**
	 * Get all shapes inside a frame (direct children only)
	 */
	public getShapesInFrame(frameId: string): DiagramShape[] {
		return this.shapes.filter(s => s.layout.frameId === frameId && s.type !== 'frame')
	}

	/**
	 * Get all shapes inside a frame including nested frames recursively
	 */
	public getAllShapesInFrameRecursive(frameId: string): DiagramShape[] {
		const directShapes = this.getShapesInFrame(frameId)
		const frame = this.getFrameById(frameId)

		if (!frame) return directShapes

		// Get shapes from nested frames
		let allShapes = [...directShapes]
		frame.childFrameIds.forEach(childFrameId => {
			const childShapes = this.getAllShapesInFrameRecursive(childFrameId)
			allShapes = allShapes.concat(childShapes)
		})

		return allShapes
	}

	/**
	 * Expand a frame to fit all its children with padding.
	 * Used when adding shapes via quick connect to a frame.
	 */
	private expandFrameToFitChildren(frame: FrameShape): void {
		const children = this.getShapesInFrame(frame.id)
		if (children.length === 0) return

		// Calculate bounding box of all children
		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		for (const child of children) {
			const bbox = child.layout.getBBox()
			minX = Math.min(minX, bbox.x)
			minY = Math.min(minY, bbox.y)
			maxX = Math.max(maxX, bbox.x + bbox.width)
			maxY = Math.max(maxY, bbox.y + bbox.height)
		}

		// Add padding around the children
		const padding = 20
		const labelOffset = 30 // Account for the frame label

		// Calculate new frame bounds
		const newX = Math.min(frame.layout.x, minX - padding)
		const newY = Math.min(frame.layout.y, minY - padding - labelOffset)
		const newRight = Math.max(frame.layout.x + frame.layout.width, maxX + padding)
		const newBottom = Math.max(frame.layout.y + frame.layout.height, maxY + padding)
		const newWidth = newRight - newX
		const newHeight = newBottom - newY

		// Only resize if frame needs to expand
		if (newX !== frame.layout.x || newY !== frame.layout.y || newWidth !== frame.layout.width || newHeight !== frame.layout.height) {
			frame.layout.resize(newX, newY, newWidth, newHeight)
			frame.render()
		}
	}

	/**
	 * Find which frame contains a point (for drop target detection)
	 * Returns the smallest (most nested) frame that contains the point
	 */
	public findFrameAtPoint(x: number, y: number): FrameShape | null {
		const frames = this.getFrames()

		// Find all frames that contain this point
		const containingFrames = frames.filter(frame =>
			frame.isPointInContentArea(x, y) && !frame.collapsed
		)

		if (containingFrames.length === 0) return null

		// Return the smallest frame (most area = least likely to be the target)
		// Smaller frames should take priority
		return containingFrames.reduce((smallest, current) => {
			const smallestArea = smallest.layout.width * smallest.layout.height
			const currentArea = current.layout.width * current.layout.height
			return currentArea < smallestArea ? current : smallest
		})
	}

	/**
	 * Check which frame would contain a shape based on 50%+ overlap
	 * For frames, also ensures no circular nesting
	 * @param requireAboveFrame If true, only match frames that the shape is rendered above (higher z-index)
	 */
	public checkFrameContainment(shape: DiagramShape, requireAboveFrame: boolean = false): FrameShape | null {
		const frames = this.getFrames()

		// For frames, we need to exclude itself and any child frames to prevent circular nesting
		const isFrameShape = shape.type === 'frame'
		const frameShape = isFrameShape ? (shape as FrameShape) : null
		const childFrameIds = frameShape?.childFrameIds || []

		// Get shape's index for z-order comparison
		const shapeIndex = requireAboveFrame ? this.shapes.indexOf(shape) : -1

		// Find frames that contain 50%+ of the shape
		const containingFrames = frames.filter(frame => {
			// Exclude self
			if (frame.id === shape.id) return false
			// Exclude current parent frame
			if (frame.id === shape.layout.frameId) return false
			// Exclude collapsed frames
			if (frame.collapsed) return false
			// For frames, exclude child frames (prevent circular nesting)
			if (isFrameShape && childFrameIds.includes(frame.id)) return false
			// If requireAboveFrame, only consider frames that are below this shape in z-order
			// Shape must be ABOVE the frame (higher index) for attachment
			if (requireAboveFrame) {
				const frameIndex = this.shapes.indexOf(frame)
				// shapeIndex > frameIndex means shape is above frame (renders after/on top)
				if (shapeIndex === -1 || frameIndex === -1 || shapeIndex <= frameIndex) {
					return false // Shape is below or at same level as frame, or not found
				}
			}
			// Check containment
			return frame.containsShapeByPercentage(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, 0.5)
		})

		if (containingFrames.length === 0) return null

		// Return the smallest matching frame
		return containingFrames.reduce((smallest, current) => {
			const smallestArea = smallest.layout.width * smallest.layout.height
			const currentArea = current.layout.width * current.layout.height
			return currentArea < smallestArea ? current : smallest
		})
	}

	/**
	 * Auto-assign a shape to a frame if it's inside one
	 * Called when shape is dropped or created
	 * Now also supports nested frames
	 * Grouped shapes are handled at the group level
	 * @param requireAboveFrame If true, only attach to frames that are below this shape in z-order
	 */
	public autoAssignToFrame(shape: DiagramShape, requireAboveFrame: boolean = false): void {
		// Shapes in groups - check the group's containment instead
		if (shape.layout.parentId) {
			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId) {
				this.autoAssignGroupToFrame(topmostGroupId, requireAboveFrame)
			}
			return
		}

		const targetFrame = this.checkFrameContainment(shape, requireAboveFrame)

		if (targetFrame) {
			// Remove from old frame if any
			if (shape.layout.frameId && shape.layout.frameId !== targetFrame.id) {
				this.removeShapeFromFrame(shape.id)
			}
			// Add to new frame
			if (shape.layout.frameId !== targetFrame.id) {
				this.addShapeToFrame(shape.id, targetFrame.id)
				// If this is a frame, mark it as nested
				if (shape.type === 'frame') {
					(shape as FrameShape).setIsNestedFrame(true)
				}
			}
		} else if (shape.type === 'frame' && shape.layout.frameId === null) {
			// Frame is not inside any other frame, mark as top-level
			(shape as FrameShape).setIsNestedFrame(false)
		}
	}

	/**
	 * Get the bounding box of a group (combined bounds of all shapes)
	 */
	public getGroupBounds(groupId: string): { x: number; y: number; width: number; height: number } | null {
		const shapes = this.getAllShapesInGroupRecursive(groupId)
		if (shapes.length === 0) return null

		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		for (const shape of shapes) {
			const bbox = shape.layout.getBBox()
			minX = Math.min(minX, bbox.x)
			minY = Math.min(minY, bbox.y)
			maxX = Math.max(maxX, bbox.x + bbox.width)
			maxY = Math.max(maxY, bbox.y + bbox.height)
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		}
	}

	/**
	 * Auto-assign all shapes in a group to a frame if the group is 50%+ inside
	 * @param requireAboveFrame If true, only attach to frames that all group shapes are above in z-order
	 */
	public autoAssignGroupToFrame(groupId: string, requireAboveFrame: boolean = false): void {
		const groupBounds = this.getGroupBounds(groupId)
		if (!groupBounds) return

		const frames = this.getFrames()
		const shapes = this.getAllShapesInGroupRecursive(groupId)

		// Get the minimum z-index of any shape in the group (for z-order check)
		let minShapeIndex = Infinity
		if (requireAboveFrame) {
			for (const shape of shapes) {
				const idx = this.shapes.indexOf(shape)
				if (idx !== -1 && idx < minShapeIndex) {
					minShapeIndex = idx
				}
			}
		}

		// Find frames that contain 50%+ of the group
		const containingFrames = frames.filter(frame => {
			// If requireAboveFrame, only consider frames below all group shapes
			// All group shapes must be ABOVE the frame (higher index) for attachment
			if (requireAboveFrame) {
				const frameIndex = this.shapes.indexOf(frame)
				// minShapeIndex > frameIndex means all shapes are above frame
				if (minShapeIndex === Infinity || frameIndex === -1 || minShapeIndex <= frameIndex) {
					return false // Group has no shapes, frame not found, or some shape is below frame
				}
			}
			return frame.containsShapeByPercentage(
				groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height, 0.5
			)
		})

		// Get the smallest containing frame
		let targetFrame: FrameShape | null = null
		if (containingFrames.length > 0) {
			targetFrame = containingFrames.reduce((smallest, current) => {
				const smallestArea = smallest.layout.width * smallest.layout.height
				const currentArea = current.layout.width * current.layout.height
				return currentArea < smallestArea ? current : smallest
			})
		}

		// Update all shapes in the group
		for (const shape of shapes) {
			if (targetFrame) {
				// Remove from old frame if different
				if (shape.layout.frameId && shape.layout.frameId !== targetFrame.id) {
					this.removeShapeFromFrame(shape.id)
				}
				// Add to new frame
				if (shape.layout.frameId !== targetFrame.id) {
					this.addShapeToFrame(shape.id, targetFrame.id)
				}
			} else {
				// Remove from any frame
				if (shape.layout.frameId) {
					this.removeShapeFromFrame(shape.id)
				}
			}
		}
	}

	/**
	 * Check if shape should be detached from frame (50%+ outside)
	 * Called when shape is moved
	 * Grouped shapes are handled at the group level
	 */
	public detachIfOutside(shape: DiagramShape): void {
		// Shapes in groups - check the group's containment
		if (shape.layout.parentId) {
			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId) {
				this.autoAssignGroupToFrame(topmostGroupId)
			}
			return
		}
		if (!shape.layout.frameId || shape.type === 'frame') return

		const frame = this.getFrameById(shape.layout.frameId)
		if (!frame) return

		// Check if still 50%+ inside
		const stillInside = frame.containsShapeByPercentage(
			shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, 0.5
		)

		if (!stillInside) {
			this.removeShapeFromFrame(shape.id)

			// Check if it entered a different frame
			this.autoAssignToFrame(shape)
		}
	}

	/**
	 * Update frame containment for ALL shapes
	 * Called when a frame is resized - shapes may enter or leave
	 */
	public updateAllFrameContainments(): void {
		const shapes = this.getShapes()
		const frames = this.getFrames()

		for (const shape of shapes) {
			// Skip updating frames for containment (handled separately via nested frame logic)
			if (shape.type === 'frame') continue
			// Skip shapes in groups - they are handled at group level below
			if (shape.layout.parentId) continue

			// Check current frame assignment
			if (shape.layout.frameId) {
				const currentFrame = this.getFrameById(shape.layout.frameId)
				if (currentFrame) {
					// Check if still 50%+ inside
					const stillInside = currentFrame.containsShapeByPercentage(
						shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, 0.5
					)

					if (!stillInside) {
						// Remove from frame
						this.removeShapeFromFrame(shape.id)
						// Check if it should go to a different frame (require z-order check)
						this.autoAssignToFrame(shape, true)
					}
				}
			} else {
				// Shape not in any frame - check if it should be (require z-order check)
				this.autoAssignToFrame(shape, true)
			}
		}

		// Handle groups - check each group's containment
		const processedGroups = new Set<string>()
		for (const shape of shapes) {
			if (!shape.layout.parentId) continue

			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId && !processedGroups.has(topmostGroupId)) {
				processedGroups.add(topmostGroupId)
				this.autoAssignGroupToFrame(topmostGroupId, true) // Require z-order check
			}
		}

		// Also update nested frame assignments
		for (const frame of frames) {
			if (frame.layout.frameId) {
				// This frame was in another frame - check if still inside
				const parentFrame = this.getFrameById(frame.layout.frameId)
				if (parentFrame) {
					const stillInside = parentFrame.containsShapeByPercentage(
						frame.layout.x, frame.layout.y, frame.layout.width, frame.layout.height, 0.5
					)
					if (!stillInside) {
						// Remove from parent frame
						this.removeShapeFromFrame(frame.id)
						frame.setIsNestedFrame(false)
						// Check if it should go to a different frame
						this.autoAssignToFrame(frame)
					}
				}
			} else {
				// Frame not in any other frame - check if it should be
				this.autoAssignToFrame(frame)
			}
		}
	}

	/**
	 * Set the highlighted frame (for visual feedback during drag)
	 */
	public setHighlightedFrame(frameId: string | null): void {
		// Clear previous highlight
		if (this.highlightedFrameId) {
			const previousFrame = this.getFrameById(this.highlightedFrameId)
			if (previousFrame) {
				previousFrame.setHighlighted(false)
			}
		}

		this.highlightedFrameId = frameId

		// Set new highlight
		if (frameId) {
			const newFrame = this.getFrameById(frameId)
			if (newFrame) {
				newFrame.setHighlighted(true)
			}
		}
	}

	/**
	 * Update frame highlight based on shape position during drag
	 * Also elevates dragged shapes above the target frame for visual clarity
	 */
	public updateFrameHighlightForDrag(shape: DiagramShape): void {
		if (shape.type === 'frame') {
			this.setHighlightedFrame(null)
			return
		}

		const targetFrame = this.checkFrameContainment(shape)
		const targetFrameId = targetFrame?.id || null

		// Only update if changed
		if (targetFrameId !== this.highlightedFrameId) {
			this.setHighlightedFrame(targetFrameId)

			// When entering a frame, ensure all dragged shapes are rendered above the frame
			if (targetFrame && this.contentLayer) {
				// Get all selected shapes (handles groups - all group members are selected)
				const selectedShapes = this.getSelectedShapes()

				// Move each selected shape's element to the end (on top)
				for (const selectedShape of selectedShapes) {
					if (selectedShape.element.parentNode === this.contentLayer) {
						this.contentLayer.appendChild(selectedShape.element)
					}
				}

				// Ensure selection overlay stays on top
				if (this.selectionOverlay) {
					this.contentLayer.appendChild(this.selectionOverlay.getElement())
				}
			}
		}
	}

	/**
	 * Clear frame highlight (call when drag ends)
	 */
	public clearFrameHighlight(): void {
		this.setHighlightedFrame(null)
	}

	/**
	 * Move all children when a frame is moved
	 */
	public moveFrameChildren(frame: FrameShape, dx: number, dy: number): void {
		// Move direct shape children
		frame.childIds.forEach(childId => {
			const child = this.getShapeById(childId)
			if (child) {
				child.layout.move(dx, dy)
				// Update connectors connected to this shape
				this.updateConnectorsForShape(child, dx, dy)
				// Update text position to stay connected to shape
				this.updateShapeText(child)
			}
		})

		// Move nested frames (and their children recursively)
		frame.childFrameIds.forEach(childFrameId => {
			const childFrame = this.getFrameById(childFrameId)
			if (childFrame) {
				childFrame.layout.move(dx, dy)
				// Recursively move the nested frame's children
				this.moveFrameChildren(childFrame, dx, dy)
				// Update text position for the frame itself
				this.updateShapeText(childFrame)
			}
		})
	}

	/**
	 * Toggle frame collapsed state
	 */
	public toggleFrameCollapsed(frameId: string): void {
		const frame = this.getFrameById(frameId)
		if (!frame) return

		frame.toggleCollapsed()

		// Hide/show children based on collapsed state
		this.updateFrameChildrenVisibility(frame)
		this.notifyShapesModified()
	}

	/**
	 * Update visibility of frame children based on collapsed state
	 */
	private updateFrameChildrenVisibility(frame: FrameShape): void {
		const shouldHide = frame.collapsed

		// Update direct children visibility
		frame.childIds.forEach(childId => {
			const child = this.getShapeById(childId)
			if (child) {
				child.element.style.display = shouldHide ? 'none' : ''
			}
		})

		// Update nested frames and their children
		frame.childFrameIds.forEach(childFrameId => {
			const childFrame = this.getFrameById(childFrameId)
			if (childFrame) {
				childFrame.element.style.display = shouldHide ? 'none' : ''
				// If parent is collapsed, children should be hidden regardless of child frame's own collapsed state
				if (shouldHide) {
					this.hideAllFrameChildren(childFrame)
				} else {
					// Restore based on child frame's own collapsed state
					this.updateFrameChildrenVisibility(childFrame)
				}
			}
		})
	}

	/**
	 * Hide all children of a frame (used when parent frame is collapsed)
	 */
	private hideAllFrameChildren(frame: FrameShape): void {
		frame.childIds.forEach(childId => {
			const child = this.getShapeById(childId)
			if (child) {
				child.element.style.display = 'none'
			}
		})

		frame.childFrameIds.forEach(childFrameId => {
			const childFrame = this.getFrameById(childFrameId)
			if (childFrame) {
				childFrame.element.style.display = 'none'
				this.hideAllFrameChildren(childFrame)
			}
		})
	}

	/**
	 * Get frames data for serialization
	 */
	public getFramesData(): any[] {
		return this.getFrames().map(frame => frame.toJSON())
	}

	/**
	 * Compute bounding box for multiple shapes
	 */
	public getBoundingBox(shapes: DiagramShape[]): { x: number; y: number; width: number; height: number } {
		if (shapes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

		shapes.forEach(shape => {
			// For connectors, use getBBox() to get accurate bounds from path points
			// Regular shapes can use x/y/width/height directly
			if (shape.type === 'connector') {
				const bbox = shape.layout.getBBox()
				minX = Math.min(minX, bbox.x)
				minY = Math.min(minY, bbox.y)
				maxX = Math.max(maxX, bbox.x + bbox.width)
				maxY = Math.max(maxY, bbox.y + bbox.height)
			} else {
				minX = Math.min(minX, shape.layout.x)
				minY = Math.min(minY, shape.layout.y)
				maxX = Math.max(maxX, shape.layout.x + shape.layout.width)
				maxY = Math.max(maxY, shape.layout.y + shape.layout.height)
			}
		})

		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
	}

	// Z-order management (layer order)
	public bringToFront(shapes?: DiagramShape[]) {
		const shapesToMove = shapes || this.getSelectedShapes()
		if (shapesToMove.length === 0) return

		// Remove shapes from array
		this.shapes = this.shapes.filter(s => !shapesToMove.includes(s))
		
		// Add them to the end (rendered on top)
		this.shapes.push(...shapesToMove)
		
		// Re-append to DOM in new order
		if (this.contentLayer) {
			shapesToMove.forEach(shape => {
				this.contentLayer!.appendChild(shape.element)
			})
		}
		
		// Update selection overlay to ensure it's still on top
		if (this.selectionOverlay && this.contentLayer) {
			this.contentLayer.appendChild(this.selectionOverlay.getElement())
		}
		
		this.notifyShapesModified()
	}

	public sendToBack(shapes?: DiagramShape[]) {
		const shapesToMove = shapes || this.getSelectedShapes()
		if (shapesToMove.length === 0) return

		// Remove shapes from array
		this.shapes = this.shapes.filter(s => !shapesToMove.includes(s))
		
		// Add them to the beginning (rendered on bottom)
		this.shapes.unshift(...shapesToMove)
		
		// Re-append all shapes to DOM in new order
		if (this.contentLayer) {
			// Remove all shapes from DOM
			this.shapes.forEach(shape => {
				if (shape.element.parentNode) {
					shape.element.parentNode.removeChild(shape.element)
				}
			})
			
			// Re-append in new order
			this.shapes.forEach(shape => {
				this.contentLayer!.appendChild(shape.element)
			})
			
			// Ensure selection overlay is on top
			if (this.selectionOverlay) {
				this.contentLayer.appendChild(this.selectionOverlay.getElement())
			}
		}
		
		this.notifyShapesModified()
	}

	/**
	 * Bring a connector above its connected shapes in z-order.
	 * This ensures the connector is visible and rendered on top of the shapes it connects.
	 */
	public bringConnectorAboveConnectedShapes(connector: ConnectorShape): void {
		if (!this.contentLayer) return

		// Find the connected shapes
		const connectedShapes: DiagramShape[] = []
		if (connector.startShapeId) {
			const startShape = this.getShapeById(connector.startShapeId)
			if (startShape) connectedShapes.push(startShape)
		}
		if (connector.endShapeId) {
			const endShape = this.getShapeById(connector.endShapeId)
			if (endShape) connectedShapes.push(endShape)
		}

		if (connectedShapes.length === 0) return

		// Find the highest z-index of connected shapes
		let highestIndex = -1
		connectedShapes.forEach(shape => {
			const index = this.shapes.indexOf(shape)
			if (index > highestIndex) {
				highestIndex = index
			}
		})

		// Get current connector index
		const connectorIndex = this.shapes.indexOf(connector)

		// Only move if connector is below any connected shape
		if (connectorIndex <= highestIndex) {
			// Remove connector from current position
			this.shapes = this.shapes.filter(s => s !== connector)

			// Insert after the highest connected shape
			// Since we removed the connector, adjust the index
			const insertIndex = highestIndex // Was highestIndex + 1, but we removed one item
			this.shapes.splice(insertIndex, 0, connector)

			// Re-append connector to DOM to update visual z-order
			this.contentLayer.appendChild(connector.element)

			// Ensure selection overlay stays on top
			if (this.selectionOverlay) {
				this.contentLayer.appendChild(this.selectionOverlay.getElement())
			}
		}
	}

	// Manage shape 
	public createShape(type: ShapeName, x: number, y: number, imageUrl?: string, imageName?: string, squareIcon?: boolean) {
		let newShape: DiagramShape | null = null
		switch (type) {
			case 'rectangle':
				newShape = new RectangleShape(x, y)
				break
			case 'ellipse':
				newShape = new EllipseShape(x, y)
				break
			case 'diamond':
				newShape = new DiamondShape(x, y)
				break
			// Geometric
			case 'triangle':
			case 'triangle-down':
			case 'triangle-left':
			case 'triangle-right':
				newShape = new TriangleShape(type, x, y)
				break
			case 'hexagon':
				newShape = new HexagonShape(x, y)
				break
			case 'pentagon':
				newShape = new PentagonShape(x, y)
				break
			case 'octagon':
				newShape = new OctagonShape(x, y)
				break
			case 'service-card':
				newShape = new ReactShape(
					'service-card',
					{ component: ServiceCardContent, data: { iconPath: null, serviceName: 'New Service' } },
					x, y, 180, 50, 180, 50
				)
				break
			case 'todo-card':
				newShape = new ReactShape(
					'todo-card',
					{ component: TodoCardContent, data: { title: '', todos: [] } },
					x, y, 220, 120, 200, 80
				)
				break
			case 'image':
				if (imageUrl) {
					// Always provide a name - use provided name or default to "Image"
					// imageName can be string, undefined, or null - convert to string
					const name = (imageName && typeof imageName === 'string' && imageName.trim()) ? imageName.trim() : 'Image'
					newShape = new GenericImageShape(x, y, 100, 100, imageUrl, name, squareIcon || false)
				}
				break
			// Container
			case 'frame':
				newShape = new FrameShape(x, y, 200, 150, 'Frame')
				break
		}
		if (newShape) {
			// Apply default appearance if available
			if (this.defaultShapeAppearance) {
				Object.entries(this.defaultShapeAppearance).forEach(([key, value]) => {
					if (value !== undefined) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(newShape!.appearance as any)[key] = value
					}
				})

				// Automatically use handdrawn font when handdrawn style is active
				// and font family wasn't explicitly set to something other than default
				if (newShape.appearance.strokeDrawStyle === 'handdrawn') {
					if (!this.defaultShapeAppearance.fontFamily || this.defaultShapeAppearance.fontFamily === DEFAULT_FONT_FAMILY) {
						newShape.appearance.fontFamily = HAND_DRAWN_FONT_FAMILY
					}
				}
			}

			this.addShape(newShape)
			// Auto-assign to frame if drawn inside one (except for frames themselves)
			if (type !== 'frame') {
				this.autoAssignToFrame(newShape)
			}
			return newShape
		}
		return null
	}

	/**
	 * Create a shape without adding it to the shapes array.
	 * Used for preview shapes that will be committed later.
	 */
	private createShapeWithoutAdding(type: ShapeName, x: number, y: number): DiagramShape | null {
		let newShape: DiagramShape | null = null
		switch (type) {
			case 'rectangle':
				newShape = new RectangleShape(x, y)
				break
			case 'ellipse':
				newShape = new EllipseShape(x, y)
				break
			case 'diamond':
				newShape = new DiamondShape(x, y)
				break
			// Geometric
			case 'triangle':
			case 'triangle-down':
			case 'triangle-left':
			case 'triangle-right':
				newShape = new TriangleShape(type, x, y)
				break
			case 'hexagon':
				newShape = new HexagonShape(x, y)
				break
			case 'pentagon':
				newShape = new PentagonShape(x, y)
				break
			case 'octagon':
				newShape = new OctagonShape(x, y)
				break
			case 'service-card':
				newShape = new ReactShape(
					'service-card',
					{ component: ServiceCardContent, data: { iconPath: null, serviceName: 'New Service' } },
					x, y, 180, 50, 180, 50
				)
				break
			case 'todo-card':
				newShape = new ReactShape(
					'todo-card',
					{ component: TodoCardContent, data: { title: '', todos: [] } },
					x, y, 220, 120, 200, 80
				)
				break
			case 'frame':
				newShape = new FrameShape(x, y, 200, 150, 'Frame')
				break
			// Note: 'image' type requires additional parameters, not supported for quick connect
		}
		return newShape
	}

	public createConnector(type: ConnectorType, startPoint: { x: number; y: number }, endPoint: { x: number; y: number }, startShapeId: string | null = null, endShapeId: string | null = null): ConnectorShape {
		let connector: ConnectorShape
		switch (type) {
			case 'straight':
				connector = new StraightConnector(startPoint, endPoint, startShapeId, endShapeId)
				break
			case 'bent':
				connector = new BentConnector(startPoint, endPoint, startShapeId, endShapeId)
				break
			case 'curved':
				connector = new CurvedConnector(startPoint, endPoint, startShapeId, endShapeId)
				break
			default:
				throw new Error(`Unknown connector type: ${type}`)
		}
		this.addShape(connector)
		return connector
	}

	public createFreehandShape(points: Array<{ x: number; y: number }>, markerType: FreehandMarkerType = 'pen'): FreehandShape {
		const shape = new FreehandShape(points, markerType)
		this.addShape(shape)
		return shape
	}

	public getShapeById(id: string): DiagramShape | null {
		return this.shapes.find(s => s.element.dataset.shapeId === id) || null;
	}
	
	public moveSelectedShapes(x: number, y: number) {
		this.getSelectedShapes().forEach(s => {
			let targetX = x
			let targetY = y

			// Freehand shapes should never snap to grid
			if (this.snapToGrid && s.type !== 'freehand') {
				targetX = Math.round(x / GRID_SPACING) * GRID_SPACING
				targetY = Math.round(y / GRID_SPACING) * GRID_SPACING
			}

			// Calculate delta to update connected connectors
			const dx = targetX - s.layout.x
			const dy = targetY - s.layout.y

			s.layout.updatePosition(targetX, targetY)

			// Update any connectors attached to this shape
			this.updateConnectedConnectors(s, dx, dy)
		})
	}

	private updateConnectedConnectors(shape: DiagramShape, dx: number, dy: number) {
		this.updateConnectorsForShape(shape, dx, dy)
	}

	// Public method to update connectors attached to a shape
	// Used by DragTool and other tools that move shapes
	public updateConnectorsForShape(shape: DiagramShape, dx: number, dy: number) {
		let anyUpdated = false
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape
				let updated = false

				// Update if attached to this shape (either connector point or edge)
				// Pass delta so connectors move by the same amount
				// Only update the specific end attached to this shape
				if (connector.startShapeId === shape.id) {
					connector.updateConnectorPoints(dx, dy, 'start')
					updated = true
				}

				if (connector.endShapeId === shape.id) {
					connector.updateConnectorPoints(dx, dy, 'end')
					updated = true
				}


				if (updated) {
					anyUpdated = true
				}
			}
		})
		
		// Notify that shapes were modified (triggers storage save)
		if (anyUpdated) {
			this.notifyShapesModified()
		}
	}

	/**
	 * Cleanup collinear points in bent connectors attached to a shape.
	 * Called after shape movement completes to remove redundant points.
	 * Note: This is now handled internally by segment cleanup during interactions.
	 */
	public cleanupConnectedConnectors(shape: DiagramShape): void {
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape

				// Only process bent connectors attached to this shape
				if (connector instanceof BentConnector) {
					if (connector.startShapeId === shape.id || connector.endShapeId === shape.id) {
						// Cleanup is now done internally during segment interactions
						// Just re-render to ensure the path is up to date
						connector.render()
					}
				}
			}
		})
	}


	public resizeSelectedShapes(x: number, y: number, width: number, height: number) {
		this.getSelectedShapes().forEach(s => {
			let targetX = x
			let targetY = y
			let targetWidth = width
			let targetHeight = height

			// Freehand shapes should never snap to grid
			if (this.snapToGrid && s.type !== 'freehand') {
				targetX = Math.round(x / GRID_SPACING) * GRID_SPACING
				targetY = Math.round(y / GRID_SPACING) * GRID_SPACING
				targetWidth = Math.round(width / GRID_SPACING) * GRID_SPACING
				targetHeight = Math.round(height / GRID_SPACING) * GRID_SPACING
			}

			s.layout.resize(targetX, targetY, targetWidth, targetHeight)
			// Update connectors attached to this shape after resize
			this.updateConnectedConnectorsOnResize(s)
		})
	}

	public updateConnectedConnectorsOnResize(shape: DiagramShape) {
		let anyUpdated = false
		this.shapes.forEach(s => {
			if (s.type === 'connector') {
				const connector = s as ConnectorShape
				let updated = false

				// Update if attached to this shape (either connector point or edge)
				// For resize, we recalculate positions (no delta, so updateConnectorPoints will recalculate)
				if (connector.startShapeId === shape.id) {
					// For connector points, they stay on the point. For edges, recalculate.
					connector.updateConnectorPoints()
					updated = true
				}

				if (connector.endShapeId === shape.id) {
					// For connector points, they stay on the point. For edges, recalculate.
					connector.updateConnectorPoints()
					updated = true
				}

				if (updated) {
					anyUpdated = true
				}
			}
		})
		
		// Notify that shapes were modified (triggers storage save)
		if (anyUpdated) {
			this.notifyShapesModified()
		}
	}

	// Move a specific shape to a position with grid snapping
	// Snaps to grid dots/lines which are at GRID_SPACING/2, GRID_SPACING/2 + GRID_SPACING, etc.
	public moveShapeSnapped(shape: DiagramShape, x: number, y: number) {
		let targetX = x
		let targetY = y

		// Freehand shapes should never snap to grid
		if (this.snapToGrid && shape.type !== 'freehand') {
			const offset = GRID_SPACING / 2

			targetX = Math.round((x - offset) / GRID_SPACING) * GRID_SPACING + offset
			targetY = Math.round((y - offset) / GRID_SPACING) * GRID_SPACING + offset
		}

		const dx = targetX - shape.layout.x
		const dy = targetY - shape.layout.y

		shape.layout.updatePosition(targetX, targetY)

		// Update any connectors attached to this shape
		this.updateConnectedConnectors(shape, dx, dy)

		// Update individual selection indicator if it's showing
		if (shape.state.selected) {
			shape.selection.update()
		}
	}

	// Resize a specific shape with grid snapping
	// For dots: snaps to GRID_SPACING/2, GRID_SPACING/2 + GRID_SPACING, etc.
	// For lines: snaps to 0, GRID_SPACING, 2*GRID_SPACING, etc.
	public resizeShapeSnapped(shape: DiagramShape, x: number, y: number, width: number, height: number) {
		let targetX = x
		let targetY = y
		let targetWidth = width
		let targetHeight = height

		// Check if shape is a square icon
		const isSquareIcon = (shape as any).squareIcon === true

		// Freehand shapes should never snap to grid
		if (this.snapToGrid && shape.type !== 'freehand') {
			const offset = GRID_SPACING / 2

			targetX = Math.round((x - offset) / GRID_SPACING) * GRID_SPACING + offset
			targetY = Math.round((y - offset) / GRID_SPACING) * GRID_SPACING + offset

			if (isSquareIcon) {
				// For square icons, snap the size (not width and height separately) to maintain square
				const size = Math.max(width, height)
				const snappedSize = Math.round(size / GRID_SPACING) * GRID_SPACING
				targetWidth = Math.max(GRID_SPACING, snappedSize)
				targetHeight = Math.max(GRID_SPACING, snappedSize)
			} else {
				targetWidth = Math.round(width / GRID_SPACING) * GRID_SPACING
				targetHeight = Math.round(height / GRID_SPACING) * GRID_SPACING
			}
		}

		shape.layout.resize(targetX, targetY, Math.max(GRID_SPACING, targetWidth), Math.max(GRID_SPACING, targetHeight))
		
		// Update connectors attached to this shape after resize
		this.updateConnectedConnectorsOnResize(shape)
		
		// Update individual selection indicator if it's showing
		if (shape.state.selected) {
			shape.selection.update()
		}
	}

	public setSelectedShapesFill(color: string) {
		this.getSelectedShapes().forEach(s => s.appearance.fill = color)
	}

	public setSelectedShapesStroke(color: string) {
		this.getSelectedShapes().forEach(s => s.appearance.stroke = color)
	}

	public setSelectedShapesStrokeWidth(px: number) {
		this.getSelectedShapes().forEach(s => s.appearance.strokeWidth = px)
		this.notifyShapesModified()
	}

	public setSelectedShapesStrokeOpacity(opacity: number) {
		this.getSelectedShapes().forEach(s => s.appearance.strokeOpacity = opacity)
		this.notifyShapesModified()
	}

	public setSelectedShapesStrokeStyle(style: 'solid' | 'dashed' | 'dotted' | 'none') {
		this.getSelectedShapes().forEach(s => s.appearance.strokeStyle = style)
		this.notifyShapesModified()
	}

	public setSelectedShapesFillStyle(style: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none') {
		this.getSelectedShapes().forEach(s => s.appearance.fillStyle = style)
		this.notifyShapesModified()
	}

	public setSelectedShapesFillOpacity(opacity: number) {
		this.getSelectedShapes().forEach(s => s.appearance.fillOpacity = opacity)
		this.notifyShapesModified()
	}

	public setSelectedShapesFontSize(size: number) {
		this.getSelectedShapes().forEach(s => {
			s.appearance.fontSize = size
			// Clean the text content to remove inline font-size styles
			if (s.text) {
				const cleanText = RichTextManager.removeFontSizeStyles(s.text)
				s.text = cleanText
			}
			this.updateShapeText(s)
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesFontFamily(family: string) {
		this.getSelectedShapes().forEach(s => {
			s.appearance.fontFamily = family
			// Clean the text content to remove inline font-family styles
			if (s.text) {
				const cleanText = RichTextManager.removeFontFamilyStyles(s.text)
				s.text = cleanText
			}
			this.updateShapeText(s)
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesFontWeight(weight: 'normal' | 'bold') {
		this.getSelectedShapes().forEach(s => s.appearance.fontWeight = weight)
		this.notifyShapesModified()
	}

	public toggleSelectedShapesFontWeight() {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length === 0) return
		
		// Toggle based on first shape's current weight
		const firstWeight = selectedShapes[0].appearance.fontWeight || 'normal'
		const newWeight = firstWeight === 'bold' ? 'normal' : 'bold'

		selectedShapes.forEach(s => {
			s.appearance.fontWeight = newWeight

			// Clean the text content to remove inline bold styles
			if (s.text) {
				const cleanText = RichTextManager.removeBoldStyles(s.text)

				// If setting to bold, apply bold to the entire cleaned text
				if (newWeight === 'bold') {
					const boldText = RichTextManager.toggleFormatOnHtml(cleanText, 'bold')
					s.text = boldText
				} else {
					s.text = cleanText
				}
			}

			this.updateShapeText(s)
		})

		this.notifyShapesModified()
	}

	public toggleSelectedShapesFontStyle() {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length === 0) return

		// Toggle based on first shape's current style
		const firstStyle = selectedShapes[0].appearance.fontStyle || 'normal'
		const newStyle = firstStyle === 'italic' ? 'normal' : 'italic'

		selectedShapes.forEach(s => {
			s.appearance.fontStyle = newStyle

			// Clean the text content to remove inline italic styles
			if (s.text) {
				const cleanText = RichTextManager.removeItalicStyles(s.text)

				// If setting to italic, apply italic to the entire cleaned text
				if (newStyle === 'italic') {
					const italicText = RichTextManager.toggleFormatOnHtml(cleanText, 'italic')
					s.text = italicText
				} else {
					s.text = cleanText
				}
			}

			this.updateShapeText(s)
		})

		this.notifyShapesModified()
	}

	public toggleSelectedShapesTextDecoration(format: 'underline' | 'line-through') {
		const selectedShapes = this.getSelectedShapes()
		selectedShapes.forEach(shape => {
			// Update textDecoration string
			let decorations = shape.appearance.textDecoration === 'none' ? [] : (shape.appearance.textDecoration?.split(' ') || [])

			if (decorations.includes(format)) {
				decorations = decorations.filter(d => d !== format)
			} else {
				decorations.push(format)
			}

			const newDecoration = decorations.length > 0 ? decorations.join(' ') : 'none'
			shape.appearance.textDecoration = newDecoration

			// Update HTML content to reflect the change
			// We need to apply the format to the entire text content
			// This is done by creating a temporary div, selecting all, and execCommand
			if (shape.text) {
				const newText = RichTextManager.toggleFormatOnHtml(shape.text, format)
				shape.text = newText
			}
		})
		this.notifyShapesModified()
	}

	public toggleSelectedShapesList(type: 'ordered' | 'unordered') {
		const selectedShapes = this.getSelectedShapes()
		selectedShapes.forEach(shape => {
			if (shape.text) {
				const newList = RichTextManager.toggleListOnHtml(shape.text, type)
				shape.text = newList
				this.updateShapeText(shape)
			}
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesTextDecoration(decoration: 'none' | 'underline' | 'line-through') {
		const selectedShapes = this.getSelectedShapes()
		selectedShapes.forEach(shape => {
			shape.appearance.textDecoration = decoration
			this.updateShapeText(shape)
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesTextAlign(align: 'left' | 'center' | 'right') {
		this.getSelectedShapes().forEach(s => {
			s.appearance.textAlign = align
			if (s.text) {
				const cleanText = RichTextManager.removeAlignmentStyles(s.text)
				s.text = cleanText
			}
			this.updateShapeText(s)
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesTextJustify(justify: 'top' | 'middle' | 'bottom') {
		const selectedShapes = this.getSelectedShapes()
		selectedShapes.forEach((shape) => {
			shape.appearance.textJustify = justify
			this.updateShapeText(shape)
		})
		this.notifyShapesModified()
	}

	// Freehand shape specific styling methods
	public getSelectedFreehandShapes(): FreehandShape[] {
		return this.getSelectedShapes().filter((s): s is FreehandShape => s.type === 'freehand')
	}

	public setSelectedFreehandShapesMarkerType(markerType: FreehandMarkerType): void {
		const freehandShapes = this.getSelectedFreehandShapes()
		freehandShapes.forEach(shape => {
			shape.setMarkerType(markerType)
			shape.state.needsRender = true
		})
		this.notifyShapesModified()
	}

	public setSelectedFreehandShapesStroke(color: string): void {
		const freehandShapes = this.getSelectedFreehandShapes()
		freehandShapes.forEach(shape => {
			shape.appearance.stroke = color
			shape.state.needsRender = true
		})
		this.notifyShapesModified()
	}

	public setSelectedFreehandShapesStrokeWidth(width: number): void {
		const freehandShapes = this.getSelectedFreehandShapes()
		freehandShapes.forEach(shape => {
			shape.appearance.strokeWidth = width
			shape.state.needsRender = true
		})
		this.notifyShapesModified()
	}

	public setSelectedFreehandShapesStrokeOpacity(opacity: number): void {
		const freehandShapes = this.getSelectedFreehandShapes()
		freehandShapes.forEach(shape => {
			shape.appearance.strokeOpacity = opacity
			shape.state.needsRender = true
		})
		this.notifyShapesModified()
	}

	public setSelectedShapesTextColor(color: string) {
		const selectedShapes = this.getSelectedShapes()
		selectedShapes.forEach((shape) => {
			shape.appearance.textColor = color
			// Also remove any specific color styling from the text content
			// so that the global color applies to everything
			if (shape.text) {
				const cleanText = RichTextManager.removeColorStyles(shape.text)
				shape.text = cleanText
			}
			this.updateShapeText(shape)
		})
		this.notifyShapesModified()
	}

	public convertShapeType(shape: DiagramShape, newType: ShapeName) {
		if (shape.type === newType) return

		// Create new shape with same position and size
		let newShape: DiagramShape | null = null
		switch (newType) {
			case 'rectangle':
				newShape = new RectangleShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			case 'ellipse':
				newShape = new EllipseShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			case 'diamond':
				newShape = new DiamondShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			// Geometric
			case 'triangle':
			case 'triangle-down':
			case 'triangle-left':
			case 'triangle-right':
				newShape = new TriangleShape(newType, shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			case 'hexagon':
				newShape = new HexagonShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			case 'pentagon':
				newShape = new PentagonShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			case 'octagon':
				newShape = new OctagonShape(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height, shape.appearance.fill, shape.appearance.stroke, shape.appearance.strokeWidth)
				break
			// System
		}

		if (newShape) {
			// Copy text content
			newShape.text = shape.text
			
			// Copy text style properties
			// Copy text style properties
			newShape.appearance.fontSize = shape.appearance.fontSize
			newShape.appearance.fontFamily = shape.appearance.fontFamily
			newShape.appearance.fontWeight = shape.appearance.fontWeight
			newShape.appearance.fontStyle = shape.appearance.fontStyle
			newShape.appearance.textDecoration = shape.appearance.textDecoration
			newShape.appearance.textAlign = shape.appearance.textAlign
			newShape.appearance.textJustify = shape.appearance.textJustify
			newShape.appearance.textColor = shape.appearance.textColor
			
			// Copy all style properties
			newShape.appearance.fill = shape.appearance.fill
			newShape.appearance.fillOpacity = shape.appearance.fillOpacity
			newShape.appearance.stroke = shape.appearance.stroke
			newShape.appearance.strokeWidth = shape.appearance.strokeWidth
			newShape.appearance.strokeOpacity = shape.appearance.strokeOpacity
			
			// Apply fill and stroke styles
			if (shape.appearance.fill === 'none') {
				newShape.appearance.fillStyle = 'none'
			} else {
				newShape.appearance.fillStyle = 'solid'
			}
			
			// Determine stroke style from dasharray attribute
			const strokeDasharray = shape.shapeElement.getAttribute('stroke-dasharray')
			if (shape.appearance.stroke === 'none' || !shape.appearance.stroke) {
				newShape.appearance.strokeStyle = 'none'
			} else if (strokeDasharray) {
				newShape.appearance.strokeStyle = 'dashed'
			} else {
				newShape.appearance.strokeStyle = 'solid'
			}
			
			// Update text area dimensions by calling resize (which triggers updateTextAreaSizes)
			// This ensures text dimensions are properly calculated for the new shape type
			newShape.layout.resize(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height)
			
			// Copy selection state
			const wasSelected = shape.state.selected

			// Find the index of the old shape
			const index = this.shapes.indexOf(shape)

			// Remove old shape
			this.removeShape(shape)

			// Insert new shape at the same position
			if (index >= 0) {
				this.shapes.splice(index, 0, newShape)
			} else {
				this.shapes.push(newShape)
			}

			// Add new shape to DOM
			if (this.contentLayer) {
				// Insert at the right position in the DOM
				if (index >= 0 && index < this.shapes.length - 1) {
					const nextShape = this.shapes[index + 1]
					this.contentLayer.insertBefore(newShape.element, nextShape.element)
				} else {
					this.contentLayer.appendChild(newShape.element)
				}
			}

			// Restore selection
			if (wasSelected) {
				this.selectShape(newShape)
			}

			// Render text
			this.updateShapeText(newShape)
			this.updateSelectionOverlay()
			this.notifyShapesModified()

			return newShape
		}

		return null
	}

	public convertSelectedShapesType(newType: ShapeName) {
		const selectedShapes = [...this.getSelectedShapes()]
		const newShapes: DiagramShape[] = []

		// Shape types that cannot be converted to other types
		const nonConvertibleTypes = ['image', 'cloud', 'database', 'aws-ec2', 'gcp-compute', 'azure-vm', 'kubernetes', 'connector', 'freehand']

		selectedShapes.forEach(shape => {
			// Skip shapes that cannot be converted
			if (nonConvertibleTypes.includes(shape.type)) {
				return
			}

			const newShape = this.convertShapeType(shape, newType)
			if (newShape) {
				newShapes.push(newShape)
			}
		})

		// Update selection overlay after all conversions
		this.updateSelectionOverlay()

		return newShapes
	}

	// Alias for convertSelectedShapesType to match InteractionEngine API
	public setSelectedConnectorsStartArrowhead(arrowheadType: ArrowheadType) {
		const selectedShapes = this.getSelectedShapes()
		const connectors = selectedShapes.filter(s => s.type === 'connector') as ConnectorShape[]
		
		if (connectors.length === 0) return

		connectors.forEach(connector => {
			connector.startArrowheadType = arrowheadType
			connector.state.needsRender = true
		})
		
		this.notifyShapesModified()
	}

	public setSelectedConnectorsEndArrowhead(arrowheadType: ArrowheadType) {
		const selectedShapes = this.getSelectedShapes()
		const connectors = selectedShapes.filter(s => s.type === 'connector') as ConnectorShape[]
		
		if (connectors.length === 0) return

		connectors.forEach(connector => {
			connector.endArrowheadType = arrowheadType
			connector.state.needsRender = true
		})
		
		this.notifyShapesModified()
	}

	public setSelectedConnectorsType(newType: ConnectorType, currentScale: number = 1) {
		const selectedShapes = this.getSelectedShapes()
		const connectors = selectedShapes.filter(s => s.type === 'connector') as ConnectorShape[]
		
		if (connectors.length === 0) return

		connectors.forEach(connector => {
			if (connector.connectorType === newType) return // Already the correct type

			// Find the index before creating new connector
			const index = this.shapes.indexOf(connector)
			if (index === -1) return

			// Create new connector with same points and connections (but don't add to array yet)
			let newConnector: ConnectorShape
			switch (newType) {
				case 'straight':
					newConnector = new StraightConnector(
						connector.startPoint,
						connector.endPoint,
						connector.startShapeId,
						connector.endShapeId
					)
					break
				case 'bent':
					newConnector = new BentConnector(
						connector.startPoint,
						connector.endPoint,
						connector.startShapeId,
						connector.endShapeId
					)
					break
				case 'curved':
					newConnector = new CurvedConnector(
						connector.startPoint,
						connector.endPoint,
						connector.startShapeId,
						connector.endShapeId
					)
					break
				default:
					throw new Error(`Unknown connector type: ${newType}`)
			}

			// Copy style properties
			// Copy style properties
			newConnector.appearance.stroke = connector.appearance.stroke
			newConnector.appearance.strokeWidth = connector.appearance.strokeWidth
			newConnector.appearance.strokeOpacity = connector.appearance.strokeOpacity
			newConnector.appearance.strokeStyle = connector.appearance.strokeStyle
			newConnector.text = connector.text
			newConnector.appearance.textColor = connector.appearance.textColor
			newConnector.appearance.fontSize = connector.appearance.fontSize
			newConnector.appearance.fontFamily = connector.appearance.fontFamily
			newConnector.appearance.fontWeight = connector.appearance.fontWeight
			newConnector.appearance.fontStyle = connector.appearance.fontStyle
			newConnector.appearance.textAlign = connector.appearance.textAlign
			newConnector.appearance.textJustify = connector.appearance.textJustify

			// Set shape getter for the new connector (needed for updateConnectorPoints to work)
			newConnector.setShapeGetter((id: string) => this.getShapeById(id))
			newConnector.setAllShapesGetter(() => this.getShapes())
			
			// Copy connector point attachment information
			newConnector.startConnectorPoint = connector.startConnectorPoint
			newConnector.endConnectorPoint = connector.endConnectorPoint
			
			// Copy arrowhead types
			newConnector.startArrowheadType = connector.startArrowheadType
			newConnector.endArrowheadType = connector.endArrowheadType
			
			// Update scale for new connector handles to maintain constant pixel size
			newConnector.updateScale(currentScale)
			
			// Update connector points to ensure they're properly attached to shapes
			newConnector.updateConnectorPoints()

			// Remove old connector from DOM
			if (connector.element.parentNode) {
				connector.element.parentNode.removeChild(connector.element)
			}
			// Replace in array
			this.shapes[index] = newConnector
			// Append new connector to DOM
			if (this.contentLayer) {
				this.contentLayer.appendChild(newConnector.element)
			}
			// Update selection
			if (connector.state.selected) {
				connector.state.selected = false
				newConnector.state.selected = true
			}
		})

		// Update selection overlay
		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	public setSelectedShapesType(newType: ShapeName) {
		return this.convertSelectedShapesType(newType)
	}

	// Selection overlay management
	public updateSelectionOverlay(): void {
		if (!this.selectionOverlay || !this.contentLayer) return

		const selectedShapes = this.getSelectedShapes()
		
		// Hide all group boundary overlays by default
		this.groupBoundaryOverlays.forEach(overlay => overlay.hide())

		if (selectedShapes.length === 0) {
			this.selectionOverlay.hide()
			this.shapes.forEach(shape => shape.selection.hide())
			return
		}

		// Check if we have a single connector selected
		const isSingleConnector = selectedShapes.length === 1 && selectedShapes[0].type === 'connector'

		if (isSingleConnector) {
			// Hide the main selection box for connectors
			this.selectionOverlay.hide()
			const connector = selectedShapes[0]
			this.contentLayer.appendChild(connector.element)
				; (connector as ConnectorShape).setSelectionMode('handles')
			connector.selection.show()
			connector.selection.update()
			return
		}

		// === GROUP-AWARE BOUNDING LOGIC ===
		// First, check if all selected shapes belong to the SAME TOPMOST group
		const firstTopmostGroupId = this.getTopmostGroupId(selectedShapes[0])
		const allSameTopmostGroup = firstTopmostGroupId && selectedShapes.every(s => this.getTopmostGroupId(s) === firstTopmostGroupId)

		// If all same topmost group, check if the ENTIRE group is selected
		let isCompleteGroupSelection = false
		if (allSameTopmostGroup && firstTopmostGroupId) {
			const allGroupShapes = this.getAllShapesInGroupRecursive(firstTopmostGroupId)
			isCompleteGroupSelection = allGroupShapes.length === selectedShapes.length &&
				allGroupShapes.every(s => s.state.selected)
		}

		// Check if this is an individual shape focus (within a focused group)
		// const _isIndividualFocus = this.focusedGroupId !== null &&
		// 	selectedShapes.length === 1 &&
		// 	selectedShapes[0].layout.parentId === this.focusedGroupId

		// Check if this is a single shape with a parent (show parent bounding)
		const isSingleShapeWithParent = selectedShapes.length === 1 &&
			selectedShapes[0].layout.parentId !== null &&
			this.groups.has(selectedShapes[0].layout.parentId!)

		// Check if this is a complete group selection at ANY level (using smallest containing group)
		let isCompleteInnerGroupSelection = false
		let innerGroupId: string | null = null
		if (!isCompleteGroupSelection) {
			// Find the smallest group that contains all selected shapes
			const smallestGroup = this.findSmallestContainingGroup(selectedShapes)
			if (smallestGroup && smallestGroup !== firstTopmostGroupId) {
				// Check if ALL shapes in this group are selected
				const groupShapes = this.getAllShapesInGroupRecursive(smallestGroup)
				const allSelected = groupShapes.length === selectedShapes.length &&
					groupShapes.every(s => s.state.selected)
				if (allSelected) {
					isCompleteInnerGroupSelection = true
					innerGroupId = smallestGroup
				}
			}
		}

		if (isSingleShapeWithParent && !isCompleteGroupSelection && !isCompleteInnerGroupSelection) {
		// Single shape selected that has a parent group - show shape bounding AND parent group bounding
			const shape = selectedShapes[0]
			this.contentLayer.appendChild(this.selectionOverlay.getElement())
			this.selectionOverlay.updateBounds(shape.layout.x, shape.layout.y, shape.layout.width, shape.layout.height)
			this.selectionOverlay.show()
			this.selectionOverlay.setResizable(shape.state.resizable !== false)

			// Show the immediate parent group's bounding as lighter border
			if (shape.layout.parentId) {
				this.showGroupBoundary(shape.layout.parentId, 0)
			}

			// Hide individual indicators
			this.shapes.forEach(s => s.selection.hide())
		} else if (isCompleteInnerGroupSelection && innerGroupId) {
			// Complete inner group selection - show inner group bounding and parent bounding
			const innerGroupShapes = this.getAllShapesInGroupRecursive(innerGroupId)
			const groupBounds = this.getBoundingBox(innerGroupShapes)

			this.contentLayer.appendChild(this.selectionOverlay.getElement())
			this.selectionOverlay.updateBounds(groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height)
			this.selectionOverlay.show()

			// Check if all shapes are resizable
			const allResizable = innerGroupShapes.every(shape => shape.state.resizable !== false)
			this.selectionOverlay.setResizable(allResizable)

			// Hide ALL individual indicators
			this.shapes.forEach(s => s.selection.hide())

			// Show the inner group's immediate parent bounding (if it has one)
			const groupParentId = this.getGroupParentId(innerGroupId)
			if (groupParentId) {
				this.showGroupBoundary(groupParentId, 0)
			}
		} else if (isCompleteGroupSelection && firstTopmostGroupId) {
			// All shapes in a topmost group are selected = complete group selection
			// Draw ONE bounding box around all shapes, NO inner group boundings, NO individual indicators
			const allGroupShapes = this.getAllShapesInGroupRecursive(firstTopmostGroupId)
			const groupBounds = this.getBoundingBox(allGroupShapes)

			this.contentLayer.appendChild(this.selectionOverlay.getElement())
			this.selectionOverlay.updateBounds(groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height)
			this.selectionOverlay.show()

			// Check if all shapes are resizable
			const allResizable = allGroupShapes.every(shape => shape.state.resizable !== false)
			this.selectionOverlay.setResizable(allResizable)

			// Hide ALL individual indicators - no inner group boundings shown
			this.shapes.forEach(s => s.selection.hide())

			// Show PARENT group bounding if this group has a parent
			const groupData = this.groups.get(firstTopmostGroupId)
			if (groupData?.parentId && this.groups.has(groupData.parentId)) {
				this.showGroupBoundary(groupData.parentId, 0)
			}
		} else {
			// Mixed selection (multiple groups, individual shapes, etc.)
			// Need to collect unique groups and ungrouped shapes
			const groupIds = new Set<string>()
			const ungroupedShapes: DiagramShape[] = []

			selectedShapes.forEach(shape => {
				const topmostGroupId = this.getTopmostGroupId(shape)
				if (topmostGroupId) {
					groupIds.add(topmostGroupId)
				} else {
					ungroupedShapes.push(shape)
				}
			})

			// Calculate combined bounds including full groups
			let shapesForBounds: DiagramShape[] = [...ungroupedShapes]
			groupIds.forEach(groupId => {
				const groupShapes = this.getAllShapesInGroupRecursive(groupId)
				shapesForBounds = shapesForBounds.concat(groupShapes)
			})

			const bounds = this.getBoundingBox(shapesForBounds)
			if (bounds.width === 0 && bounds.height === 0) {
				this.selectionOverlay.hide()
				return
			}

			this.contentLayer.appendChild(this.selectionOverlay.getElement())
			this.selectionOverlay.updateBounds(bounds.x, bounds.y, bounds.width, bounds.height)
			this.selectionOverlay.show()

			const allResizable = shapesForBounds.every(shape => shape.state.resizable !== false)
			this.selectionOverlay.setResizable(allResizable)

			// Show individual selection indicators only for ungrouped shapes
			// Grouped shapes should NOT show individual indicators
			this.shapes.forEach(shape => shape.selection.hide())

			// Show indicators for ungrouped shapes
			ungroupedShapes.forEach(shape => {
				if (shape.type === 'connector') {
					(shape as ConnectorShape).setSelectionMode('box')
				}
				shape.selection.show()
				shape.selection.update()
			})

			// Show group boundary overlay ONLY for topmost groups
			// Filter out any groups whose parent is also in the selection
			let overlayIndex = 0
			groupIds.forEach(groupId => {
				// Check if this group's parent is also in groupIds - if so, skip it (inner group)
				const parentGroupId = this.getGroupParentId(groupId)
				if (parentGroupId && groupIds.has(parentGroupId)) {
					// This is an inner group whose parent is also selected - don't show boundary
					return
				}
				this.showGroupBoundary(groupId, overlayIndex)
				overlayIndex++
			})
		}

		// === QUICK CONNECT LOGIC ===
		// Enable quick connect for single shape selection (not connectors, frames, or freehand)
		// Also works for shapes within groups
		const shouldEnableQuickConnect = selectedShapes.length === 1 &&
			!['connector', 'freehand', 'frame'].includes(selectedShapes[0].type)

		this.selectionOverlay.setQuickConnectEnabled(shouldEnableQuickConnect)
	}

	/**
	 * Helper to show a group boundary overlay
	 * Creates new overlays as needed and reuses existing ones
	 */
	private showGroupBoundary(groupId: string, index: number): void {
		if (!this.contentLayer) return

		const groupShapes = this.getAllShapesInGroupRecursive(groupId)
		if (groupShapes.length === 0) return

		const groupBounds = this.getBoundingBox(groupShapes)

		// Ensure we have enough overlays in the pool
		while (this.groupBoundaryOverlays.length <= index) {
			const overlay = new SelectionOverlay()
			this.contentLayer.appendChild(overlay.getElement())
			overlay.setEditingMode(true) // Lighter border, no handles
			overlay.hide()
			this.groupBoundaryOverlays.push(overlay)
		}

		const overlay = this.groupBoundaryOverlays[index]
		this.contentLayer.insertBefore(overlay.getElement(), this.selectionOverlay!.getElement())
		overlay.updateBounds(groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height)
		overlay.show()
	}

	/**
	 * Update the group boundary overlay to include preview shapes.
	 * This expands the group's bounding box to encompass quick connect preview shapes.
	 */
	private updateGroupBoundaryWithPreviews(groupId: string): void {
		if (!this.contentLayer) return

		const groupShapes = this.getAllShapesInGroupRecursive(groupId)
		if (groupShapes.length === 0) return

		// Start with group bounds
		let bounds = this.getBoundingBox(groupShapes)

		// Expand bounds to include all preview shapes
		for (const previewShape of this.quickConnectPreviewShapes) {
			const bbox = previewShape.layout.getBBox()
			const minX = Math.min(bounds.x, bbox.x)
			const minY = Math.min(bounds.y, bbox.y)
			const maxX = Math.max(bounds.x + bounds.width, bbox.x + bbox.width)
			const maxY = Math.max(bounds.y + bounds.height, bbox.y + bbox.height)
			bounds = {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			}
		}

		// Update the group boundary overlay (index 0 is always the parent group boundary)
		if (this.groupBoundaryOverlays.length > 0) {
			const overlay = this.groupBoundaryOverlays[0]
			overlay.updateBounds(bounds.x, bounds.y, bounds.width, bounds.height)
		}
	}

	public hideSelectionOverlay(): void {
		if (this.selectionOverlay) {
			this.selectionOverlay.hide()
		}
		// Hide all group boundary overlays
		this.groupBoundaryOverlays.forEach(overlay => overlay.hide())
		// Clear quick connect preview
		this.clearQuickConnectPreview()
	}

	public showSelectionOverlay(): void {
		this.updateSelectionOverlay()
	}

	// ==================== Quick Connect Methods ====================

	private applyQuickConnectConnectorAppearance(
		connector: ConnectorShape,
		sourceShape: DiagramShape,
		isPreview: boolean
	): void {
		const opacityBase = sourceShape.appearance.strokeOpacity ?? 1
		connector.appearance.stroke = sourceShape.appearance.stroke
		connector.appearance.strokeWidth = sourceShape.appearance.strokeWidth
		connector.appearance.strokeOpacity = isPreview ? opacityBase * 0.5 : opacityBase
		connector.appearance.strokeStyle = sourceShape.appearance.strokeStyle
		connector.appearance.strokeDrawStyle = sourceShape.appearance.strokeDrawStyle
	}

	private applyQuickConnectShapeAppearance(
		targetShape: DiagramShape,
		sourceShape: DiagramShape,
		isPreview: boolean
	): void {
		const fillOpacity = sourceShape.appearance.fillOpacity ?? 1
		const strokeOpacity = sourceShape.appearance.strokeOpacity ?? 1

		targetShape.appearance.fill = sourceShape.appearance.fill
		targetShape.appearance.fillOpacity = isPreview ? fillOpacity * 0.5 : fillOpacity
		targetShape.appearance.stroke = sourceShape.appearance.stroke
		targetShape.appearance.strokeWidth = sourceShape.appearance.strokeWidth
		targetShape.appearance.strokeOpacity = isPreview ? strokeOpacity * 0.5 : strokeOpacity
		targetShape.appearance.strokeStyle = sourceShape.appearance.strokeStyle
		targetShape.appearance.fillStyle = sourceShape.appearance.fillStyle
		targetShape.appearance.drawStyle = sourceShape.appearance.drawStyle
		targetShape.appearance.fillDrawStyle = sourceShape.appearance.fillDrawStyle
		targetShape.appearance.strokeDrawStyle = sourceShape.appearance.strokeDrawStyle
		targetShape.appearance.textColor = sourceShape.appearance.textColor
		targetShape.appearance.fontSize = sourceShape.appearance.fontSize
		targetShape.appearance.fontFamily = sourceShape.appearance.fontFamily
		targetShape.appearance.fontWeight = sourceShape.appearance.fontWeight
		targetShape.appearance.fontStyle = sourceShape.appearance.fontStyle
		targetShape.appearance.textDecoration = sourceShape.appearance.textDecoration
		targetShape.appearance.textAlign = sourceShape.appearance.textAlign
		targetShape.appearance.textJustify = sourceShape.appearance.textJustify
	}

	private handleQuickConnectHover(side: QuickConnectSide | null): void {
		if (side === null) {
			this.clearQuickConnectPreview()
			if (this.selectionOverlay) {
				this.selectionOverlay.setActiveQuickConnect(null)
			}
			return
		}

		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1) return

		const originalShape = selectedShapes[0]
		this.showQuickConnectPreview(originalShape, side)

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(side)
		}
	}

	private handleQuickConnectClick(_side: QuickConnectSide): void {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1) return

		const originalShape = selectedShapes[0]

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(null)
		}

		// Commit the preview shapes - make them permanent
		this.commitQuickConnectPreview(originalShape)
	}

	private handleQuickConnectDragStart(side: QuickConnectSide, clientX: number, clientY: number): void {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1 || !this.contentLayer) return

		const originalShape = selectedShapes[0]

		// Clear any existing preview
		this.clearQuickConnectPreview()

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(null)
		}

		// Determine connector points based on side
		const connectorMapping: Record<QuickConnectSide, 'top' | 'bottom' | 'left' | 'right'> = {
			top: 'top',
			bottom: 'bottom',
			left: 'left',
			right: 'right'
		}
		const startSide = connectorMapping[side]

		// Get the start point from the original shape
		const originalPoints = originalShape.connectionPoints.getConnectorPoints()
		const startPoint = originalPoints[startSide]

		// Create a connector with the start attached to the shape and end at the same point (will be dragged)
		const connector = new BentConnector(
			startPoint,
			{ x: startPoint.x, y: startPoint.y }, // End point starts at same position
			originalShape.id,
			null // End not attached
		)
		connector.startConnectorPoint = startSide
		connector.endConnectorPoint = null
		connector.setShapeGetter((id: string) => this.getShapeById(id))
		connector.setAllShapesGetter(() => this.getShapes())
		this.applyQuickConnectConnectorAppearance(connector, originalShape, false)

		// Add connector to DOM and shapes array
		this.contentLayer.appendChild(connector.element)
		this.shapes.push(connector)
		connector.render()

		// Invoke callback to notify SelectTool to start dragging the end point
		if (this.onQuickConnectDragStart) {
			this.onQuickConnectDragStart(connector, side, clientX, clientY)
		}
	}

	public setOnQuickConnectDragStart(callback: ((connector: ConnectorShape, side: QuickConnectSide, clientX: number, clientY: number) => void) | null): void {
		this.onQuickConnectDragStart = callback
	}

	private showQuickConnectPreview(originalShape: DiagramShape, side: QuickConnectSide, count: number = 1): void {
		if (!this.contentLayer || count < 1) return

		// Check if preview is already showing the same content - skip if unchanged
		if (this.quickConnectPreviewConnectors.length > 0 &&
			this.quickConnectPreviewSide === side &&
			this.quickConnectPreviewShapeId === originalShape.id &&
			this.quickConnectPreviewCount === count) {
			return // Preview is already showing the correct content
		}

		// Clear any existing preview
		this.clearQuickConnectPreview()

		// Cache the current preview state
		this.quickConnectPreviewSide = side
		this.quickConnectPreviewShapeId = originalShape.id
		this.quickConnectPreviewCount = count

		// Determine connector points based on side
		const connectorMapping: Record<QuickConnectSide, { start: 'top' | 'bottom' | 'left' | 'right'; end: 'top' | 'bottom' | 'left' | 'right' }> = {
			top: { start: 'top', end: 'bottom' },
			bottom: { start: 'bottom', end: 'top' },
			left: { start: 'left', end: 'right' },
			right: { start: 'right', end: 'left' }
		}
		const { start: startSide, end: endSide } = connectorMapping[side]

		// Create preview shapes - all connect FROM the original shape
		const allPreviewShapes: DiagramShape[] = []
		// Track shapes we've already connected to (to avoid duplicates)
		const connectedShapeIds: Set<string> = new Set()

		for (let i = 0; i < count; i++) {
			// Calculate position for this shape (uses stacking logic)
			let newPos = this.calculateFannedPosition(originalShape, side, i, count)

			// Check if this position overlaps with an existing shape
			let testBbox = {
				x: newPos.x,
				y: newPos.y,
				width: originalShape.layout.width,
				height: originalShape.layout.height
			}
			let overlappingShape = this.findOverlappingShape(testBbox, originalShape.id)

			// If overlapping and not already connected to original, and we haven't already connected to it
			if (overlappingShape &&
				!this.areShapesConnected(originalShape.id, overlappingShape.id) &&
				!connectedShapeIds.has(overlappingShape.id)) {
				// Snap to existing shape - only show connector preview
				connectedShapeIds.add(overlappingShape.id)

				const originalPoints = originalShape.connectionPoints.getConnectorPoints()
				const targetPoints = overlappingShape.connectionPoints.getConnectorPoints()
				const startPoint = originalPoints[startSide]
				const endPoint = targetPoints[endSide]

				// Create BentConnector for preview (to existing shape)
				const previewConnector = new BentConnector(startPoint, endPoint, originalShape.id, overlappingShape.id)
				previewConnector.startConnectorPoint = startSide
				previewConnector.endConnectorPoint = endSide
				previewConnector.setShapeGetter((id: string) => this.getShapeById(id))
				previewConnector.setAllShapesGetter(() => this.getShapes())
					this.applyQuickConnectConnectorAppearance(previewConnector, originalShape, true)
				previewConnector.updateConnectorPoints()
				// Add connector to DOM before render so roughjs can access svgRoot
				this.contentLayer.appendChild(previewConnector.element)
				previewConnector.render()

				// Disable pointer events on the preview connector (after render)
				previewConnector.element.style.pointerEvents = 'none'
				previewConnector.element.querySelectorAll('*').forEach((child: Element) => {
					(child as SVGElement).style.pointerEvents = 'none'
				})
				this.quickConnectPreviewConnectors.push(previewConnector)
			} else {
				// If overlapping with an already-connected shape, find an alternative position
				// by searching perpendicular offset positions until we find a clear spot
				if (overlappingShape && this.areShapesConnected(originalShape.id, overlappingShape.id)) {
					const perpendicularOffset = (side === 'left' || side === 'right')
						? originalShape.layout.height + this.QUICK_CONNECT_STACK_GAP
						: originalShape.layout.width + this.QUICK_CONNECT_STACK_GAP

					// Try offset positions: +1, -1, +2, -2, etc. from current position
					let foundClearPosition = false
					for (let offsetMult = 1; offsetMult <= 20; offsetMult++) {
						for (const sign of [1, -1]) {
							let testPos: { x: number; y: number }
							if (side === 'left' || side === 'right') {
								// Horizontal connection: offset vertically
								testPos = {
									x: newPos.x,
									y: newPos.y + (sign * offsetMult * perpendicularOffset)
								}
							} else {
								// Vertical connection: offset horizontally
								testPos = {
									x: newPos.x + (sign * offsetMult * perpendicularOffset),
									y: newPos.y
								}
							}

							testBbox = {
								x: testPos.x,
								y: testPos.y,
								width: originalShape.layout.width,
								height: originalShape.layout.height
							}

							const maybeOverlap = this.findOverlappingShape(testBbox, originalShape.id)
							if (!maybeOverlap) {
								// Found a clear position
								newPos = testPos
								overlappingShape = null
								foundClearPosition = true
								break
							} else if (!this.areShapesConnected(originalShape.id, maybeOverlap.id) &&
								!connectedShapeIds.has(maybeOverlap.id)) {
								// Found an unconnected shape we can snap to
								overlappingShape = maybeOverlap
								foundClearPosition = true
								break
							}
						}
						if (foundClearPosition) break
					}

					// If we found an unconnected shape to snap to, create connector to it
					if (overlappingShape &&
						!this.areShapesConnected(originalShape.id, overlappingShape.id) &&
						!connectedShapeIds.has(overlappingShape.id)) {
						connectedShapeIds.add(overlappingShape.id)

						const originalPoints = originalShape.connectionPoints.getConnectorPoints()
						const targetPoints = overlappingShape.connectionPoints.getConnectorPoints()
						const startPoint = originalPoints[startSide]
						const endPoint = targetPoints[endSide]

						const previewConnector = new BentConnector(startPoint, endPoint, originalShape.id, overlappingShape.id)
						previewConnector.startConnectorPoint = startSide
						previewConnector.endConnectorPoint = endSide
						previewConnector.setShapeGetter((id: string) => this.getShapeById(id))
						previewConnector.setAllShapesGetter(() => this.getShapes())
						this.applyQuickConnectConnectorAppearance(previewConnector, originalShape, true)
						previewConnector.updateConnectorPoints()
						// Add connector to DOM before render so roughjs can access svgRoot
						this.contentLayer.appendChild(previewConnector.element)
						previewConnector.render()

						previewConnector.element.style.pointerEvents = 'none'
						previewConnector.element.querySelectorAll('*').forEach((child: Element) => {
							(child as SVGElement).style.pointerEvents = 'none'
						})
						this.quickConnectPreviewConnectors.push(previewConnector)
						continue // Skip creating new shape - we snapped to existing
					}
				}

				// No overlap or found a clear position - create new shape preview
				const newShape = this.createShapeWithoutAdding(originalShape.type, newPos.x, newPos.y)
				if (!newShape) continue

				// Copy visual properties from original with reduced opacity for preview
				newShape.layout.resize(newPos.x, newPos.y, originalShape.layout.width, originalShape.layout.height)
				this.applyQuickConnectShapeAppearance(newShape, originalShape, true)
				// Add shape to DOM before render so roughjs can access svgRoot
				this.contentLayer.appendChild(newShape.element)
				newShape.render()

				// For React shapes (service-card, todo-card), use element-level opacity
				if (newShape.type === 'service-card' || newShape.type === 'todo-card') {
					newShape.element.style.opacity = '0.5'
				}

				// Disable pointer events on the preview shape (after render)
				newShape.element.style.pointerEvents = 'none'
				newShape.element.querySelectorAll('*').forEach((child: Element) => {
					(child as SVGElement).style.pointerEvents = 'none'
				})
				this.quickConnectPreviewShapes.push(newShape)
				allPreviewShapes.push(newShape)

				// Create connector FROM the original shape to this new shape
				const originalPoints = originalShape.connectionPoints.getConnectorPoints()
				const newPoints = newShape.connectionPoints.getConnectorPoints()
				const startPoint = originalPoints[startSide]
				const endPoint = newPoints[endSide]

				// Create BentConnector for preview
				const previewConnector = new BentConnector(startPoint, endPoint, originalShape.id, newShape.id)
				previewConnector.startConnectorPoint = startSide
				previewConnector.endConnectorPoint = endSide
				previewConnector.setShapeGetter((id: string) => {
					// Return preview shapes if queried
					const previewShape = allPreviewShapes.find(s => s.id === id)
					if (previewShape) return previewShape
					return this.getShapeById(id)
				})
				previewConnector.setAllShapesGetter(() => this.getShapes())
				this.applyQuickConnectConnectorAppearance(previewConnector, originalShape, true)
				previewConnector.updateConnectorPoints()
				// Add connector to DOM before render so roughjs can access svgRoot
				this.contentLayer.appendChild(previewConnector.element)
				previewConnector.render()

				// Disable pointer events on the preview connector (after render)
				previewConnector.element.style.pointerEvents = 'none'
				previewConnector.element.querySelectorAll('*').forEach((child: Element) => {
					(child as SVGElement).style.pointerEvents = 'none'
				})
				this.quickConnectPreviewConnectors.push(previewConnector)
			}
		}

		// If the original shape has a parent group, expand the group boundary to include preview shapes
		if (originalShape.layout.parentId && this.groups.has(originalShape.layout.parentId)) {
			this.updateGroupBoundaryWithPreviews(originalShape.layout.parentId)
		}
	}

	/**
	 * Calculate position for a shape in a fanned layout from the original.
	 * All shapes are at the same distance from the original, stacked perpendicular to the direction.
	 * Index 0 is the first shape, centered. Additional shapes stack around it.
	 */
	private calculateFannedPosition(original: DiagramShape, side: QuickConnectSide, index: number, totalCount: number): { x: number; y: number } {
		// Calculate the perpendicular offset for stacking
		// Offset so shapes are centered around the original's center axis
		const stackGap = this.QUICK_CONNECT_STACK_GAP

		// Calculate offset from center: for 3 shapes at indices 0,1,2 we want offsets -1, 0, +1
		// The middle shape (or first shape if count=1) should be centered
		const middleIndex = (totalCount - 1) / 2
		const offsetIndex = index - middleIndex

		switch (side) {
			case 'top': {
				// Shapes above original, stacked horizontally (left-right)
				const baseY = original.layout.y - this.QUICK_CONNECT_SPACING - original.layout.height
				const baseX = original.layout.x
				const perpendicularOffset = offsetIndex * (original.layout.width + stackGap)
				return {
					x: baseX + perpendicularOffset,
					y: baseY
				}
			}
			case 'bottom': {
				// Shapes below original, stacked horizontally (left-right)
				const baseY = original.layout.y + original.layout.height + this.QUICK_CONNECT_SPACING
				const baseX = original.layout.x
				const perpendicularOffset = offsetIndex * (original.layout.width + stackGap)
				return {
					x: baseX + perpendicularOffset,
					y: baseY
				}
			}
			case 'left': {
				// Shapes to the left, stacked vertically (up-down)
				const baseX = original.layout.x - this.QUICK_CONNECT_SPACING - original.layout.width
				const baseY = original.layout.y
				const perpendicularOffset = offsetIndex * (original.layout.height + stackGap)
				return {
					x: baseX,
					y: baseY + perpendicularOffset
				}
			}
			case 'right':
			default: {
				// Shapes to the right, stacked vertically (up-down)
				const baseX = original.layout.x + original.layout.width + this.QUICK_CONNECT_SPACING
				const baseY = original.layout.y
				const perpendicularOffset = offsetIndex * (original.layout.height + stackGap)
				return {
					x: baseX,
					y: baseY + perpendicularOffset
				}
			}
		}
	}

	private commitQuickConnectPreview(originalShape: DiagramShape): void {
		if (this.quickConnectPreviewConnectors.length === 0) return

		// Commit all connectors
		for (const connector of this.quickConnectPreviewConnectors) {
			this.applyQuickConnectConnectorAppearance(connector, originalShape, false)
			connector.element.style.pointerEvents = ''
			connector.element.querySelectorAll('*').forEach((child: Element) => {
				(child as SVGElement).style.pointerEvents = ''
			})
			connector.render()
			this.shapes.push(connector)
		}

		// Commit all preview shapes
		let lastShape: DiagramShape | null = null
		for (const newShape of this.quickConnectPreviewShapes) {
			// Restore original styling on shape
			this.applyQuickConnectShapeAppearance(newShape, originalShape, false)
			newShape.element.style.pointerEvents = ''
			newShape.element.querySelectorAll('*').forEach((child: Element) => {
				(child as SVGElement).style.pointerEvents = ''
			})
			// Clear element-level opacity for React shapes
			if (newShape.type === 'service-card' || newShape.type === 'todo-card') {
				newShape.element.style.opacity = ''
			}
			newShape.render()

			// Add the new shape to the same group as the original shape
			if (originalShape.layout.parentId) {
				newShape.layout.parentId = originalShape.layout.parentId
			}

			// Add the new shape to the same frame as the original shape
			if (originalShape.layout.frameId) {
				newShape.layout.frameId = originalShape.layout.frameId
				// Also register with the frame's childIds
				const frame = this.getFrameById(originalShape.layout.frameId)
				if (frame) {
					frame.childIds.push(newShape.id)
				}
			}

			this.shapes.push(newShape)
			lastShape = newShape
		}

		// Select the last created shape
		if (lastShape) {
			this.deselectAllShapes()
			this.selectShape(lastShape)
		}

		// Expand frame if the original shape was inside a frame
		if (originalShape.layout.frameId) {
			const frame = this.getFrameById(originalShape.layout.frameId)
			if (frame) {
				this.expandFrameToFitChildren(frame)
			}
		}

		// Clear preview references (but don't remove from DOM since they're now permanent)
		this.quickConnectPreviewConnectors = []
		this.quickConnectPreviewShapes = []
		this.quickConnectPreviewSide = null
		this.quickConnectPreviewShapeId = null
		this.quickConnectPreviewCount = 0

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	private clearQuickConnectPreview(): void {
		// Remove all preview connectors from DOM
		for (const connector of this.quickConnectPreviewConnectors) {
			connector.element.remove()
		}
		this.quickConnectPreviewConnectors = []

		// Remove all preview shapes from DOM
		for (const shape of this.quickConnectPreviewShapes) {
			shape.element.remove()
		}
		this.quickConnectPreviewShapes = []

		// Clear cache
		this.quickConnectPreviewSide = null
		this.quickConnectPreviewShapeId = null
		this.quickConnectPreviewCount = 0
	}


	// ==================== Public Keyboard Quick Connect Methods ====================

	/**
	 * Start keyboard-driven quick connect preview.
	 * Called when Command + Arrow is pressed.
	 * Returns true if preview was started successfully.
	 */
	public startKeyboardQuickConnect(side: QuickConnectSide, count: number = 1): boolean {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1) return false

		const originalShape = selectedShapes[0]
		// Don't allow quick connect on connectors, frames, or freehand
		if (['connector', 'frame', 'freehand'].includes(originalShape.type)) return false

		this.showQuickConnectPreview(originalShape, side, count)

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(side)
		}

		return true
	}

	/**
	 * Update keyboard-driven quick connect preview to a new direction or count.
	 * Called when arrow key changes while Command is held or same key pressed again.
	 */
	public updateKeyboardQuickConnect(side: QuickConnectSide, count: number = 1): void {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1) return

		const originalShape = selectedShapes[0]
		this.showQuickConnectPreview(originalShape, side, count)

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(side)
		}
	}

	/**
	 * Commit the keyboard-driven quick connect preview (make it permanent).
	 * Called when Command key is released.
	 * Returns true if commit was successful.
	 */
	public commitKeyboardQuickConnect(): boolean {
		if (this.quickConnectPreviewConnectors.length === 0) return false

		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length !== 1) {
			this.cancelKeyboardQuickConnect()
			return false
		}

		const originalShape = selectedShapes[0]
		this.commitQuickConnectPreview(originalShape)

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(null)
		}

		return true
	}

	/**
	 * Cancel keyboard-driven quick connect preview without committing.
	 * Called when Escape is pressed or selection changes.
	 */
	public cancelKeyboardQuickConnect(): void {
		this.clearQuickConnectPreview()

		if (this.selectionOverlay) {
			this.selectionOverlay.setActiveQuickConnect(null)
		}
	}

	/**
	 * Check if a keyboard quick connect preview is currently active.
	 */
	public isKeyboardQuickConnectActive(): boolean {
		return this.quickConnectPreviewConnectors.length > 0
	}

	/**
	 * Check if two shapes are already connected by a connector.
	 * Returns true if any connector links the two shapes (in either direction).
	 */
	private areShapesConnected(shapeId1: string, shapeId2: string): boolean {
		for (const shape of this.shapes) {
			if (shape.type === 'connector') {
				const connector = shape as ConnectorShape
				const startId = connector.startShapeId
				const endId = connector.endShapeId
				// Check both directions
				if ((startId === shapeId1 && endId === shapeId2) ||
					(startId === shapeId2 && endId === shapeId1)) {
					return true
				}
			}
		}
		return false
	}

	/**
	 * Find a shape that overlaps with the given bounding box.
	 * Excludes connectors, frames, freehand shapes, and the original shape itself.
	 * Also excludes shapes in groups and groups themselves.
	 */
	private findOverlappingShape(
		bbox: { x: number; y: number; width: number; height: number },
		excludeShapeId: string
	): DiagramShape | null {
		for (const shape of this.shapes) {
			// Skip the original shape
			if (shape.id === excludeShapeId) continue
			// Skip connectors, frames, freehand shapes
			if (['connector', 'frame', 'freehand'].includes(shape.type)) continue
			// Skip shapes that are part of a group (only allow top-level shapes)
			if (shape.layout.parentId !== null) continue

			// Check if bounding boxes overlap
			const shapeLeft = shape.layout.x
			const shapeRight = shape.layout.x + shape.layout.width
			const shapeTop = shape.layout.y
			const shapeBottom = shape.layout.y + shape.layout.height

			const bboxLeft = bbox.x
			const bboxRight = bbox.x + bbox.width
			const bboxTop = bbox.y
			const bboxBottom = bbox.y + bbox.height

			// Check for intersection
			const overlaps = !(
				shapeRight < bboxLeft ||
				shapeLeft > bboxRight ||
				shapeBottom < bboxTop ||
				shapeTop > bboxBottom
			)

			if (overlaps) {
				return shape
			}
		}
		return null
	}

	public getSelectionOverlay(): SelectionOverlay | null {
		return this.selectionOverlay
	}

	public updateSelectionOverlayScale(scale: number): void {
		if (this.selectionOverlay) {
			this.selectionOverlay.updateScale(scale)
		}
		// Update scale for all group boundary overlays
		this.groupBoundaryOverlays.forEach(overlay => overlay.updateScale(scale))
		// Update scale for all connector handles to maintain constant pixel size
		// and for ReactShapes to handle pointer events correctly at any zoom level
		this.shapes.forEach(shape => {
			if (shape.type === 'connector') {
				(shape as ConnectorShape).updateScale(scale)
			} else if (shape.type === 'service-card' || shape.type === 'todo-card') {
				(shape as ReactShape).setScale(scale)
			}
		})
	}

	// Text editing management
	public startTextEditing(shape: DiagramShape): void {
		// Clear hover state when starting to edit
		this.clearHover()
		
		this.editingShape = shape
		shape.state.isEditingText = true
		
		// Switch selection overlay to editing mode (lighter border, no handles)
		if (this.selectionOverlay) {
			this.selectionOverlay.setEditingMode(true)
		}
		
		// Pass callback to text renderer for when editing stops
		TextRenderer.setTextEditingStopCallback(() => {
			this.stopTextEditing()
			if (this.onTextEditingStop) {
				this.onTextEditingStop()
			}
		})
		
		this.updateShapeText(shape)
	}

	public stopTextEditing(): void {
		if (this.editingShape) {
			this.editingShape.state.isEditingText = false
			this.updateShapeText(this.editingShape)
			this.editingShape = null
			
			// Restore selection overlay to normal mode (normal border with handles)
			if (this.selectionOverlay) {
				this.selectionOverlay.setEditingMode(false)
			}
			
			// Clear callback
			TextRenderer.setTextEditingStopCallback(null)
			
			// Notify that shapes were modified (for storage save)
			this.notifyShapesModified()
		}
	}

	public getEditingShape(): DiagramShape | null {
		return this.editingShape
	}

	public isEditingText(): boolean {
		return this.editingShape !== null
	}

	public updateShapeText(shape: DiagramShape): void {
		if (this.contentLayer) {
			const selectedCount = this.getSelectedShapes().length
			TextRenderer.renderText(shape, selectedCount)
		}
	}

	public renderAllText(): void {
		if (!this.contentLayer) return
		
		const selectedCount = this.getSelectedShapes().length
		this.shapes.forEach(shape => {
			TextRenderer.renderText(shape, selectedCount)
		})
	}

	public setShapeText(shape: DiagramShape, text: string): void {
		shape.text = text
		this.updateShapeText(shape)
		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	public setHoveredShape(shape: DiagramShape | null): void {
		// Clear hover state from all shapes
		this.shapes.forEach(s => {
			if (s.state.hovered) {
				s.state.hovered = false
				this.updateShapeText(s)
			}
		})

		// Set hover state on the new shape
		if (shape) {
			shape.state.hovered = true
			this.updateShapeText(shape)
		}
	}

	public clearHover(): void {
		this.shapes.forEach(shape => {
			if (shape.state.hovered) {
				shape.state.hovered = false
				this.updateShapeText(shape)
			}
		})
	}

	// === Shape Alignment Methods ===
	// Align selected shapes relative to the selection bounding box
	// Groups are treated as single units unless only a single complete group is selected

	/**
	 * Helper to get alignable units (shapes/groups treated as units)
	 * For a single complete group selection, returns direct children (shapes + child groups as units)
	 * For mixed selection, returns ungrouped shapes + topmost groups as units
	 */
	private getAlignableUnits(): { unit: DiagramShape | string; bounds: { x: number; y: number; width: number; height: number } }[] | null {
		const selectedShapes = this.getSelectedShapes()
		if (selectedShapes.length < 2) return null

		// Filter out connectors that are connected to at least one shape
		// Only include connectors if they're completely unattached (both startShapeId and endShapeId are null)
		const alignableShapes = selectedShapes.filter(shape => {
			if (shape.type === 'connector') {
				const connector = shape as ConnectorShape
				// Exclude if connected to any shape
				return connector.startShapeId === null && connector.endShapeId === null
			}
			return true
		})

		// Need at least 2 alignable shapes
		if (alignableShapes.length < 2) return null

		// Check if all selected shapes belong to the same topmost group and the entire group is selected
		const firstTopmostGroupId = this.getTopmostGroupId(alignableShapes[0])
		const allSameGroup = firstTopmostGroupId && alignableShapes.every(s => this.getTopmostGroupId(s) === firstTopmostGroupId)

		if (allSameGroup && firstTopmostGroupId) {
			// Check if ALL shapes in this group are selected (complete group selection)
			const allGroupShapes = this.getAllShapesInGroupRecursive(firstTopmostGroupId)
			const isCompleteGroupSelection = allGroupShapes.length === selectedShapes.length &&
				allGroupShapes.every(s => s.state.selected)

			if (isCompleteGroupSelection) {
				// Single complete group selected - align direct children
				// Direct children are: shapes with parentId === groupId, and child groups
				const directShapes = this.getShapesInGroup(firstTopmostGroupId)
				const childGroupIds = this.getChildGroupIds(firstTopmostGroupId)

				const units: { unit: DiagramShape | string; bounds: { x: number; y: number; width: number; height: number } }[] = []

				// Add direct shapes as units
				directShapes.forEach(shape => {
					units.push({
						unit: shape,
						bounds: { x: shape.layout.x, y: shape.layout.y, width: shape.layout.width, height: shape.layout.height }
					})
				})

				// Add child groups as units
				childGroupIds.forEach(groupId => {
					const groupShapes = this.getAllShapesInGroupRecursive(groupId)
					const groupBounds = this.getBoundingBox(groupShapes)
					units.push({
						unit: groupId,
						bounds: groupBounds
					})
				})

				return units.length >= 2 ? units : null
			}
		}

		// Mixed selection - collect topmost groups and ungrouped shapes
		const groupIds = new Set<string>()
		const ungroupedShapes: DiagramShape[] = []

		alignableShapes.forEach(shape => {
			const topmostGroupId = this.getTopmostGroupId(shape)
			if (topmostGroupId) {
				groupIds.add(topmostGroupId)
			} else {
				ungroupedShapes.push(shape)
			}
		})

		const units: { unit: DiagramShape | string; bounds: { x: number; y: number; width: number; height: number } }[] = []

		// Add ungrouped shapes as units
		ungroupedShapes.forEach(shape => {
			// For connectors, calculate bounds directly from points to ensure accuracy
			if (shape.type === 'connector') {
				const connector = shape as ConnectorShape
				// Ensure connector is rendered so its internal state is current
				connector.render()
				const minX = Math.min(connector.startPoint.x, connector.endPoint.x)
				const minY = Math.min(connector.startPoint.y, connector.endPoint.y)
				const maxX = Math.max(connector.startPoint.x, connector.endPoint.x)
				const maxY = Math.max(connector.startPoint.y, connector.endPoint.y)
				units.push({
					unit: shape,
					bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
				})
			} else {
				units.push({
					unit: shape,
					bounds: { x: shape.layout.x, y: shape.layout.y, width: shape.layout.width, height: shape.layout.height }
				})
			}
		})

		// Add groups as units
		groupIds.forEach(groupId => {
			const groupShapes = this.getAllShapesInGroupRecursive(groupId)
			const groupBounds = this.getBoundingBox(groupShapes)
			units.push({
				unit: groupId,
				bounds: groupBounds
			})
		})

		return units.length >= 2 ? units : null
	}

	/**
	 * Helper to move a unit (shape or group) by an offset
	 * Also updates connected connectors for each moved shape
	 */
	private moveUnit(unit: DiagramShape | string, deltaX: number, deltaY: number): void {
		if (typeof unit === 'string') {
			// It's a group ID - move all shapes in the group
			const groupShapes = this.getAllShapesInGroupRecursive(unit)
			groupShapes.forEach(shape => {
				shape.layout.move(deltaX, deltaY)
				// Update any connectors attached to this shape
				this.updateConnectorsForShape(shape, deltaX, deltaY)
				// Update text position to stay connected to shape
				this.updateShapeText(shape)
			})
		} else {
			// It's a single shape
			unit.layout.move(deltaX, deltaY)
			// Update any connectors attached to this shape
			this.updateConnectorsForShape(unit, deltaX, deltaY)
			// Update text position to stay connected to shape
			this.updateShapeText(unit)
		}
	}

	/**
	 * Align selected shapes to the left edge of the selection bounding box
	 */
	public alignSelectedShapesLeft(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let minX = Infinity
		units.forEach(u => { minX = Math.min(minX, u.bounds.x) })

		// Align each unit to left
		units.forEach(u => {
			const deltaX = minX - u.bounds.x
			if (deltaX !== 0) {
				this.moveUnit(u.unit, deltaX, 0)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Align selected shapes to the horizontal center of the selection bounding box
	 */
	public alignSelectedShapesCenter(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let minX = Infinity, maxX = -Infinity
		units.forEach(u => {
			minX = Math.min(minX, u.bounds.x)
			maxX = Math.max(maxX, u.bounds.x + u.bounds.width)
		})
		const centerX = (minX + maxX) / 2

		// Center each unit
		units.forEach(u => {
			const unitCenterX = u.bounds.x + u.bounds.width / 2
			const deltaX = centerX - unitCenterX
			if (deltaX !== 0) {
				this.moveUnit(u.unit, deltaX, 0)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Align selected shapes to the right edge of the selection bounding box
	 */
	public alignSelectedShapesRight(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let maxX = -Infinity
		units.forEach(u => { maxX = Math.max(maxX, u.bounds.x + u.bounds.width) })

		// Align each unit to right
		units.forEach(u => {
			const unitRight = u.bounds.x + u.bounds.width
			const deltaX = maxX - unitRight
			if (deltaX !== 0) {
				this.moveUnit(u.unit, deltaX, 0)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Align selected shapes to the top edge of the selection bounding box
	 */
	public alignSelectedShapesTop(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let minY = Infinity
		units.forEach(u => { minY = Math.min(minY, u.bounds.y) })

		// Align each unit to top
		units.forEach(u => {
			const deltaY = minY - u.bounds.y
			if (deltaY !== 0) {
				this.moveUnit(u.unit, 0, deltaY)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Align selected shapes to the vertical middle of the selection bounding box
	 */
	public alignSelectedShapesMiddle(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let minY = Infinity, maxY = -Infinity
		units.forEach(u => {
			minY = Math.min(minY, u.bounds.y)
			maxY = Math.max(maxY, u.bounds.y + u.bounds.height)
		})
		const centerY = (minY + maxY) / 2

		// Center each unit
		units.forEach(u => {
			const unitCenterY = u.bounds.y + u.bounds.height / 2
			const deltaY = centerY - unitCenterY
			if (deltaY !== 0) {
				this.moveUnit(u.unit, 0, deltaY)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}

	/**
	 * Align selected shapes to the bottom edge of the selection bounding box
	 */
	public alignSelectedShapesBottom(): void {
		const units = this.getAlignableUnits()
		if (!units) return

		// Calculate overall bounds
		let maxY = -Infinity
		units.forEach(u => { maxY = Math.max(maxY, u.bounds.y + u.bounds.height) })

		// Align each unit to bottom
		units.forEach(u => {
			const unitBottom = u.bounds.y + u.bounds.height
			const deltaY = maxY - unitBottom
			if (deltaY !== 0) {
				this.moveUnit(u.unit, 0, deltaY)
			}
		})

		this.updateSelectionOverlay()
		this.notifyShapesModified()
	}
}	
