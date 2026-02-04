import { DiagramTool } from './base';
import { DrawingTool } from './DrawingTool';

/**
 * ImageTool handles uploading images and passing them to DrawingTool
 */
export class ImageTool extends DiagramTool {
  private drawingTool: DrawingTool | null = null;
  private fileInput: HTMLInputElement | null = null;
  private onToolChange: ((tool: string) => void) | null = null;

  constructor(
    onToolChange?: (tool: string) => void,
    drawingTool?: DrawingTool
  ) {
    super('Image', 'image');
    this.onToolChange = onToolChange || null;
    this.drawingTool = drawingTool || null;
    
    // Create hidden file input
    if (typeof document !== 'undefined') {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = 'image/*';
      this.fileInput.style.display = 'none';
      document.body.appendChild(this.fileInput);
      
      this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }
  }

  public setCallbacks(
    onToolChange: (tool: string) => void,
    drawingTool?: DrawingTool
  ) {
    this.onToolChange = onToolChange;
    if (drawingTool) this.drawingTool = drawingTool;
  }

  protected onActivate(): void {
    // Trigger file input when tool is activated
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  protected onDeactivate(): void {
    // Nothing to clean up - DrawingTool handles everything
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && this.drawingTool) {
          // Set the pending image on DrawingTool with "Image" as the name
          this.drawingTool.setPendingImage(result, 'Image');
          
          // Switch to DrawingTool so user can draw the image
          if (this.onToolChange) {
            this.onToolChange('Draw');
          }
        }
      };
      
      reader.readAsDataURL(file);
    }
    
    // Reset input value so same file can be selected again
    if (input) {
      input.value = '';
    }
  }

  public handlePointerDown(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // ImageTool doesn't handle pointer events - DrawingTool does
    return false;
  }

  public handlePointerMove(e: PointerEvent | React.PointerEvent): boolean {
    // ImageTool doesn't handle pointer events - DrawingTool does
    return false;
  }

  public handlePointerUp(e: PointerEvent | React.PointerEvent, element: HTMLElement): boolean {
    // ImageTool doesn't handle pointer events - DrawingTool does
    return false;
  }

  public handleWheel(e: WheelEvent | React.WheelEvent): boolean { return false; }

  public handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
    // ImageTool doesn't handle keyboard events
    return false;
  }

  public handleKeyUp(e: KeyboardEvent | React.KeyboardEvent): boolean {
    return false;
  }

  public cancelInteraction(): void {
    // Nothing to cancel - DrawingTool handles interactions
  }
}
