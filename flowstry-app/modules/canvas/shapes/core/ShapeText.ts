
import { ShapeAppearance } from './ShapeAppearance';
import { ShapeLayout } from './ShapeLayout';

export class ShapeText {
  constructor(
    private layout: ShapeLayout,
    private appearance: ShapeAppearance,
    private shape: { 
      element: SVGGElement,
      textElement: SVGForeignObjectElement | null,
      text: string,
      type: string // Added to access type for timestamp updates if needed, though mostly using layout/appearance
    }
  ) {
    this.textAreaWidth = 1
    this.textAreaHeight = 1
  }

  // Text area dimensions
  public textAreaWidth: number
  public textAreaHeight: number

  /**
   * Update text area dimensions
   */
  updateDimensions(width: number, height: number) {
    this.textAreaWidth = width
    this.textAreaHeight = height
  }

  // Custom position calculator for shapes with non-centered text (e.g. Frame)
  public positionCalculator: (() => { x: number; y: number }) | null = null;

  /**
   * Get text position (center of text area)
   */
  getPosition(): { x: number; y: number } {
    if (this.positionCalculator) {
      return this.positionCalculator();
    }
    // Default to center of layout
    return {
      x: this.layout.x + this.layout.width / 2,
      y: this.layout.y + this.layout.height / 2
    }
  }

  // Custom bounds calculator
  public boundsCalculator: (() => { width: number; height: number }) | null = null;

  /**
   * Get bounds available for text
   */
  getBounds(): { width: number; height: number } {
    if (this.boundsCalculator) {
      return this.boundsCalculator();
    }
    return {
      width: Math.max(1, this.textAreaWidth),
      height: Math.max(1, this.textAreaHeight)
    }
  }

  /**
   * Adjust shape dimensions to fit text content
   * @param anchorHandle - Handle being dragged, determining which side is anchored
   */
  fitToText(anchorHandle?: string | null): boolean {
    if (!this.shape.text || !this.shape.text.trim()) {
      return false
    }
    
    // Padding in world coordinates (consistent regardless of zoom)
    const padding = 16
    const minSize = 30
    
    // Determine which axes to resize based on handle
    const isHorizontalHandle = anchorHandle === 'e' || anchorHandle === 'w'
    const isVerticalHandle = anchorHandle === 'n' || anchorHandle === 's'
    
    let newWidth = this.layout.width
    let newHeight = this.layout.height
    
    if (isVerticalHandle) {
      const textBoundsAtCurrentWidth = this.measureActualTextBounds(this.layout.width)
      if (!textBoundsAtCurrentWidth) {
        return false
      }
      newHeight = Math.max(minSize, textBoundsAtCurrentWidth.height + padding * 2)
      
    } else if (isHorizontalHandle) {
      const textBoundsUnconstrained = this.measureActualTextBounds()
      if (!textBoundsUnconstrained) {
        return false
      }
      newWidth = Math.max(minSize, textBoundsUnconstrained.width + padding * 2)

      const textBoundsAtNewWidth = this.measureActualTextBounds(newWidth)
      if (textBoundsAtNewWidth) {
        newHeight = Math.max(minSize, textBoundsAtNewWidth.height + padding * 2)
      }
      
    } else {
      const textBounds = this.measureActualTextBounds()
      if (!textBounds) {
        return false
      }
      newWidth = Math.max(minSize, textBounds.width + padding * 2)
      newHeight = Math.max(minSize, textBounds.height + padding * 2)
    }

    // Calculate new position based on anchor handle
    let newX = this.layout.x
    let newY = this.layout.y
    
    const widthDiff = newWidth - this.layout.width
    const heightDiff = newHeight - this.layout.height
    
    switch (anchorHandle) {
      case 'nw':
        // Anchor bottom-right corner (resize both)
        newX = this.layout.x - widthDiff
        newY = this.layout.y - heightDiff
        break
      case 'n':
        // Anchor bottom edge (resize height only)
        newY = this.layout.y - heightDiff
        break
      case 'ne':
        // Anchor bottom-left corner (resize both)
        newY = this.layout.y - heightDiff
        break
      case 'w':
        // Anchor right edge (resize width, height follows)
        newX = this.layout.x - widthDiff
        newY = this.layout.y - heightDiff / 2 // Center vertically for height change
        break
      case 'e':
        // Anchor left edge (resize width, height follows)
        newY = this.layout.y - heightDiff / 2 // Center vertically for height change
        break
      case 'sw':
        // Anchor top-right corner (resize both)
        newX = this.layout.x - widthDiff
        break
      case 's':
        // Anchor top edge (resize height only)
        // newY stays the same
        break
      case 'se':
        // Anchor top-left corner (resize both)
        // newX and newY stay the same
        break
      default:
        // Anchor center (resize both)
        newX = this.layout.x - widthDiff / 2
        newY = this.layout.y - heightDiff / 2
        break
    }

    this.layout.resize(newX, newY, newWidth, newHeight)

    // Update text area dimensions to match new layout (assuming fitToText implies filling the shape)
    // Note: If a shape has constraints (like diamond), fitToText might need to respect that ratio?
    // For now, mirroring DiagramShape's original behavior which set textAreaWidth = layout.width
    this.textAreaWidth = newWidth
    this.textAreaHeight = newHeight

    return true
  }

  /**
   * Measure the actual rendered text bounding box
   * @param atWidth - Optional width to measure text at (for calculating height with text wrap)
   *                  If not provided, measures at unconstrained width
   * Returns the actual size of the text content in world coordinates
   */
  measureActualTextBounds(atWidth?: number): { width: number; height: number } | null {
    if (!this.shape.textElement || !this.shape.text) {
      return null;
    }

    // Get the text-block div inside the foreignObject
    const wrapper = this.shape.textElement.querySelector('.wrapper') as HTMLDivElement;
    if (!wrapper) {
      return null;
    }

    const textBlock = wrapper.querySelector('.text-block') as HTMLDivElement;
    if (!textBlock) {
      return null;
    }

    // Get the scale factor BEFORE modifying the foreignObject
    // We need to convert from CSS pixels to SVG user units
    // Note: We use shape.element because shape.textElement might not be attached or ownerSVGElement logic
    const svg = this.shape.element.ownerSVGElement;
    if (!svg) return null;

    // Get the current foreignObject dimensions in SVG user units
    const foreignObjectSvgWidth = parseFloat(this.shape.textElement.getAttribute('width') || '0');
    const foreignObjectSvgHeight = parseFloat(this.shape.textElement.getAttribute('height') || '0');

    // Get the current screen size of the foreignObject (before modification)
    const foreignObjectRect = this.shape.textElement.getBoundingClientRect();
    const foreignObjectScreenWidth = foreignObjectRect.width;
    const foreignObjectScreenHeight = foreignObjectRect.height;

    // Calculate scale factor: SVG user units per CSS pixel
    // If foreignObject has no size, fall back to using CTM
    let scaleX = 1;
    let scaleY = 1;

    if (foreignObjectScreenWidth > 0 && foreignObjectScreenHeight > 0) {
      scaleX = foreignObjectSvgWidth / foreignObjectScreenWidth;
      scaleY = foreignObjectSvgHeight / foreignObjectScreenHeight;
    } else {
      // Fallback: use CTM if foreignObject has no screen size
      const ctm = this.shape.textElement.getScreenCTM();
      if (ctm) {
        scaleX = 1 / ctm.a;
        scaleY = 1 / ctm.d;
      }
    }

    // Temporarily remove width/height constraints to measure actual text size
    // Store original styles
    const originalDisplay = textBlock.style.display;
    const originalOverflow = textBlock.style.overflow;
    const originalWidth = textBlock.style.width;
    const originalHeight = textBlock.style.height;
    const originalWebkitLineClamp = textBlock.style.webkitLineClamp;

    // Set to block display with no constraints to measure full content
    textBlock.style.display = 'block';
    textBlock.style.overflow = 'visible';
    textBlock.style.height = 'auto';
    textBlock.style.webkitLineClamp = 'unset';

    // Also temporarily expand the foreignObject to allow full measurement
    const originalForeignWidth = this.shape.textElement.getAttribute('width');
    const originalForeignHeight = this.shape.textElement.getAttribute('height');
    this.shape.textElement.setAttribute('height', '10000');

    // If atWidth is specified, constrain the width to measure wrapped text height
    // Otherwise, use auto width to get natural text width
    if (atWidth !== undefined && atWidth > 0) {
      // Measure at specific width (for height calculation with text wrap)
      // atWidth is in world coordinates, convert to CSS pixels for the textBlock
      const padding = 16; // World coordinate padding
      const textAreaWidth = atWidth - padding * 2;
      // Convert world coordinates to CSS pixels: divide by scaleX
      const textAreaWidthPx = textAreaWidth / scaleX;
      textBlock.style.width = `${Math.max(1, textAreaWidthPx)}px`;
      this.shape.textElement.setAttribute('width', String(atWidth));
    } else {
      // Measure at unconstrained width
      textBlock.style.width = 'auto';
      this.shape.textElement.setAttribute('width', '10000');
    }

    // Force a reflow to ensure measurements are accurate
    void textBlock.offsetWidth;
    void textBlock.offsetHeight;

    // Get the actual rendered size of the text
    // Use scrollWidth/scrollHeight to get the full content size
    const textWidth = textBlock.scrollWidth;
    const textHeight = textBlock.scrollHeight;

    // Restore original styles
    textBlock.style.display = originalDisplay;
    textBlock.style.overflow = originalOverflow;
    textBlock.style.width = originalWidth;
    textBlock.style.height = originalHeight;
    if (originalWebkitLineClamp) {
      textBlock.style.webkitLineClamp = originalWebkitLineClamp;
    }
    if (originalForeignWidth) {
      this.shape.textElement.setAttribute('width', originalForeignWidth);
    } else {
      this.shape.textElement.removeAttribute('width');
    }
    if (originalForeignHeight) {
      this.shape.textElement.setAttribute('height', originalForeignHeight);
    } else {
      this.shape.textElement.removeAttribute('height');
    }

    // Convert text size from CSS pixels to SVG user units (world coordinates)
    const worldWidth = textWidth * scaleX;
    const worldHeight = textHeight * scaleY;

    return {
      width: Math.max(1, worldWidth),
      height: Math.max(1, worldHeight)
    };
  }
}
