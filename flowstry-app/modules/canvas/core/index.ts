import { MAX_SCALE, MIN_SCALE } from "../consts/canvas";
import { DiagramManager } from "../shapes";
import { ShapeName } from "../shapes/base";
import { ArrowheadType, ConnectorType } from "../shapes/connectors";
import { FreehandMarkerType } from "../shapes/freehand";
import { ConnectorTool, DiagramTool, DrawingTool, FrameTool, ImageTool, LaserPointerTool, PanTool, PencilTool, SelectTool, ZoomTool } from "../tools";
import type { UserPresence } from "../types/collaboration";
import { ClipboardManager } from "./ClipboardManager";
import { CollaborationManager } from "./CollaborationManager";
import { EdgePanManager } from "./EdgePanManager";
import { HistoryManager } from "./HistoryManager";
import { ImageExportManager } from "./ImageExportManager";
import { SettingsManager, type CanvasSettings } from "./SettingsManager";
import { FileStoragePlugin, StorageManager } from "./storage";

// Utility function to clamp a value between min and max
const clamp = (value: number, min: number, max: number) => 
    Math.min(Math.max(value, min), max);

export interface CanvasState {
    scale: number;
    translation: { x: number; y: number };
}

export interface CanvasTransformDetail {
    scale: number;
    translation: { x: number; y: number };
}

// The Main canvas engine.
// InteractionEngine is responsible for handling user interactions with the svg div container. 
// Div is better than svg because it allows for more precise control of user interactions.
export class InteractionEngine {
    private diagramManager: DiagramManager;
    private settingsManager: SettingsManager;

    private tools: Map<string, DiagramTool> = new Map();
    private activeTool: DiagramTool | null = null;

    private containerRef: React.RefObject<HTMLDivElement | null> | null = null;
    private svgRef: React.RefObject<SVGSVGElement | null> | null = null;
    private contentLayerRef: React.RefObject<SVGGElement | null> | null = null;

    // Canvas state
    private scale: number = 1;
    private translation: { x: number; y: number } = { x: 0, y: 0 };
    private panStartTranslation: { x: number; y: number } = { x: 0, y: 0 };

    // Interaction state
    private isSpacePressed: boolean = false;
    private isReadOnly: boolean = false;

    // Multi-touch interaction state
    private activePointers: Map<number, { x: number; y: number }> = new Map();
    private gestureState: {
        startScale: number;
        startTranslation: { x: number; y: number };
        startDistance: number;
        startMidpoint: { x: number; y: number };
    } | null = null;

    // Edge panning for drag and marquee operations
    private edgePanManager: EdgePanManager;

    // Clipboard manager for copy/cut/paste
    private clipboardManager: ClipboardManager;

    // History manager for undo/redo
    private historyManager: HistoryManager;

    // Storage manager for save/load
    private storageManager: StorageManager;

    // Image export manager
    private imageExportManager: ImageExportManager | null = null;

    // Built-in tools
    private panTool: PanTool;
    private zoomTool: ZoomTool;
    private selectTool: SelectTool;
    private drawingTool: DrawingTool;
    private imageTool: ImageTool;
    private connectorTool: ConnectorTool;
    private pencilTool: PencilTool;
    private laserPointerTool: LaserPointerTool;
    private frameTool: FrameTool;
    // Callbacks for state changes
    private onStateChange: ((state: CanvasState) => void) | null = null;
    private onCursorChange: ((cursor: string) => void) | null = null;
    private onShapesChange: (() => void) | null = null;
    private onToolChange: ((toolName: string) => void) | null = null;
    private onSettingsChange: ((settings: CanvasSettings) => void) | null = null;

    // Collaboration manager
    private collaborationManager: CollaborationManager | null = null;
    private onCollaborationChange: ((users: UserPresence[]) => void) | null = null;

    private getCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.svgRef?.current?.getBoundingClientRect();
        if (!rect) {
            return { x: clientX, y: clientY };
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    constructor() {
        this.diagramManager = new DiagramManager();
        
        // Initialize clipboard manager
        this.clipboardManager = new ClipboardManager(this.diagramManager);
        
        // Initialize history manager
        this.historyManager = new HistoryManager(this.diagramManager);
        
        // Initialize storage manager (automatically creates default LocalStoragePlugin)
        this.storageManager = new StorageManager(this.diagramManager);
        
        // Initialize settings manager (loads global settings internally)
        this.settingsManager = new SettingsManager();
        // Update storage manager's reference to settings manager
        (this.storageManager as any).settingsManager = this.settingsManager;

        // Register file plugin for import/export
        const fileStoragePlugin = new FileStoragePlugin();
        this.storageManager.registerPlugin(fileStoragePlugin);
        
        // Sync settings with DiagramManager
        this.settingsManager.setOnSettingsChange((settings) => {
            this.diagramManager.setSnapToGrid(settings.snapToGrid);
            if (settings.defaultShapeAppearance) {
                this.diagramManager.setDefaultShapeAppearance(settings.defaultShapeAppearance);
            }
            if (this.onSettingsChange) {
                this.onSettingsChange(settings);
            }
            // Settings are auto-saved by SettingsManager (global) or marked dirty in Diagram (canvas)
            // Ideally we should trigger a save if canvas settings changed, but we rely on DiagramManager changes?
            // Since settings aren't shapes, we might need to manually trigger storageManager.markDirty() if canvas settings change
            // But for now let's assume explicit property updates handlers will handle it or user saving

            // Actually, if we change grid/bg, we probably want to save the diagram context?
            if (this.storageManager.getActivePlugin()?.name !== 'file') {
                // For now, autosave is handled by shape modification. 
                // We might want to save on settings change too if it's a canvas setting.
                this.storageManager.save().catch(e => console.error("Failed to save settings to diagram", e));
            }
        });

        // Initialize edge pan manager
        this.edgePanManager = new EdgePanManager(
            (deltaX, deltaY) => this.handleEdgePan(deltaX, deltaY),
            () => this.containerRef?.current?.getBoundingClientRect() || null,
            () => this.handleEdgePanUpdate()
        );
        
        // Initialize built-in tools
        this.panTool = new PanTool(
            this.diagramManager,
            () => this.handlePanStart(),
            (deltaX, deltaY) => this.handlePan(deltaX, deltaY),
            () => this.handlePanEnd(),
            () => this.getCurrentTranslation()
        );
        
        this.zoomTool = new ZoomTool(
            (scale, pivotX, pivotY) => this.handleZoom(scale, pivotX, pivotY),
            (deltaX, deltaY) => this.handleWheelPan(deltaX, deltaY),
            () => this.scale,
            () => this.svgRef?.current || null
        );

        this.selectTool = new SelectTool(
            this.diagramManager,
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => this.notifyShapesChange(),
            () => this.edgePanManager,
            () => this.recordHistory()
        );

        this.drawingTool = new DrawingTool(
            this.diagramManager,
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        this.imageTool = new ImageTool(
            (toolName: string) => this.activateTool(toolName),
            this.drawingTool
        );

        this.connectorTool = new ConnectorTool(
            this.diagramManager,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        this.pencilTool = new PencilTool(
            this.diagramManager,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Laser pointer tool - ephemeral strokes, no history
        this.laserPointerTool = new LaserPointerTool(
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation })
        );

        // Frame tool - click-drag to create frames
        this.frameTool = new FrameTool(
            this.diagramManager,
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Register built-in tools
        this.registerTool(this.panTool);
        this.registerTool(this.zoomTool);
        this.registerTool(this.selectTool);
        this.registerTool(this.drawingTool);
        this.registerTool(this.imageTool);
        this.registerTool(this.connectorTool);
        this.registerTool(this.pencilTool);
        this.registerTool(this.laserPointerTool);
        this.registerTool(this.frameTool);

        // Set Select as default tool
        this.activateTool('Select');
    }

    public getSettingsManager(): SettingsManager {
        return this.settingsManager;
    }



    public setOnSettingsChange(callback: (settings: CanvasSettings) => void) {
        this.onSettingsChange = callback;
    }

    public setReadOnly(enabled: boolean) {
        if (this.isReadOnly === enabled) return;
        this.isReadOnly = enabled;

        if (enabled) {
            // Deselect all shapes
            this.diagramManager.deselectAllShapes();
            this.diagramManager.hideSelectionOverlay();

            // Revert active tool if restricted (allow Pan and LaserPointer)
            if (this.activeTool && this.activeTool.name !== 'Pan' && this.activeTool.name !== 'LaserPointer') {
                this.activateTool('Pan');
            }

            // Force UI update (e.g. to hide handles)
            this.notifyShapesChange();
        } else {
            // Restore a selection-friendly default when leaving view-only mode
            if (this.activeTool && (this.activeTool.name === 'Pan' || this.activeTool.name === 'LaserPointer')) {
                this.activateTool('Select');
            }
        }
    }

    public getReadOnly(): boolean {
        return this.isReadOnly;
    }

    public setLockedShapeIds(ids: string[]) {
        if (this.selectTool) {
            this.selectTool.setLockedShapeIds(ids);
        }
    }

    // Tool Management
    public registerTool(tool: DiagramTool): void {
        this.tools.set(tool.name, tool);
    }

    public unregisterTool(toolName: string): void {
        const tool = this.tools.get(toolName);
        if (tool && tool === this.activeTool) {
            this.deactivateTool();
        }
        this.tools.delete(toolName);
    }

    public activateTool(toolName: string): boolean {
        // In read-only mode, only Pan and LaserPointer are allowed
        if (this.isReadOnly && toolName !== 'Pan' && toolName !== 'LaserPointer') {
            return false;
        }

        const tool = this.tools.get(toolName);
        if (!tool) return false;

        // Deactivate current tool
        if (this.activeTool) {
            this.activeTool.deactivate();
        }

        // Activate new tool
        this.activeTool = tool;
        this.activeTool.activate();
        this.notifyCursorChange();
        
        // Notify listeners of tool change
        if (this.onToolChange) {
            this.onToolChange(toolName);
        }
        
        return true;
    }

    public deactivateTool(): void {
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
            this.notifyCursorChange();
        }
    }

    public getActiveTool(): DiagramTool | null {
        return this.activeTool;
    }

    public getTool(toolName: string): DiagramTool | null {
        return this.tools.get(toolName) || null;
    }

    // Initialize the engine with refs to DOM elements
    public initialize(
        containerRef: React.RefObject<HTMLDivElement | null>,
        svgRef: React.RefObject<SVGSVGElement | null>,
        contentLayerRef: React.RefObject<SVGGElement | null>,
        onStateChange?: (state: CanvasState) => void,
        onCursorChange?: (cursor: string) => void,
        onShapesChange?: () => void,
        onToolChange?: (toolName: string) => void,
        onDragChange?: (isDragging: boolean) => void,
        onResizeChange?: (isResizing: boolean) => void
    ) {
        this.containerRef = containerRef;
        this.svgRef = svgRef;
        this.contentLayerRef = contentLayerRef;
        this.onStateChange = onStateChange || null;
        this.onCursorChange = onCursorChange || null;
        this.onShapesChange = onShapesChange || null;
        this.onToolChange = onToolChange || null;

        // Initialize selection overlay in DiagramManager
        if (contentLayerRef.current) {
            this.diagramManager.initializeSelectionOverlay(contentLayerRef.current);
            // Set initial scale for zoom-independent handle sizes
            this.diagramManager.updateSelectionOverlayScale(this.scale);

            // Set up quick connect drag start callback to initiate connector endpoint dragging
            this.diagramManager.setOnQuickConnectDragStart((connector, side, clientX, clientY) => {
                this.selectTool.startQuickConnectDrag(connector, side, clientX, clientY);
            });
        }

        // Initialize tools with callbacks
        this.selectTool.setCallbacks(
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => this.notifyShapesChange(),
            () => this.edgePanManager,
            () => this.recordHistory(),
            (isDragging: boolean) => {
                if (onDragChange) {
                    onDragChange(isDragging);
                }
            },
            (isResizing: boolean) => {
                if (onResizeChange) {
                    onResizeChange(isResizing);
                }
            }
        );

        // Initialize DrawingTool callbacks
        this.drawingTool.setCallbacks(
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Initialize TextEditTool callback to notify shapes change (triggers UI update for isEditingText)
        this.selectTool.getTextEditTool().setCallbacks(() => {
            this.notifyShapesChange();
        });

        // Initialize ConnectorTool callbacks
        this.connectorTool.setCallbacks(
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Initialize PencilTool callbacks
        this.pencilTool.setCallbacks(
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => this.contentLayerRef?.current || null,
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Initialize FrameTool callbacks
        this.frameTool.setCallbacks(
            () => this.svgRef?.current || null,
            () => this.containerRef?.current || null,
            () => ({ scale: this.scale, translation: this.translation }),
            () => {
                this.recordHistory();
                this.notifyShapesChange();
            },
            (toolName: string) => this.activateTool(toolName)
        );

        // Initialize image export manager
        this.imageExportManager = new ImageExportManager(
            this.diagramManager,
            svgRef.current,
            contentLayerRef.current
        );

        // Add getThumbnail method to public interface
        (this as any).getThumbnail = async (): Promise<Blob | null> => {
            if (this.imageExportManager) {
                return this.imageExportManager.getThumbnailBlob();
            }
            return null;
        };

        // Set text editing stop callback to trigger shape re-render and save
        this.diagramManager.setOnTextEditingStop(() => {
            // Record history when text editing stops to save the change
            this.recordHistory();
            if (this.onShapesChange) {
                this.onShapesChange();
            }
        });

        // Set refocus callback on TextEditTool so canvas regains focus after stopping text editing
        this.selectTool.getTextEditTool().setRefocusCallback(() => {
            if (this.containerRef?.current) {
                // Ensure container is focusable and has focus
                const container = this.containerRef.current;
                if (container.getAttribute('tabIndex') === null) {
                    container.setAttribute('tabIndex', '0');
                }
                // Focus immediately - the blur from text element should have already happened
                container.focus();
            }
        });

        // Set shapes modified callback to automatically save any shape changes
        this.diagramManager.setOnShapesModified(() => {
            // Save to storage immediately whenever shapes are modified
            this.storageManager.save().catch(err => {
                console.error('Failed to auto-save after shape modification:', err);
            });
        });

        // Set up event listeners to handle interrupted interactions
        this.setupInterruptionHandlers();
    }

    // Get current canvas state
    public getState(): CanvasState {
        return {
            scale: this.scale,
            translation: { ...this.translation }
        };
    }

    // Notify listeners of state changes
    private notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
        this.broadcastTransform();
        
        // Update selection overlay scale for zoom-independent handle sizes
        this.diagramManager.updateSelectionOverlayScale(this.scale);
    }

    // Notify listeners of cursor changes
    private notifyCursorChange() {
        if (this.onCursorChange) {
            const cursor = this.getCursorStyle();
            this.onCursorChange(cursor);
        }
    }

    // Notify listeners of shapes changes
    private notifyShapesChange() {
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    // Record current state for undo/redo (only if not currently restoring)
    public recordHistory(debounce: boolean = false) {
        if (!this.historyManager.isCurrentlyRestoring()) {
            this.historyManager.recordState(debounce);
            // Save immediately on every change (debouncing is handled by HistoryManager for history entries)
            this.storageManager.save().catch(err => {
                console.error('Failed to auto-save:', err);
            });
        }
    }

    // Helper methods for tool callbacks
    private getCurrentTranslation(): { x: number; y: number } {
        return { ...this.translation };
    }

    private handlePanStart(): void {
        this.panStartTranslation = { ...this.translation };
        this.setPanningAttribute(true);
        this.notifyCursorChange();
    }

    private handlePan(deltaX: number, deltaY: number): void {
        this.translation = {
            x: this.panStartTranslation.x + deltaX,
            y: this.panStartTranslation.y + deltaY,
        };
        this.notifyStateChange();
    }

    private handlePanEnd(): void {
        this.setPanningAttribute(false);
        this.notifyCursorChange();
    }

    private handleZoom(scale: number, pivotX: number, pivotY: number): void {
        const worldX = (pivotX - this.translation.x) / this.scale;
        const worldY = (pivotY - this.translation.y) / this.scale;
        const nextTranslationX = pivotX - worldX * scale;
        const nextTranslationY = pivotY - worldY * scale;

        this.scale = scale;
        this.translation = { x: nextTranslationX, y: nextTranslationY };
        this.notifyStateChange();
    }

    private handleWheelPan(deltaX: number, deltaY: number): void {
        this.translation = {
            x: this.translation.x - deltaX,
            y: this.translation.y - deltaY
        };
        this.notifyStateChange();
    }

    private handleEdgePan(deltaX: number, deltaY: number): void {
        // Edge panning directly modifies translation without storing start position
        this.translation = {
            x: this.translation.x + deltaX,
            y: this.translation.y + deltaY
        };
        this.notifyStateChange();
    }

    private handleEdgePanUpdate(): void {
        // Notify the active tool that edge panning occurred so it can update drag/marquee
        if (this.activeTool && 'handleEdgePanUpdate' in this.activeTool) {
            (this.activeTool as any).handleEdgePanUpdate();
        }
    }

    // Get edge pan manager for tools to use
    public getEdgePanManager(): EdgePanManager {
        return this.edgePanManager;
    }

    // Broadcast transform changes via custom event
    private broadcastTransform() {
        const svg = this.svgRef?.current;
        if (!svg) return;
        try {
            const evt = new CustomEvent<CanvasTransformDetail>('canvas-transform', {
                detail: { scale: this.scale, translation: this.translation }
            });
            svg.dispatchEvent(evt);
        } catch {
            // ignore
        }
    }

    // Set pan-key attribute on SVG
    private setPanKeyAttribute(active: boolean) {
        const svg = this.svgRef?.current;
        if (!svg) return;
        try {
            if (active) {
                svg.setAttribute('data-pan-key', 'true');
            } else {
                svg.removeAttribute('data-pan-key');
            }
        } catch {
            // noop
        }
    }

    // Set panning attribute on SVG
    private setPanningAttribute(active: boolean) {
        const svg = this.svgRef?.current;
        if (!svg) return;
        try {
            if (active) {
                svg.setAttribute('data-panning', 'true');
            } else {
                svg.removeAttribute('data-panning');
            }
        } catch {
            // noop
        }
    }

    // Update cursor visual
    private updateCursorVisual() {
        const container = this.containerRef?.current;
        if (!container) return;
        try {
            container.style.setProperty('--cursor-refresh', String(Math.random()));
        } catch {
            // noop
        }
    }

    // Keyboard handlers
    public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent) {
        // If read-only, block standard editing operations immediately
        if (this.isReadOnly) {
            // Allow Zoom shortcuts
            // Command/Ctrl + Plus/Equals to zoom in
            if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                this.zoomIn();
                return;
            }
            // Command/Ctrl + Minus to zoom out
            if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                this.zoomOut();
                return;
            }

            // Allow Space for Pan
            const isEditingText = this.diagramManager.isEditingText(); // Should be false in readonly but good check
            const target = e.target as HTMLElement;
            const isContentEditable = target?.isContentEditable ||
                target?.closest('[contenteditable="true"]') !== null ||
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA';

            if (e.code === 'Space' && !this.isSpacePressed && !isEditingText && !isContentEditable) {
                e.preventDefault();
                this.isSpacePressed = true;
                this.panTool.tempActivate();
                this.setPanKeyAttribute(true);
                this.updateCursorVisual();
                this.notifyCursorChange();
                return;
            }

            // Block everything else that might modify state (Undo/Redo, Copy/Paste, Delete, etc)
            // But active tool (Pan/Laser) might need keys?
            if (this.activeTool && (this.activeTool.name === 'Pan' || this.activeTool.name === 'LaserPointer')) {
                this.activeTool.handleKeyDown(e);
            }
            return;
        }

        // Check if user is editing text - if so, don't intercept spacebar
        const isEditingText = this.diagramManager.isEditingText();
        
        // Check if the event target is a contentEditable element or inside one
        const target = e.target as HTMLElement;
        const isContentEditable = target?.isContentEditable || 
                                  target?.closest('[contenteditable="true"]') !== null ||
                                  target?.tagName === 'INPUT' || 
                                  target?.tagName === 'TEXTAREA';
        
        // Space key temporarily activates pan tool (but not when editing text)
        if (e.code === 'Space' && !this.isSpacePressed && !isEditingText && !isContentEditable) {
            e.preventDefault();
            this.isSpacePressed = true;
            this.panTool.tempActivate();
            this.setPanKeyAttribute(true);
            this.updateCursorVisual();
            this.notifyCursorChange();
            return;
        }

        // Delegate to active tool
        if (this.activeTool) {
            this.activeTool.handleKeyDown(e);
        }
    }

    public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent) {
        // Check if user is editing text - if so, don't intercept spacebar
        const isEditingText = this.diagramManager.isEditingText();
        
        // Check if the event target is a contentEditable element or inside one
        const target = e.target as HTMLElement;
        const isContentEditable = target?.isContentEditable || 
                                  target?.closest('[contenteditable="true"]') !== null ||
                                  target?.tagName === 'INPUT' || 
                                  target?.tagName === 'TEXTAREA';
        
        // Space key deactivates temporary pan (but not when editing text)
        if (e.code === 'Space' && !isEditingText && !isContentEditable) {
            this.isSpacePressed = false;
            this.panTool.tempDeactivate();
            this.setPanKeyAttribute(false);
            this.updateCursorVisual();
            this.notifyCursorChange();
            return;
        }

        // Delegate to active tool
        if (this.activeTool) {
            this.activeTool.handleKeyUp(e);
        }
    }

    // Wheel handler - delegate to zoom tool (always available)
    public handleWheel(e: WheelEvent | React.WheelEvent) {
        // Zoom tool handles both zoom and wheel pan
        this.zoomTool.handleWheel(e);
    }

    // Pointer handlers - delegate to tools
    public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement) {
        // Track pointer
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Check for multi-touch gesture
        if (this.activePointers.size === 2) {
            if (e.pointerType === 'touch') {
                e.preventDefault();
            }
            const pointers = Array.from(this.activePointers.values());
            const p1 = this.getCanvasPoint(pointers[0].x, pointers[0].y);
            const p2 = this.getCanvasPoint(pointers[1].x, pointers[1].y);

            // Calculate distance between pointers
            const distance = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) +
                Math.pow(p2.y - p1.y, 2)
            );

            // Calculate midpoint relative to canvas
            const midpoint = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };

            this.gestureState = {
                startScale: this.scale,
                startTranslation: { ...this.translation },
                startDistance: distance,
                startMidpoint: midpoint
            };

            // Deactivate edge panning if active
            if (this.edgePanManager.isEdgePanning()) {
                this.edgePanManager.stop();
            }

            return; // Don't pass to tools if gesture started
        }

        // If gesture is already active (e.g. 3rd finger), prevent tool use
        if (this.gestureState) {
            return;
        }

        // Priority 1: Pan tool if space is pressed or middle mouse
        if (this.isSpacePressed || e.button === 1) {
            if (this.panTool.handlePointerDown(e, element)) {
                return;
            }
        }

        // Priority 2: Active tool
        if (this.activeTool) {
            if (this.activeTool.handlePointerDown(e, element)) {
                return;
            }
        }

        // Priority 3: Pan tool if it's selected
        if (this.panTool.isActive()) {
            this.panTool.handlePointerDown(e, element);
        }
    }

    public handlePointerMove(e: PointerEvent | React.PointerEvent) {
        // Update tracked pointer
        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        // Handle multi-touch gesture
        if (this.activePointers.size === 2 && this.gestureState) {
            if (e.pointerType === 'touch') {
                e.preventDefault();
            }
            const pointers = Array.from(this.activePointers.values());
            const p1 = this.getCanvasPoint(pointers[0].x, pointers[0].y);
            const p2 = this.getCanvasPoint(pointers[1].x, pointers[1].y);

            // Calculate new distance
            const distance = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) +
                Math.pow(p2.y - p1.y, 2)
            );

            // Calculate new midpoint
            const midpoint = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };

            const { startScale, startTranslation, startDistance, startMidpoint } = this.gestureState;

            // Calculate new scale
            // Use MAX_SCALE/MIN_SCALE from imports, but I need to make sure they are imported. 
            // They are imported at top of file.
            const rawScale = startScale * (distance / startDistance);
            const newScale = clamp(rawScale, MIN_SCALE, MAX_SCALE);

            // Calculate new translation to keep midpoint fixed relative to content
            // worldPoint = (startMidpoint - startTranslation) / startScale
            const worldX = (startMidpoint.x - startTranslation.x) / startScale;
            const worldY = (startMidpoint.y - startTranslation.y) / startScale;

            // newTranslation = newMidpoint - worldPoint * newScale
            const newTranslationX = midpoint.x - worldX * newScale;
            const newTranslationY = midpoint.y - worldY * newScale;

            this.scale = newScale;
            this.translation = { x: newTranslationX, y: newTranslationY };
            this.notifyStateChange();
            return;
        }

        // Check if pan tool is handling
        if (this.panTool.isPanningActive()) {
            this.panTool.handlePointerMove(e);
            return;
        }

        // Delegate to active tool
        if (this.activeTool) {
            this.activeTool.handlePointerMove(e);
        }
    }

    public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement) {
        // Cleanup pointer
        this.activePointers.delete(e.pointerId);

        // Terminate gesture if fewer than 2 fingers
        if (this.gestureState && this.activePointers.size < 2) {
            this.gestureState = null;
            return;
        }

        // If gesture was active, we don't pass to tools (handled by early return above)
        // However, if we had 3 fingers and lifted 1, gestureState is still non-null (if we kept it).
        // My logic keeps gestureState non-null only if < 2 fingers check fails? 
        // No, if size >= 2, gestureState remains. 
        // But my handlePointerMove only works if size === 2. 
        // So if I have 3 fingers, gestureState might be stale? 
        // Actually handlePointerDown prevents gesture start if > 2 fingers. 
        // No, handlePointerDown starts it at exactly 2.
        // If 3rd finger down, handlePointerDown returns early (gestureState exists).
        // handlePointerMove also checks size === 2. So with 3 fingers, zoom stops? 
        // That's fine for MVP.

        // Prevent tool usage if gesture is still technically active (even if paused by 3rd finger)
        if (this.gestureState) {
            return;
        }

        // Check if pan tool is handling
        if (this.panTool.isPanningActive()) {
            this.panTool.handlePointerUp(e, element);
            return;
        }

        // Delegate to active tool
        if (this.activeTool) {
            this.activeTool.handlePointerUp(e, element);
        }
    }

    public handlePointerCancel(e: PointerEvent | React.PointerEvent) {
        this.activePointers.delete(e.pointerId);
        if (this.activePointers.size < 2) {
            this.gestureState = null;
        }
    }

    // Programmatic zoom controls
    public zoomToScaleAtCenter(nextScale: number) {
        const svg = this.svgRef?.current;
        const container = this.containerRef?.current;
        if (!svg || !container) {
            this.scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
            this.notifyStateChange();
            return;
        }

        const svgRect = svg.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const viewportCenterClientX = containerRect.left + containerRect.width / 2;
        const viewportCenterClientY = containerRect.top + containerRect.height / 2;
        const pointerX = viewportCenterClientX - svgRect.left;
        const pointerY = viewportCenterClientY - svgRect.top;

        const clampedNextScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        const worldX = (pointerX - this.translation.x) / this.scale;
        const worldY = (pointerY - this.translation.y) / this.scale;
        const nextTranslationX = pointerX - worldX * clampedNextScale;
        const nextTranslationY = pointerY - worldY * clampedNextScale;

        this.scale = clampedNextScale;
        this.translation = { x: nextTranslationX, y: nextTranslationY };
        this.notifyStateChange();
    }

    public zoomIn() {
        this.zoomToScaleAtCenter(this.scale * 1.2);
    }

    public zoomOut() {
        this.zoomToScaleAtCenter(this.scale / 1.2);
    }

    // Collaboration methods
    public enableCollaboration(wsUrl: string, diagramId: string, displayName: string): void {
        if (this.collaborationManager) {
            this.collaborationManager.disconnect();
        }

        this.collaborationManager = new CollaborationManager(wsUrl);

        // Listen to collaboration events
        this.collaborationManager.on('presence-update', () => {
            if (this.onCollaborationChange) {
                this.onCollaborationChange(this.collaborationManager!.getRemoteUsers());
            }
        });

        this.collaborationManager.on('user-joined', () => {
            if (this.onCollaborationChange) {
                this.onCollaborationChange(this.collaborationManager!.getRemoteUsers());
            }
        });

        this.collaborationManager.on('user-left', () => {
            if (this.onCollaborationChange) {
                this.onCollaborationChange(this.collaborationManager!.getRemoteUsers());
            }
        });

        this.collaborationManager.on('connected', () => {
            if (this.onCollaborationChange) {
                this.onCollaborationChange(this.collaborationManager!.getRemoteUsers());
            }
        });

        // Connect to collaboration service
        this.collaborationManager.connect(diagramId, displayName);
    }

    public disableCollaboration(): void {
        if (this.collaborationManager) {
            this.collaborationManager.disconnect();
            this.collaborationManager = null;
        }
    }

    public setOnCollaborationChange(callback: (users: UserPresence[]) => void): void {
        this.onCollaborationChange = callback;
    }

    public getRemoteUsers(): UserPresence[] {
        if (!this.collaborationManager) return [];
        return this.collaborationManager.getRemoteUsers();
    }

    public updateCursorPosition(canvasX: number, canvasY: number): void {
        if (this.collaborationManager) {
            // Convert screen coordinates to canvas coordinates
            const worldX = (canvasX - this.translation.x) / this.scale;
            const worldY = (canvasY - this.translation.y) / this.scale;
            this.collaborationManager.updateCursor(worldX, worldY);
        }
    }

    public resetZoom() {
        this.zoomToScaleAtCenter(1);
    }

    public setZoom(scale: number) {
        this.zoomToScaleAtCenter(scale);
    }

    public fitToScreen() {
        // Reset to scale 1 and center the view
        // This is a simple implementation - could be enhanced to fit content
        this.scale = 1;
        this.translation = { x: 0, y: 0 };
        this.notifyStateChange();
    }

    // Pan canvas by an offset (for arrow key scrolling)
    public panByOffset(deltaX: number, deltaY: number): void {
        this.translation = {
            x: this.translation.x + deltaX,
            y: this.translation.y + deltaY
        };
        this.notifyStateChange();
    }

    public isContentInView(): boolean {
        const container = this.containerRef?.current;
        if (!container) return false;

        const shapes = this.diagramManager.getShapes();
        if (shapes.length === 0) return false;

        // Use container dimensions (visible viewport), not SVG dimensions
        const rect = container.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        // Check if any shape is visible in the viewport
        for (const shape of shapes) {
            // Transform shape coordinates to screen space
            const screenX = shape.layout.x * this.scale + this.translation.x;
            const screenY = shape.layout.y * this.scale + this.translation.y;
            const screenWidth = shape.layout.width * this.scale;
            const screenHeight = shape.layout.height * this.scale;

            // Check if shape intersects with viewport
            const isVisible = 
                screenX + screenWidth > 0 &&
                screenX < viewportWidth &&
                screenY + screenHeight > 0 &&
                screenY < viewportHeight;

            if (isVisible) return true;
        }

        return false;
    }

    private scrollToContentRetryCount: number = 0;
    private readonly MAX_SCROLL_RETRIES = 10;

    public scrollToContent() {
        const container = this.containerRef?.current;
        if (!container) return;

        const shapes = this.diagramManager.getShapes();
        if (shapes.length === 0) return;

        // Check if container has valid dimensions
        const rect = container.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) {
            // Container not properly laid out yet, retry after next frame
            if (this.scrollToContentRetryCount < this.MAX_SCROLL_RETRIES) {
                this.scrollToContentRetryCount++;
                requestAnimationFrame(() => this.scrollToContent());
            } else {
                // Reset retry count for future calls
                this.scrollToContentRetryCount = 0;
                console.warn('scrollToContent: Container dimensions still invalid after max retries');
            }
            return;
        }

        // Reset retry count on successful execution
        this.scrollToContentRetryCount = 0;

        // Filter out connectors and find the last updated shape
        const nonConnectorShapes = shapes.filter(shape => shape.type !== 'connector');
        
        if (nonConnectorShapes.length === 0) {
            // If no non-connector shapes, fall back to first shape (or do nothing)
            return;
        }

        // Find the shape with the most recent lastUpdated timestamp
        const lastUpdatedShape = nonConnectorShapes.reduce((latest, shape) => {
            return shape.state.lastUpdated > latest.state.lastUpdated ? shape : latest;
        }, nonConnectorShapes[0]);

        // Calculate the center of the last updated shape in world coordinates
        const contentCenterX = lastUpdatedShape.layout.x + lastUpdatedShape.layout.width / 2;
        const contentCenterY = lastUpdatedShape.layout.y + lastUpdatedShape.layout.height / 2;

        // Use container dimensions (visible viewport), not SVG dimensions
        const viewportCenterX = rect.width / 2;
        const viewportCenterY = rect.height / 2;

        // Calculate new translation to center the content
        // For transform="translate(tx, ty) scale(s)", screen position = world * scale + translation
        // We want: contentCenterWorld * scale + translation = viewportCenter
        // Therefore: translation = viewportCenter - contentCenterWorld * scale
        this.translation = {
            x: viewportCenterX - contentCenterX * this.scale,
            y: viewportCenterY - contentCenterY * this.scale
        };

        this.notifyStateChange();
    }

    // Get computed values for rendering
    public getContentTransform(): string {
        return `translate(${this.translation.x} ${this.translation.y}) scale(${this.scale})`;
    }

    public getPatternTransform(): string {
        return `translate(${this.translation.x} ${this.translation.y}) scale(${this.scale})`;
    }

    public getContentStrokeWidth(): number {
        // Stroke scales with zoom, but never less than 2px on screen
        return Math.max(2 / this.scale, 2);
    }

    public getCursorStyle(): string {
        // If pan tool is actively panning
        if (this.panTool.isPanningActive()) return 'grabbing';
        
        // If space is pressed (pan tool temp active)
        if (this.isSpacePressed) return 'grab';
        
        // If pan tool is the active tool
        if (this.activeTool === this.panTool) return 'grab';
        
        // If draw tool is active
        if (this.activeTool === this.drawingTool) return 'crosshair';

        // If connector tool is active
        if (this.activeTool === this.connectorTool) return 'crosshair';

        // If select tool is active
        if (this.activeTool === this.selectTool) return 'default';
        
        // Default cursor
        return 'default';
    }

    // Get diagram manager
    public getDiagramManager(): DiagramManager {
        return this.diagramManager;
    }



    // Drawing tool methods
    public setDrawingShapeType(shapeType: ShapeName): void {
        this.drawingTool.setShapeType(shapeType);
    }

    public getDrawingShapeType(): ShapeName {
        return this.drawingTool.getShapeType();
    }

    public setPendingImage(url: string | null, name?: string | null, squareIcon: boolean = false): void {
        this.drawingTool.setPendingImage(url, name, squareIcon);
    }

    public setConnectorType(type: ConnectorType): void {
        this.connectorTool.setConnectorType(type);
    }

    public setMarkerType(type: FreehandMarkerType): void {
        this.pencilTool.setMarkerType(type);
    }

    public getMarkerType(): FreehandMarkerType {
        return this.pencilTool.getMarkerType();
    }

    public getLaserPointerTool(): LaserPointerTool {
        return this.laserPointerTool;
    }

    // Set up event listeners for interrupted interactions
    private setupInterruptionHandlers() {
        // Handle context menu (right-click)
        this.handleContextMenu = this.handleContextMenu.bind(this);
        window.addEventListener('contextmenu', this.handleContextMenu);

        // Handle window blur (focus loss)
        this.handleBlur = this.handleBlur.bind(this);
        window.addEventListener('blur', this.handleBlur);

        // Handle visibility change (tab hidden)
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Clean up interruption handlers
    private cleanupInterruptionHandlers() {
        window.removeEventListener('contextmenu', this.handleContextMenu);
        window.removeEventListener('blur', this.handleBlur);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Handle context menu (right-click) - cancel ongoing interactions
    private handleContextMenu = (_e: MouseEvent) => {
        this.cancelAllInteractions();
    };

    // Handle blur (focus loss) - cancel ongoing interactions
    private handleBlur = (_e: FocusEvent) => {
        this.cancelAllInteractions();
    };

    // Handle visibility change (tab hidden) - cancel ongoing interactions
    private handleVisibilityChange = (_e: Event) => {
        if (document.hidden) {
            this.cancelAllInteractions();
        }
    };

    // Cancel all ongoing interactions in all tools
    public cancelAllInteractions() {
        // Clear multi-touch state
        this.activePointers.clear();
        this.gestureState = null;

        // Cancel interaction in active tool
        if (this.activeTool) {
            this.activeTool.cancelInteraction();
        }

        // Also cancel in built-in tools that might be temporarily active
        this.panTool.cancelInteraction();
        this.selectTool.cancelInteraction();
        this.drawingTool.cancelInteraction();
        this.pencilTool.cancelInteraction();

        // Release any pointer captures
        if (this.containerRef?.current) {
            try {
                this.containerRef.current.releasePointerCapture(1);
            } catch {
                // ignore
            }
        }
    }

    // Clipboard operations
    public async loadDiagram(): Promise<{ success: boolean, name?: string }> {
        const result = await this.storageManager.load();
        if (result.success) {
            // Clear history and record new initial state after loading
            // This happens after isLoading flag is cleared, so it won't trigger a save
            this.historyManager.clear();
            this.historyManager.recordState();

            this.notifyShapesChange();
            this.notifyStateChange();
            
            // Scroll to content after shapes are loaded
            // Use requestAnimationFrame to ensure DOM is ready before scrolling
            requestAnimationFrame(() => {
                this.scrollToContent();
            });
        }
        return result;
    }

    public async copy(): Promise<boolean> {
        return await this.clipboardManager.copy();
    }

    public async cut(): Promise<boolean> {
        const result = await this.clipboardManager.cut();
        
        if (result) {
            // Always deselect and hide selection overlay after cut
            this.diagramManager.deselectAllShapes();
            this.diagramManager.hideSelectionOverlay();
            
            // Record history AFTER cutting (records the result state)
            this.recordHistory();
            
            if (this.onShapesChange) {
                this.onShapesChange();
            }
        }
        return result;
    }

    public async paste(cursorX?: number, cursorY?: number): Promise<boolean> {
        const result = await this.clipboardManager.paste(cursorX, cursorY);
        if (result) {
            this.recordHistory();
            if (this.onShapesChange) {
                this.onShapesChange();
            }
        }
        return result;
    }

    public hasClipboardData(): boolean {
        return this.clipboardManager.hasClipboardData();
    }

    public deleteSelectedShapes(): boolean {
        const selectedShapes = this.diagramManager.getSelectedShapes();
        if (selectedShapes.length === 0) return false;

        // Remove the shapes
        selectedShapes.forEach(shape => {
            this.diagramManager.removeShape(shape);
        });

        // Always deselect and hide selection overlay after deletion
        this.diagramManager.deselectAllShapes();
        this.diagramManager.hideSelectionOverlay();

        // Record history AFTER deleting (records the result state)
        this.recordHistory();

        if (this.onShapesChange) {
            this.onShapesChange();
        }

        return true;
    }

    public bringToFront(): boolean {
        const selectedShapes = this.diagramManager.getSelectedShapes();
        if (selectedShapes.length === 0) return false;

        this.diagramManager.bringToFront();
        this.recordHistory();

        if (this.onShapesChange) {
            this.onShapesChange();
        }

        return true;
    }

    public sendToBack(): boolean {
        const selectedShapes = this.diagramManager.getSelectedShapes();
        if (selectedShapes.length === 0) return false;

        this.diagramManager.sendToBack();
        this.recordHistory();

        if (this.onShapesChange) {
            this.onShapesChange();
        }

        return true;
    }

    // Move selected shapes by an offset (for arrow key movement)
    public moveSelectedShapesByOffset(deltaX: number, deltaY: number): boolean {
        const selectedShapes = this.diagramManager.getSelectedShapes();
        if (selectedShapes.length === 0) return false;

        // Move each shape by the offset
        selectedShapes.forEach(shape => {
            const newX = shape.layout.x + deltaX;
            const newY = shape.layout.y + deltaY;
            this.diagramManager.moveShapeSnapped(shape, newX, newY);
            this.diagramManager.updateShapeText(shape);
        });

        // Handle frame auto-attach/detach for non-frame shapes (same as DragTool.endDrag)
        selectedShapes.forEach(shape => {
            if (shape.type !== 'connector' && shape.type !== 'frame') {
                // Check if shape should be detached from current frame
                this.diagramManager.detachIfOutside(shape);
                // If not in a frame, check if it should be auto-attached
                if (!shape.parentId) {
                    this.diagramManager.autoAssignToFrame(shape);
                }
            } else if (shape.type === 'frame') {
                // Frame was moved - shapes may enter or leave it
                this.diagramManager.updateAllFrameContainments();
            }
        });

        // Update selection overlay
        this.diagramManager.updateSelectionOverlay();
        
        // Record history
        this.recordHistory();

        if (this.onShapesChange) {
            this.onShapesChange();
        }

        return true;
    }

    // Undo/Redo operations
    public undo(): boolean {
        const result = this.historyManager.undo();
        if (result) {
            // Save the restored state to storage
            this.storageManager.save().catch(err => {
                console.error('Failed to save after undo:', err);
            });
            
            if (this.onShapesChange) {
                this.onShapesChange();
            }
        }
        return result;
    }

    public redo(): boolean {
        const result = this.historyManager.redo();
        if (result) {
            // Save the restored state to storage
            this.storageManager.save().catch(err => {
                console.error('Failed to save after redo:', err);
            });
            
            if (this.onShapesChange) {
                this.onShapesChange();
            }
        }
        return result;
    }

    public canUndo(): boolean {
        return this.historyManager.canUndo();
    }

    public canRedo(): boolean {
        return this.historyManager.canRedo();
    }

    // Record initial state (call this after canvas is initialized with shapes)
    public recordInitialState(): void {
        this.historyManager.recordState();
    }

    // Public method for tools to record history
    public recordHistoryState(): void {
        this.recordHistory();
    }

    // Storage operations
    public async saveDiagram(): Promise<boolean> {
        return await this.storageManager.save();
    }



    public async hasSavedDiagram(): Promise<boolean> {
        return await this.storageManager.hasData();
    }

    public getStorageManager(): StorageManager {
        return this.storageManager;
    }

    public enableAutoSave(intervalMs?: number): void {
        this.storageManager.enableAutoSave(intervalMs);
    }

    public disableAutoSave(): void {
        this.storageManager.disableAutoSave();
    }

    public isAutoSaveEnabled(): boolean {
        return this.storageManager.isAutoSaveEnabled();
    }

    // Image export operations
    public getImageExportManager(): ImageExportManager | null {
        return this.imageExportManager;
    }

    // Style operations
    public setSelectedShapesFillColor(color: string): void {
        this.diagramManager.setSelectedShapesFill(color);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesStrokeColor(color: string): void {
        this.diagramManager.setSelectedShapesStroke(color);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesStrokeStyle(style: 'solid' | 'dashed' | 'dotted' | 'none'): void {
        this.diagramManager.setSelectedShapesStrokeStyle(style);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesStrokeDrawStyle(style: 'standard' | 'handdrawn'): void {
        this.diagramManager.setStrokeDrawStyle(style);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesFillDrawStyle(style: 'standard' | 'handdrawn'): void {
        this.diagramManager.setFillDrawStyle(style);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesStrokeWidth(width: number, skipHistory: boolean = false): void {
        this.diagramManager.setSelectedShapesStrokeWidth(width);
        if (!skipHistory) {
            this.recordHistory();
        }
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesStrokeOpacity(opacity: number, skipHistory: boolean = false): void {
        this.diagramManager.setSelectedShapesStrokeOpacity(opacity);
        if (!skipHistory) {
            this.recordHistory();
        }
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesFillStyle(style: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none'): void {
        this.diagramManager.setSelectedShapesFillStyle(style);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesFillOpacity(opacity: number, skipHistory: boolean = false): void {
        this.diagramManager.setSelectedShapesFillOpacity(opacity);
        if (!skipHistory) {
            this.recordHistory();
        }
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesFontSize(size: number): void {
        this.diagramManager.setSelectedShapesFontSize(size);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesFontFamily(family: string): void {
        this.diagramManager.setSelectedShapesFontFamily(family);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }



    public toggleSelectedShapesFontWeight(): void {
        this.diagramManager.toggleSelectedShapesFontWeight();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public toggleSelectedShapesFontStyle(): void {
        this.diagramManager.toggleSelectedShapesFontStyle();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public toggleSelectedShapesTextDecoration(format: 'underline' | 'line-through'): void {
        this.diagramManager.toggleSelectedShapesTextDecoration(format);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public toggleSelectedShapesList(type: 'ordered' | 'unordered'): void {
        this.diagramManager.toggleSelectedShapesList(type);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesTextDecoration(decoration: 'none' | 'underline' | 'line-through'): void {
        this.diagramManager.setSelectedShapesTextDecoration(decoration);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesTextAlign(align: 'left' | 'center' | 'right'): void {
        this.diagramManager.setSelectedShapesTextAlign(align);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesTextJustify(justify: 'top' | 'middle' | 'bottom'): void {
        this.diagramManager.setSelectedShapesTextJustify(justify);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesTextColor(color: string): void {
        this.diagramManager.setSelectedShapesTextColor(color);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public convertSelectedShapesType(shapeType: ShapeName): void {
        this.diagramManager.convertSelectedShapesType(shapeType);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedShapesType(shapeType: ShapeName): void {
        this.diagramManager.setSelectedShapesType(shapeType);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    // Freehand shape specific styling methods
    public setSelectedFreehandShapesMarkerType(markerType: FreehandMarkerType): void {
        this.diagramManager.setSelectedFreehandShapesMarkerType(markerType);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedFreehandShapesStrokeColor(color: string): void {
        this.diagramManager.setSelectedFreehandShapesStroke(color);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedFreehandShapesStrokeWidth(width: number, skipHistory: boolean = false): void {
        this.diagramManager.setSelectedFreehandShapesStrokeWidth(width);
        if (!skipHistory) {
            this.recordHistory();
        }
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedFreehandShapesStrokeOpacity(opacity: number, skipHistory: boolean = false): void {
        this.diagramManager.setSelectedFreehandShapesStrokeOpacity(opacity);
        if (!skipHistory) {
            this.recordHistory();
        }
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedConnectorsType(connectorType: ConnectorType): void {
        this.diagramManager.setSelectedConnectorsType(connectorType, this.scale);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedConnectorsStartArrowhead(arrowheadType: ArrowheadType): void {
        this.diagramManager.setSelectedConnectorsStartArrowhead(arrowheadType);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public setSelectedConnectorsEndArrowhead(arrowheadType: ArrowheadType): void {
        this.diagramManager.setSelectedConnectorsEndArrowhead(arrowheadType);
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    // === Shape Alignment Methods ===

    public alignLeft(): void {
        this.diagramManager.alignSelectedShapesLeft();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public alignCenter(): void {
        this.diagramManager.alignSelectedShapesCenter();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public alignRight(): void {
        this.diagramManager.alignSelectedShapesRight();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public alignTop(): void {
        this.diagramManager.alignSelectedShapesTop();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public alignMiddle(): void {
        this.diagramManager.alignSelectedShapesMiddle();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public alignBottom(): void {
        this.diagramManager.alignSelectedShapesBottom();
        this.recordHistory();
        if (this.onShapesChange) {
            this.onShapesChange();
        }
    }

    public isShapeDragging(): boolean {
        return this.selectTool.isShapeDragging();
    }

    // Cleanup
    public destroy() {
        this.cleanupInterruptionHandlers();
        this.storageManager.destroy();
        this.containerRef = null;
        this.svgRef = null;
        this.contentLayerRef = null;
        this.onStateChange = null;
        this.onCursorChange = null;
        this.onShapesChange = null;
        this.onToolChange = null;
    }
}