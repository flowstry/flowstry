import type { ExportOptions } from '../components/ExportImageModal';
import { DiagramManager, DiagramShape } from '../shapes';


export class ImageExportManager {
  private diagramManager: DiagramManager;
  private svgElement: SVGSVGElement | null = null;
  private contentLayer: SVGGElement | null = null;

  constructor(
    diagramManager: DiagramManager,
    svgElement: SVGSVGElement | null,
    contentLayer: SVGGElement | null
  ) {
    this.diagramManager = diagramManager;
    this.svgElement = svgElement;
    this.contentLayer = contentLayer;
  }

  /**
   * Generate preview SVG without exporting
   */
  generatePreview(options: Omit<ExportOptions, 'filename'>): SVGSVGElement | null {
    if (!this.svgElement || !this.contentLayer) {
      return null;
    }

    // Get the shapes to export
    const shapesToExport = options.onlySelected
      ? this.diagramManager.getSelectedShapes()
      : this.diagramManager.getShapes();

    // Ensure selection indicators are marked for ignore
    this.ensureSelectionIndicatorsMarked(shapesToExport);

    if (shapesToExport.length === 0) {
      return null;
    }

    // Calculate bounds of shapes to export
    const bounds = this.calculateBounds(shapesToExport.map(s => s.element));
    
    // Add padding
    const padding = 40;
    const exportWidth = bounds.width + padding * 2;
    const exportHeight = bounds.height + padding * 2;

    // Create a new SVG for preview
    return this.createExportSVG(
      shapesToExport.map(s => s.element),
      bounds,
      padding,
      exportWidth,
      exportHeight,
      { ...options, filename: '', scale: 1 }
    );
  }

  /**
   * Export the canvas as an image
   */
  async export(options: ExportOptions, format: 'png' | 'svg' | 'clipboard'): Promise<void> {
    if (!this.svgElement || !this.contentLayer) {
      throw new Error('SVG element or content layer not initialized');
    }

    // Get the shapes to export
    const shapesToExport = options.onlySelected
      ? this.diagramManager.getSelectedShapes()
      : this.diagramManager.getShapes();

    // Ensure selection indicators are marked for ignore
    this.ensureSelectionIndicatorsMarked(shapesToExport);

    if (shapesToExport.length === 0) {
      throw new Error('No shapes to export');
    }

    // Calculate bounds of shapes to export
    const bounds = this.calculateBounds(shapesToExport.map(s => s.element));
    
    // Add padding
    const padding = 40;
    const exportWidth = bounds.width + padding * 2;
    const exportHeight = bounds.height + padding * 2;

    // Create a new SVG for export
    const exportSvg = this.createExportSVG(
      shapesToExport.map(s => s.element),
      bounds,
      padding,
      exportWidth,
      exportHeight,
      options
    );

    // Export based on format
    if (format === 'svg') {
      await this.exportAsSVG(exportSvg, options.filename);
    } else if (format === 'png') {
      await this.exportAsPNG(exportSvg, exportWidth * options.scale, exportHeight * options.scale, options.filename);
    } else if (format === 'clipboard') {
      await this.copyToClipboard(exportSvg, exportWidth * options.scale, exportHeight * options.scale);
    }
  }

  /**
   * Calculate bounding box of multiple elements
   */
  private calculateBounds(elements: SVGGElement[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach(element => {
      const shape = this.diagramManager.getShapes().find(s => s.element === element);
      if (shape) {
        minX = Math.min(minX, shape.layout.x);
        minY = Math.min(minY, shape.layout.y);
        maxX = Math.max(maxX, shape.layout.x + shape.layout.width);
        maxY = Math.max(maxY, shape.layout.y + shape.layout.height);
      }
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Recursively inline computed styles from source element to target element
   * Only processes HTML elements inside foreignObject
   */
  private inlineStyles(source: Element, target: Element) {
    // If this is a foreignObject, start processing its children
    if (source.tagName === 'foreignObject') {
      this.copyComputedStylesRecursive(source, target);
    } else {
      // Otherwise keep looking for foreignObject
      const sourceChildren = Array.from(source.children);
      const targetChildren = Array.from(target.children);

      for (let i = 0; i < sourceChildren.length; i++) {
        if (targetChildren[i]) {
          this.inlineStyles(sourceChildren[i], targetChildren[i]);
        }
      }
    }
  }

  /**
   * Helper to recursively copy computed styles for HTML elements
   */
  private copyComputedStylesRecursive(source: Element, target: Element) {
    if (source instanceof HTMLElement && target instanceof HTMLElement) {
      const computed = window.getComputedStyle(source);

      const propertiesToCopy = [
        'backgroundColor',
        'color',
        'borderColor',
        'borderWidth',
        'borderStyle',
        'borderRadius',
        'boxShadow',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'lineHeight',
        'textAlign',
        'textTransform',
        'display',
        'alignItems',
        'justifyContent',
        'gap',
        'padding',
        'margin',
        'width',
        'height',
        'boxSizing',
        'opacity',
        'backgroundImage', // For gradients
        'backgroundSize',
        'backgroundPosition'
      ];

      propertiesToCopy.forEach(prop => {
        // @ts-ignore - Dynamic property access
        const value = computed[prop];
        // @ts-ignore - Dynamic property access
        if (value && value !== 'normal' && value !== 'auto' && value !== 'none' && value !== 'rgba(0, 0, 0, 0)') {
          // @ts-ignore
          target.style[prop] = value;
        } else if (prop === 'fontFamily') {
          // Always force a font family fallback
          // @ts-ignore
          target.style[prop] = computed[prop];
        } else if (prop === 'display') {
          // @ts-ignore
          target.style[prop] = computed[prop];
        }
      });
    }

    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children);

    for (let i = 0; i < sourceChildren.length; i++) {
      if (targetChildren[i]) {
        this.copyComputedStylesRecursive(sourceChildren[i], targetChildren[i]);
      }
    }
  }

  /**
   * Create a new SVG element for export
   */
  private createExportSVG(
    elements: SVGGElement[],
    bounds: { x: number; y: number; width: number; height: number },
    padding: number,
    width: number,
    height: number,
    options: ExportOptions
  ): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add background if enabled
    if (options.withBackground) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', '#f3f4f6'); // Default light background
      svg.appendChild(bg);
    }

    // Create a group for the shapes with offset transform
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const offsetX = padding - bounds.x;
    const offsetY = padding - bounds.y;
    group.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

    // Clone and append each shape
    elements.forEach(element => {
      const clone = element.cloneNode(true) as SVGGElement;

      // Remove elements that should be ignored during export (like selection indicators)
      const ignoredElements = clone.querySelectorAll('[data-export-ignore="true"]');
      ignoredElements.forEach(el => el.remove());

      // Inline computed styles for high-fidelity export (fixes ReactShape appearance)
      this.inlineStyles(element, clone);

      group.appendChild(clone);
    });

    svg.appendChild(group);

    return svg;
  }

  /**
   * Export SVG as SVG file
   */
  private async exportAsSVG(svg: SVGSVGElement, filename: string): Promise<void> {
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export SVG as PNG file using a safer approach
   */
  private async exportAsPNG(svg: SVGSVGElement, width: number, height: number, filename: string): Promise<void> {
    // Inline styles from foreignObject to make them work in canvas
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Serialize SVG with XML namespace
    const svgData = new XMLSerializer().serializeToString(svgClone);
    
    // Create a data URL instead of blob URL to avoid CORS issues
    const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
    
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve();
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('Image load error:', error);
        reject(new Error('Failed to load image for PNG export'));
      };

      img.src = dataUrl;
    });
  }

  /**
   * Copy image to clipboard
   */
  private async copyToClipboard(svg: SVGSVGElement, width: number, height: number): Promise<void> {
    // Inline styles from foreignObject to make them work in canvas
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const svgData = new XMLSerializer().serializeToString(svgClone);
    
    // Create a data URL instead of blob URL to avoid CORS issues
    const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
    
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to create blob'));
            }, 'image/png');
          });

          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('Image load error:', error);
        reject(new Error('Failed to load image for clipboard'));
      };

      img.src = dataUrl;
    });
  }

  /**
   * Get thumbnail as blob
   */
  async getThumbnailBlob(): Promise<Blob | null> {
    if (!this.svgElement || !this.contentLayer) {
      return null;
    }

    // Get all shapes
    const shapes = this.diagramManager.getShapes();
    if (shapes.length === 0) {
      return null;
    }

    // Ensure selection indicators are marked for ignore
    this.ensureSelectionIndicatorsMarked(shapes);

    const bounds = this.calculateBounds(shapes.map(s => s.element));

    // Create preview SVG
    // Add minimized padding for tighter crop
    const padding = 4;
    const exportWidth = bounds.width + padding * 2;
    const exportHeight = bounds.height + padding * 2;

    // Create a new SVG for export
    const svg = this.createExportSVG(
      shapes.map(s => s.element),
      bounds,
      padding,
      exportWidth,
      exportHeight,
      {
        filename: 'thumbnail',
        scale: 1, 
        withBackground: true,
        onlySelected: false
      }
    );

    // Target a reasonable resolution for the thumbnail (e.g. max 500px dimension)
    // This ensures quality but keeps file size low.
    const maxDimension = 500;
    const scale = Math.min(1, maxDimension / Math.max(exportWidth, exportHeight));

    // Canvas size matches the aspect ratio of the content exactly
    const canvasWidth = Math.ceil(exportWidth * scale);
    const canvasHeight = Math.ceil(exportHeight * scale);

    // Render to canvas and get blob
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        try {
          // Draw image full size (scaled)
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png', 0.9); // 90% quality
        } catch (e) {
          console.error("Failed to generate thumbnail", e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /**
   * Ensure all selection indicators have the ignore attribute
   */
  private ensureSelectionIndicatorsMarked(shapes: DiagramShape[]): void {
    shapes.forEach(shape => {
      // Access the private/protected selectionIndicator if possible (it's public in base.ts)
      const indicator = shape.selection.indicatorElement;
      if (indicator) {
        indicator.setAttribute('data-export-ignore', 'true');
      }
    });
  }
}


