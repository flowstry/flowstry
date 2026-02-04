import { DiagramManager } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { DiagramTool } from './base';

/**
 * TextEditTool handles text editing interactions
 */
export class TextEditTool extends DiagramTool {
  private diagramManager: DiagramManager;
  private onTextEditingChange: (() => void) | null = null;
  private onRefocusContainer: (() => void) | null = null;

  constructor(
    diagramManager: DiagramManager,
    onTextEditingChange?: () => void
  ) {
    super('TextEdit', 'text');
    this.diagramManager = diagramManager;
    this.onTextEditingChange = onTextEditingChange || null;
  }

  public setCallbacks(
    onTextEditingChange: () => void
  ) {
    this.onTextEditingChange = onTextEditingChange;
  }

  public setRefocusCallback(onRefocusContainer: () => void) {
    this.onRefocusContainer = onRefocusContainer;
  }

  protected onDeactivate(): void {
    // Stop text editing when tool is deactivated
    if (this.diagramManager.isEditingText()) {
      this.diagramManager.stopTextEditing();
    }
  }

  /**
   * Start text editing on a shape
   * @param shape - The shape to edit
   * @param triggeredByClick - Whether editing was triggered by click (true) or keyboard (false)
   * @param clickPosition - Optional click position for cursor placement (screen coordinates)
   */
  public startTextEditing(shape: DiagramShape, triggeredByClick: boolean = false, clickPosition?: { x: number; y: number }): void {
    shape.state.editingTriggeredByClick = triggeredByClick;
    shape.state.editingClickPosition = clickPosition;
    this.diagramManager.startTextEditing(shape);
    
    if (this.onTextEditingChange) {
      this.onTextEditingChange();
    }
  }

  /**
   * Stop text editing
   */
  public stopTextEditing(): void {
    if (this.diagramManager.isEditingText()) {
      this.diagramManager.stopTextEditing();
      
      // Refocus the canvas container so it can receive keyboard events again
      if (this.onRefocusContainer) {
        // Use a small timeout to ensure this happens after the blur event from the text element
        setTimeout(() => {
          this.onRefocusContainer?.();
        }, 0);
      }
      
      if (this.onTextEditingChange) {
        this.onTextEditingChange();
      }
    }
  }

  /**
   * Check if currently editing text
   */
  public isEditingText(): boolean {
    return this.diagramManager.isEditingText();
  }

  /**
   * Get the shape currently being edited
   */
  public getEditingShape(): DiagramShape | null {
    return this.diagramManager.getEditingShape();
  }

  /**
   * Check if we should start text editing on a shape
   * (double-click or second click on already selected shape)
   */
  public shouldStartTextEditing(shape: DiagramShape, wasAlreadySelected: boolean): boolean {
    const selectedShapes = this.diagramManager.getSelectedShapes();
    
    // Start text editing if:
    // 1. The clicked shape WAS already selected (second click, not first)
    // 2. The clicked shape is selected
    // 3. Only one shape is selected
    // 4. The clicked shape is that one selected shape
    // 5. Not already editing text
    return (
      wasAlreadySelected &&
      shape.state.selected && 
      selectedShapes.length === 1 && 
      selectedShapes[0] === shape &&
      !this.diagramManager.isEditingText()
    );
  }

  /**
   * Check if clicking outside the text editor
   */
  public isClickingOutsideEditor(e: PointerEvent | React.PointerEvent): boolean {
    const target = e.target as HTMLElement;
    return !target.closest('[data-text-editor]');
  }

  // Default event handlers (this tool is typically used programmatically by SelectTool)
  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    return false;
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    return false;
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    return false;
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean {
    return false;
  }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // Check if we're currently editing text
    const isEditing = this.diagramManager.isEditingText();
    
    // Handle ESC to stop text editing
    if (e.key === 'Escape' && isEditing) {
      e.preventDefault();
      this.stopTextEditing();
      return true;
    }
    
    // Handle Command/Ctrl + Enter to stop text editing
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isEditing) {
      e.preventDefault();
      this.stopTextEditing();
      return true;
    }
    
    // Handle Enter to start text editing on selected shape (only if not already editing)
    if (e.key === 'Enter' && !isEditing) {
      const selectedShapes = this.diagramManager.getSelectedShapes();
      
      // Start text editing if exactly one shape is selected and not already editing
      if (selectedShapes.length === 1) {
        e.preventDefault();
        // Triggered by keyboard (Enter) - select all text
        this.startTextEditing(selectedShapes[0], false);
        return true;
      }
    }

    return false;
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false;
  }
}

