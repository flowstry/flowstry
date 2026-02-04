import { SVG_NAMESPACE } from '@/src/consts/svg'
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { DiagramShape, ShapeName } from '../base'

/**
 * Configuration for a React component to render inside ReactShape
 */
export interface ReactShapeComponentConfig {
	/** The React component to render */
	component: React.ComponentType<ReactShapeContentProps>
	/** Component-specific data that will be passed as props */
	data: Record<string, unknown>
}

/**
 * Standard props passed to all ReactShape content components
 */
export interface ReactShapeContentProps {
	/** Current width of the shape */
	width: number
	/** Current height of the shape */
	height: number
	/** Theme for styling */
	theme: 'light' | 'dark'
	/** Whether the shape is currently selected */
	isSelected: boolean
	/** Current canvas scale/zoom level */
	scale: number
	/** Callback to update component data */
	onDataChange: (data: Record<string, unknown>) => void
	/** Callback to request new minimum dimensions - shape will expand if needed */
	onMinDimensionsChange: (minWidth: number, minHeight: number) => void
	/** Callback to select the shape - call from button handlers to ensure selection */
	onSelect: () => void
	/** Callback to dismiss interactions (close modals, blur inputs) - called on outside click */
	onDismiss: () => void
	/** Component-specific data */
	data: Record<string, unknown>
}

/**
 * ReactShape - A canvas shape that renders a React component via foreignObject
 * 
 * This is a concrete, reusable class that can render any React component.
 * All component-specific logic is handled by the component itself.
 */
export class ReactShape extends DiagramShape {
	// React rendering
	private reactRoot: Root | null = null
	private foreignObject: SVGForeignObjectElement
	private containerDiv: HTMLDivElement
	
	// Background rect for hit testing
	private backgroundRect: SVGRectElement
	
	// Component configuration
	private componentConfig: ReactShapeComponentConfig
	
	// Theme
	private theme: 'light' | 'dark' = 'dark'
	
	// Canvas scale/zoom level
	private scale: number = 1

	// Minimum dimensions (can be updated based on content)
	private minWidth: number = 100
	private minHeight: number = 40
	
	constructor(
		type: ShapeName,
		componentConfig: ReactShapeComponentConfig,
		x: number, 
		y: number, 
		width: number, 
		height: number,
		minWidth: number = 100,
		minHeight: number = 40
	) {
		const group = document.createElementNS(SVG_NAMESPACE, 'g')
		super(type, group, x, y, width, height)
		
		this.componentConfig = componentConfig
		this.minWidth = minWidth
		this.minHeight = minHeight
		
		// Create background rect for hit testing
		this.backgroundRect = document.createElementNS(SVG_NAMESPACE, 'rect')
		this.backgroundRect.setAttribute('fill', 'transparent')
		this.backgroundRect.setAttribute('stroke', 'none')
		this.backgroundRect.setAttribute('pointer-events', 'all')
		this.shapeElement.appendChild(this.backgroundRect)
		
		// Create foreignObject for React component
		this.foreignObject = document.createElementNS(SVG_NAMESPACE, 'foreignObject')
		this.foreignObject.setAttribute('pointer-events', 'all')
		this.shapeElement.appendChild(this.foreignObject)
		
		// Create container div
		this.containerDiv = document.createElement('div')
		this.containerDiv.style.width = '100%'
		this.containerDiv.style.height = '100%'
		this.containerDiv.style.pointerEvents = 'auto'
		this.containerDiv.style.overflow = 'hidden'
		this.foreignObject.appendChild(this.containerDiv)
		
		// Initialize React root
		this.reactRoot = createRoot(this.containerDiv)
		
		// Bind methods for stable callback references
		this.handleMinDimensionsChange = this.handleMinDimensionsChange.bind(this)
		this.handleDataChange = this.handleDataChange.bind(this)
		this.handleSelect = this.handleSelect.bind(this)
		this.handleDismiss = this.handleDismiss.bind(this)

		this.state.resizable = true
		this.state.needsRender = true
	}
	
	setTheme(theme: 'light' | 'dark'): void {
		this.theme = theme
		this.state.needsRender = true
	}
	
	setScale(scale: number): void {
		this.scale = scale
		this.state.needsRender = true
	}

	setMinDimensions(minWidth: number, minHeight: number): void {
		this.minWidth = minWidth
		this.minHeight = minHeight
	}
	
	/**
	 * Optional callback that gets called when the shape self-resizes due to content changes.
	 * DiagramManager can set this to update connectors and selection overlay.
	 */
	public onSelfResize: (() => void) | null = null
	
	/**
	 * Optional callback that gets called when the shape should be selected.
	 * DiagramManager sets this to handle selection when buttons are clicked.
	 */
	public onSelectShape: (() => void) | null = null

	/**
	 * Optional callback that gets called when interactions should be dismissed.
	 * Components use this to close modals and blur inputs on outside click.
	 */
	private dismissCallback: (() => void) | null = null

	/**
	 * Set the dismiss callback from the React component
	 */
	public setDismissCallback(callback: (() => void) | null): void {
		this.dismissCallback = callback
	}

	/**
	 * Called externally to dismiss all interactions (close modals, blur inputs)
	 */
	public dismissInteractions(): void {
		if (this.dismissCallback) {
			this.dismissCallback()
		}
	}

	/**
	 * Called by component when content changes and new minimum dimensions are needed.
	 * Expands the shape if current size is smaller than requested minimum.
	 */
	private handleMinDimensionsChange(newMinWidth: number, newMinHeight: number): void {
		this.minWidth = newMinWidth
		this.minHeight = newMinHeight
		
		// Expand if current dimensions are smaller than new minimums
		let needsResize = false
		let newWidth = this.layout.width
		let newHeight = this.layout.height
		
		if (this.layout.width < newMinWidth) {
			newWidth = newMinWidth
			needsResize = true
		}
		if (this.layout.height < newMinHeight) {
			newHeight = newMinHeight
			needsResize = true
		}
		
		if (needsResize) {
			this.layout.updateBounds(this.layout.x, this.layout.y, newWidth, newHeight)
			this.state.needsRender = true
			
			// Notify listeners (DiagramManager) about the resize
			if (this.onSelfResize) {
				this.onSelfResize()
			}
		}
	}
	
	/**
	 * Bound handler for component data changes
	 */
	private handleDataChange(newData: Record<string, unknown>): void {
		this.componentConfig.data = { ...this.componentConfig.data, ...newData }
		this.state.needsRender = true
	}

	/**
	 * Called by component to select the shape (e.g., from button handlers)
	 */
	private handleSelect(): void {
		if (this.onSelectShape) {
			this.onSelectShape()
		}
	}

	/**
	 * Called by component to register its dismiss handler
	 */
	private handleDismiss(): void {
		// This is called by the component to trigger dismissal
		// The actual dismiss logic is in the dismissCallback set by the component
		if (this.dismissCallback) {
			this.dismissCallback()
		}
	}

	updateData(data: Record<string, unknown>): void {
		this.componentConfig.data = { ...this.componentConfig.data, ...data }
		this.state.needsRender = true
	}
	
	getData(): Record<string, unknown> {
		return this.componentConfig.data
	}
	
	resize(x: number, y: number, width: number, height: number): void {
		this.layout.updateBounds(x, y, Math.max(this.minWidth, width), Math.max(this.minHeight, height))
	}
	
	move(x: number, y: number): void {
		this.layout.updatePosition(x, y)
	}


	render(): void {
		if (!this.state.needsRender) return
		
		// Update background rect
		this.backgroundRect.setAttribute('x', String(this.layout.x))
		this.backgroundRect.setAttribute('y', String(this.layout.y))
		this.backgroundRect.setAttribute('width', String(this.layout.width))
		this.backgroundRect.setAttribute('height', String(this.layout.height))
		this.backgroundRect.setAttribute('rx', '12')
		this.backgroundRect.setAttribute('ry', '12')
		
		// Update foreignObject
		this.foreignObject.setAttribute('x', String(this.layout.x))
		this.foreignObject.setAttribute('y', String(this.layout.y))
		this.foreignObject.setAttribute('width', String(this.layout.width))
		this.foreignObject.setAttribute('height', String(this.layout.height))
		
		// Update selection indicator if it exists (for multi-select)
		this.selection.update()

		// Render React component
		if (this.reactRoot) {
			const { component: Component, data } = this.componentConfig
			this.reactRoot.render(
				React.createElement(Component, {
					width: this.layout.width,
					height: this.layout.height,
					theme: this.theme,
					isSelected: this.state.selected,
					scale: this.scale,
					data,
					onDataChange: this.handleDataChange,
					onMinDimensionsChange: this.handleMinDimensionsChange,
					onSelect: this.handleSelect,
					onDismiss: this.handleDismiss
				})
			)
		}
		
		this.state.needsRender = false
	}
	
	destroy(): void {
		if (this.reactRoot) {
			this.reactRoot.unmount()
			this.reactRoot = null
		}
	}
	
	getSerializationData(): Record<string, unknown> {
		return {
			componentData: this.componentConfig.data
		}
	}

	copy(): DiagramShape {
		const newConfig = {
			component: this.componentConfig.component,
			data: structuredClone(this.componentConfig.data)
		};
		// Private properties access? minWidth/minHeight are private but usually we can access them in same class. 
		// But in Typescript copy() is same class.
		const newShape = new ReactShape(
			this.type,
			newConfig,
			this.layout.x,
			this.layout.y,
			this.layout.width,
			this.layout.height,
			(this as any).minWidth, // Accessing private via cast or just use defaults if not critical? Layout usually handles size.
			(this as any).minHeight
		);
		newShape.copyFrom(this);
		newShape.setTheme((this as any).theme);
		newShape.setScale((this as any).scale);
		return newShape;
	}
}

