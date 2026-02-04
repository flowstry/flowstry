import { DiagramManager } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { FreehandShape } from '../shapes/freehand';
import { ReactShape } from '../shapes/react/ReactShape';
import { ShapeData } from './storage/types';

/**
 * ClipboardManager handles copy, cut, and paste operations for shapes
 * Uses the native Clipboard API to work across all windows (including private/incognito)
 */
export class ClipboardManager {
  private static readonly CLIPBOARD_PREFIX = 'FLOWSTRY_CANVAS_V2:'; // Bump version prefix
  private static readonly PASTE_OFFSET = 20;
  private diagramManager: DiagramManager;
  private pasteCount: number = 0; // Track consecutive pastes for offset
  private localClipboard: DiagramShape[] = []; // In-memory clipboard for high-fidelity copy/paste

  constructor(diagramManager: DiagramManager) {
    this.diagramManager = diagramManager;
  }

  /**
   * Write data to system clipboard using Clipboard API
   */
  private async writeToClipboard(data: ShapeData[]): Promise<boolean> {
    // Check if we're in a browser environment with Clipboard API
    if (typeof window === 'undefined' || !navigator.clipboard) {
      console.warn('Clipboard API not available');
      return false;
    }

    try {
      // Encode our data with a prefix so we can identify it when reading
      const jsonData = JSON.stringify(data);
      const clipboardText = ClipboardManager.CLIPBOARD_PREFIX + jsonData;
      
      await navigator.clipboard.writeText(clipboardText);
      return true;
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
      return false;
    }
  }

  /**
   * Read data from system clipboard using Clipboard API
   */
  private async readFromClipboard(): Promise<ShapeData[]> {
    // Check if we're in a browser environment with Clipboard API
    if (typeof window === 'undefined' || !navigator.clipboard) {
      return [];
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      
      // Check if the clipboard contains our data (has our prefix)
      // Also support V1 prefix for backward compatibility if needed, but for now enforcing V2
      if (!clipboardText.startsWith(ClipboardManager.CLIPBOARD_PREFIX)) {
        // TODO: Add V1 support if needed (migration logic similar to StorageManager)
        return [];
      }

      // Remove prefix and parse JSON
      const jsonData = clipboardText.substring(ClipboardManager.CLIPBOARD_PREFIX.length);
      const data = JSON.parse(jsonData);
      
      // Validate that it's an array
      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    } catch (error) {
      // Silently fail - clipboard might contain non-JSON text or user denied permission
      return [];
    }
  }

  /**
   * Copy selected shapes to clipboard
   */
  public async copy(): Promise<boolean> {
    const selectedShapes = this.diagramManager.getSelectedShapes();
    if (selectedShapes.length === 0) return false;

    // Serialize selected shapes
    const clipboardData = selectedShapes.map(shape => this.serializeShape(shape));
    
    // Update local clipboard with deep clones
    // We force the ID of the clone to match the original so that we can maintain relationships
    // internally within the clipboard (e.g. connections between copied shapes)
    this.localClipboard = selectedShapes.map(s => {
      const clone = s.copy();
      clone.id = s.id;
      return clone;
    });

    // Write to system clipboard
    const success = await this.writeToClipboard(clipboardData);
    
    // Reset paste count when copying new content
    if (success) {
      this.pasteCount = 0;
    }
    
    return success;
  }

  /**
   * Cut selected shapes (copy and delete)
   */
  public async cut(): Promise<boolean> {
    const selectedShapes = this.diagramManager.getSelectedShapes();
    if (selectedShapes.length === 0) return false;

    // Copy to clipboard first
    const copySuccess = await this.copy();
    
    if (!copySuccess) return false;

    // Delete shapes
    const shapesToDelete = [...selectedShapes]; // Create copy to avoid mutation issues
    shapesToDelete.forEach(shape => {
      this.diagramManager.removeShape(shape);
    });

    return true;
  }

  /**
   * Paste shapes from clipboard at cursor position
   * @param cursorX - World X position where to paste (optional, defaults to center offset)
   * @param cursorY - World Y position where to paste (optional, defaults to center offset)
   */
  public async paste(cursorX?: number, cursorY?: number): Promise<boolean> {
    // Try to handle image paste first
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            await this.pasteImage(blob, cursorX, cursorY);
            return true;
          }
        }
      }
    } catch (e) {
      // Ignore errors (e.g. permission denied) and fall back to text
      console.debug('Clipboard read failed, falling back to text', e);
    }

    // Try local clipboard first for high fidelity
    if (this.localClipboard.length > 0) {
      return this.pasteFromLocalClipboard(cursorX, cursorY);
    }

    const clipboardData = await this.readFromClipboard();
    if (clipboardData.length === 0) return false;

    // Calculate the center of the copied shapes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    clipboardData.forEach(data => {
      // Access layout properties
      minX = Math.min(minX, data.layout.x);
      minY = Math.min(minY, data.layout.y);
      maxX = Math.max(maxX, data.layout.x + data.layout.width);
      maxY = Math.max(maxY, data.layout.y + data.layout.height);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // If no cursor position provided, use a small offset from original position
    let targetX: number;
    let targetY: number;
    
    if (cursorX !== undefined && cursorY !== undefined) {
      // Paste at cursor position
      targetX = cursorX;
      targetY = cursorY;
    } else {
      // Paste with offset (for keyboard paste)
      this.pasteCount++;
      targetX = centerX + (ClipboardManager.PASTE_OFFSET * this.pasteCount);
      targetY = centerY + (ClipboardManager.PASTE_OFFSET * this.pasteCount);
    }

    // Calculate offset to apply to all shapes
    const offsetX = targetX - centerX;
    const offsetY = targetY - centerY;

    // Deselect all shapes first
    this.diagramManager.deselectAllShapes();

    // Create new shapes from clipboard data
    const newShapes: DiagramShape[] = [];

    clipboardData.forEach(data => {
      let newShape: DiagramShape | null = null;
      let newX: number;
      let newY: number;
      
      const { type, layout, intent, appearance } = data as any;

      if (type === 'connector') {
        // Handle connectors specially - they need start/end points
        const connLayout = layout; // Specific Connector Layout

        const newStartPoint = {
          x: connLayout.startPoint.x + offsetX,
          y: connLayout.startPoint.y + offsetY
        };
        const newEndPoint = {
          x: connLayout.endPoint.x + offsetX,
          y: connLayout.endPoint.y + offsetY
        };
        // Reset connections when pasting (shapes might not exist yet, remapping happens later)
        newShape = this.diagramManager.createConnector(
          connLayout.connectorType,
          newStartPoint,
          newEndPoint,
          null, // startShapeId - reset on paste
          null  // endShapeId - reset on paste
        );
        // Restore connector-specific properties
        if (newShape) {
          const connector = newShape as any;
          const connIntent = intent;

          // Restore midpoint properties
          if (connLayout.connectorType === 'curved') {
            if (connLayout.midpointMode !== undefined) connector.midpointMode = connLayout.midpointMode;
            if (connLayout.midpointRatio !== undefined) connector.midpointRatio = connLayout.midpointRatio;
            if (connLayout.midpointOffset !== undefined) connector.midpointOffset = connLayout.midpointOffset;
            if (connLayout.customMidpoint !== undefined) connector.customMidpoint = connLayout.customMidpoint;
          }

          // Restore arrowhead types
          if (connIntent.startArrowheadType !== undefined) connector.startArrowheadType = connIntent.startArrowheadType;
          if (connIntent.endArrowheadType !== undefined) connector.endArrowheadType = connIntent.endArrowheadType;

          // Restore animation state
          if (connIntent.animated !== undefined) connector.setAnimated(connIntent.animated);

          // Restore label position
          if (connIntent.labelPosition !== undefined) connector.setLabelPosition(connIntent.labelPosition);
        }
        // For connectors, calculate newX/newY from bounding box for consistency
        newX = layout.x + offsetX;
        newY = layout.y + offsetY;
      } else if (type === 'freehand') {
        // Handle freehand shapes specially - they need points
        // Offset the points
        const offsetPoints = intent.points.map((pt: { x: number; y: number }) => ({
          x: pt.x + offsetX,
          y: pt.y + offsetY
        }));
        newShape = this.diagramManager.createFreehandShape(
          offsetPoints,
          intent.markerType || 'pen'
        );
        newX = layout.x + offsetX;
        newY = layout.y + offsetY;
      } else if (type === 'image') {
        // Handle image shapes
        newX = layout.x + offsetX;
        newY = layout.y + offsetY;

        newShape = this.diagramManager.createImageShape(
          newX,
          newY,
          intent.imageUrl,
          intent.text || intent.imageName || 'Image', // Use intent.text or fallback
          intent.squareIcon
        );
      } else {
        // Regular shapes (including service shapes)
        newX = layout.x + offsetX;
        newY = layout.y + offsetY;
        newShape = this.diagramManager.createShape(
          type,
          newX,
          newY
        );
      }

      if (newShape) {
        // Apply properties (connectors handle position differently via start/end points)
        if (type !== 'connector') {
          newShape.layout.resize(
            newShape.layout.x + ClipboardManager.PASTE_OFFSET,
            newShape.layout.y + ClipboardManager.PASTE_OFFSET,
            newShape.layout.width,
            newShape.layout.height
          );
          // Only apply fill properties to non-connector shapes
          newShape.appearance.fill = appearance.fill;
          newShape.appearance.fillOpacity = appearance.fillOpacity ?? 1;

          // Restore styles
          if (appearance.fillStyle) {
            newShape.appearance.fillStyle = appearance.fillStyle;
          }

          if (type === 'rectangle') {
            if (intent.iconKey) newShape.iconKey = intent.iconKey;
            (newShape as any).iconContent = intent.iconContent ?? null;
            (newShape as any).hasIconPlaceholder = intent.hasIconPlaceholder ?? false;
          }
        }
        // Connectors should never have fills - skip fill properties for them
        newShape.appearance.stroke = appearance.stroke;
        newShape.appearance.strokeWidth = appearance.strokeWidth;
        newShape.appearance.strokeOpacity = appearance.strokeOpacity ?? 1;

        if (appearance.strokeStyle) {
          newShape.appearance.strokeStyle = appearance.strokeStyle;
        }
        if (appearance.strokeDrawStyle) {
          newShape.appearance.strokeDrawStyle = appearance.strokeDrawStyle;
        }
        if (appearance.fillDrawStyle) {
          newShape.appearance.fillDrawStyle = appearance.fillDrawStyle;
        }

        // Apply text
        if (intent.text) newShape.text = intent.text;

        // Apply text style properties
        if (appearance.fontSize !== undefined) newShape.appearance.fontSize = appearance.fontSize;
        if (appearance.fontFamily !== undefined) newShape.appearance.fontFamily = appearance.fontFamily;
        if (appearance.fontWeight !== undefined) newShape.appearance.fontWeight = appearance.fontWeight;
        if (appearance.textDecoration !== undefined) newShape.appearance.textDecoration = appearance.textDecoration;
        if (appearance.textAlign !== undefined) newShape.appearance.textAlign = appearance.textAlign;
        if (appearance.textJustify !== undefined) newShape.appearance.textJustify = appearance.textJustify;
        if (appearance.textColor !== undefined) newShape.appearance.textColor = appearance.textColor;

        this.diagramManager.updateShapeText(newShape);

        // Restore ReactShape (service-card, todo-card) specific data
        if ((type === 'service-card' || type === 'todo-card') && intent.data) {
          const reactShape = newShape as ReactShape
          reactShape.updateData(intent.data)
        }

        // Restore Frame Data
        if (type === 'frame') {
          const frame = newShape as any;
          if (intent.labelText) frame.labelText = intent.labelText;
          if (intent.collapsed !== undefined) frame.collapsed = intent.collapsed;
          if (intent.iconContent !== undefined) frame.iconContent = intent.iconContent;
          if (intent.hasIconPlaceholder !== undefined) frame.hasIconPlaceholder = intent.hasIconPlaceholder;
          frame.needsRender = true;
          frame.render();
        }

        // Select the new shape
        this.diagramManager.selectShape(newShape);
        newShapes.push(newShape);
      }
    });

    // Build old→new ID mapping for connection AND group remapping
    // Use the ID from the clipboard data as the "original ID"
    const idMap = new Map<string, string>();
    clipboardData.forEach((data, index) => {
      if (newShapes[index]) {
        idMap.set(data.id, newShapes[index].id);
      }
    });

    // Remap connector connections to new shape IDs
    newShapes.forEach((shape, index) => {
      const data = clipboardData[index];
      const { type, intent } = data as any;

      if (type === 'connector' && shape.type === 'connector') {
        const connector = shape as any;
        const connIntent = intent;

        // Remap start connection if the connected shape was also copied
        if (connIntent.startShapeId && idMap.has(connIntent.startShapeId)) {
          connector.startShapeId = idMap.get(connIntent.startShapeId);
          connector.startConnectorPoint = connIntent.startConnectorPoint || null;
        // Note: direction removed from intent in strict typing, but implied by points usually
        }

        // Remap end connection if the connected shape was also copied
        if (connIntent.endShapeId && idMap.has(connIntent.endShapeId)) {
          connector.endShapeId = idMap.get(connIntent.endShapeId);
          connector.endConnectorPoint = connIntent.endConnectorPoint || null;
        }

        // Trigger re-render to update connector path with new connections
        // Note: We do NOT call updateConnectorPoints() here because it would
        // recalculate positions from scratch, overwriting the exact edge positions.
        // The connector's startPoint/endPoint are already correctly offset.
        connector.needsRender = true;
      }
    });

    // Handle group structure: collect unique parent group IDs and create new groups
    const oldGroupIds = new Set<string>();
    clipboardData.forEach(data => {
      if (data.layout.parentId) {
        oldGroupIds.add(data.layout.parentId);
      }
    });

    // Create new groups for each old group ID and map old→new
    const groupIdMap = new Map<string, string>();
    oldGroupIds.forEach(oldGroupId => {
      const newGroupId = crypto.randomUUID();
      groupIdMap.set(oldGroupId, newGroupId);
      // Register the new group (without nested parent logic for simplicity)
      this.diagramManager.setGroups({
        ...this.diagramManager.getGroups(),
        [newGroupId]: { parentId: null }
      });
    });

    // Assign new parentIds to pasted shapes
    newShapes.forEach((shape, index) => {
      const data = clipboardData[index];
      if (data.layout.parentId && groupIdMap.has(data.layout.parentId)) {
        shape.parentId = groupIdMap.get(data.layout.parentId) || null;
      }
    });

    // Update selection overlay
    this.diagramManager.updateSelectionOverlay();

    return newShapes.length > 0;
  }

  private async pasteFromLocalClipboard(cursorX?: number, cursorY?: number): Promise<boolean> {
    const shapes = this.localClipboard;
    if (shapes.length === 0) return false;

    // Calculate center
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    shapes.forEach(shape => {
      minX = Math.min(minX, shape.layout.x);
      minY = Math.min(minY, shape.layout.y);
      maxX = Math.max(maxX, shape.layout.x + shape.layout.width);
      maxY = Math.max(maxY, shape.layout.y + shape.layout.height);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let targetX: number;
    let targetY: number;

    if (cursorX !== undefined && cursorY !== undefined) {
      targetX = cursorX;
      targetY = cursorY;
    } else {
      this.pasteCount++;
      targetX = centerX + (ClipboardManager.PASTE_OFFSET * this.pasteCount);
      targetY = centerY + (ClipboardManager.PASTE_OFFSET * this.pasteCount);
    }

    const offsetX = targetX - centerX;
    const offsetY = targetY - centerY;

    this.diagramManager.deselectAllShapes();

    // 1. Create fresh clones and map IDs
    const idMap = new Map<string, string>();
    const newShapes: DiagramShape[] = [];

    shapes.forEach(s => {
      const newShape = s.copy(); // Generates NEW ID
      idMap.set(s.id, newShape.id); // Map Original (Clipboard) -> New
      newShapes.push(newShape);
    });

    // 2. Remap connections and parent IDs
    newShapes.forEach(shape => {
      // Remap parentId
      if (shape.parentId && idMap.has(shape.parentId)) {
        shape.parentId = idMap.get(shape.parentId)!;
      }

      // Remap Frame children
      if (shape.type === 'frame') {
        const frame = shape as any; // FrameShape
        if (frame.childIds) {
          frame.childIds = frame.childIds.map((id: string) => idMap.get(id) || id).filter((id: string) => idMap.has(id));
          // Note: filter to only include children that were also pasted. 
          // If referencing a shape on canvas, we don't want the new frame to claim it?
          // Actually, if we copy a frame but not its children, the new frame is empty?
          // Yes, that's standard behavior.
        }
        if (frame.childFrameIds) {
          frame.childFrameIds = frame.childFrameIds.map((id: string) => idMap.get(id) || id).filter((id: string) => idMap.has(id));
        }
      }

      // Remap Connectors
      if (shape.type === 'connector') {
        const conn = shape as any; // ConnectorShape
        if (conn.startShapeId && idMap.has(conn.startShapeId)) {
          conn.startShapeId = idMap.get(conn.startShapeId);
        }
        if (conn.endShapeId && idMap.has(conn.endShapeId)) {
          conn.endShapeId = idMap.get(conn.endShapeId);
        }
      }

      // Apply offset
      if (shape.type === 'connector') {
        // Offset start/end points explicitly
        const conn = shape as any;
        conn.startPoint.x += offsetX;
        conn.startPoint.y += offsetY;
        conn.endPoint.x += offsetX;
        conn.endPoint.y += offsetY;

        // Offset internal points
        if (conn.pointsStraight) conn.pointsStraight.forEach((p: any) => { p.x += offsetX; p.y += offsetY; });
        if (conn.pointsBent) conn.pointsBent.forEach((p: any) => { p.x += offsetX; p.y += offsetY; });
        if (conn.pointsCurved) conn.pointsCurved.forEach((p: any) => { p.x += offsetX; p.y += offsetY; });
        if (conn.customMidpoint) { conn.customMidpoint.x += offsetX; conn.customMidpoint.y += offsetY; }

        conn.updatePath(); // Recalculate if needed
      } else if (shape.type === 'freehand') {
        const freehand = shape as any;
        freehand.points.forEach((p: any) => { p.x += offsetX; p.y += offsetY; });
        shape.layout.x += offsetX;
        shape.layout.y += offsetY;
      } else {
        shape.layout.x += offsetX;
        shape.layout.y += offsetY;
      }
    });

    // 3. Add to manager
    newShapes.forEach(s => {
      this.diagramManager.addShape(s);
      this.diagramManager.selectShape(s);
    });

    this.diagramManager.updateSelectionOverlay();
    return true;
  }

  private async pasteImage(blob: Blob, cursorX?: number, cursorY?: number): Promise<void> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          // Determine position
          let x = cursorX;
          let y = cursorY;

          if (x === undefined || y === undefined) {
            // Default to some position if not provided (e.g. center of view, but we don't have view bounds here easily)
            // For now, use a default or try to get it from diagram manager if exposed
            x = 100;
            y = 100;
            this.pasteCount++;
            x = 100;
            y = 100;
            this.pasteCount++;
            x += (ClipboardManager.PASTE_OFFSET * this.pasteCount);
            y += (ClipboardManager.PASTE_OFFSET * this.pasteCount);
          }

          this.diagramManager.createImageShape(x, y, result);
        }
        resolve();
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Check if clipboard API is available
   * Note: We can't check the actual clipboard contents synchronously,
   * so we return true if the API is available. The paste operation
   * will handle the case where there's no valid data.
   */
  public hasClipboardData(): boolean {
    return typeof window !== 'undefined' && !!navigator.clipboard;
  }

  /**
   * Clear clipboard (resets paste count)
   */
  public clear(): void {
    this.pasteCount = 0;
    this.localClipboard = [];
  }

  /**
   * Serialize a shape to clipboard data
   */
  private serializeShape(shape: DiagramShape): ShapeData {
    // 1. Common Layout
    const layout: any = {
      x: shape.layout.x,
      y: shape.layout.y,
      width: shape.layout.width,
      height: shape.layout.height,
      parentId: shape.parentId,
      frameId: (shape.layout as any).frameId // frameId is on layout but might not be on ShapeLayout interface yet? It is on ShapeLayout.
    };

    // 2. Common Appearance
    const appearance: any = {
      opacity: 1,
      stroke: shape.appearance.stroke,
      strokeWidth: shape.appearance.strokeWidth,
      strokeOpacity: shape.appearance.strokeOpacity,
      strokeStyle: shape.appearance.strokeStyle as any,
      fill: shape.appearance.fill,
      fillOpacity: shape.appearance.fillOpacity,
      fillStyle: shape.appearance.fillStyle as any,
      // Text styles
      textColor: shape.appearance.textColor,
      fontSize: shape.appearance.fontSize,
      fontFamily: shape.appearance.fontFamily,
      fontWeight: shape.appearance.fontWeight,
      fontStyle: shape.appearance.fontStyle,
      textDecoration: shape.appearance.textDecoration,
      textAlign: shape.appearance.textAlign,
      textJustify: shape.appearance.textJustify
    };

    // 3. Shape Specific Intent & Layout extensions
    const base = {
      id: shape.id,
      options: (shape as any).options,
    };

    // --- Connector ---
    if (shape.type === 'connector') {
      const connector = shape as any;
      const connectorIntent: any = {
        text: shape.text,
        startShapeId: connector.startShapeId,
        endShapeId: connector.endShapeId,
        startConnectorPoint: connector.startConnectorPoint,
        endConnectorPoint: connector.endConnectorPoint,
        startArrowheadType: connector.startArrowheadType,
        endArrowheadType: connector.endArrowheadType,
        animated: connector.animated,
        labelPosition: connector.labelPosition
      };

      const connectorLayout: any = {
        ...layout,
        connectorType: connector.connectorType,
        startPoint: connector.startPoint,
        endPoint: connector.endPoint,
        pointsStraight: connector.pointsStraight,
        pointsBent: connector.pointsBent,
        pointsCurved: connector.pointsCurved,
        hasUserModifiedPath: connector.hasUserModifiedPath,
        bentConnectorMatchingMode: connector.routingMode,
        // Map segments if they exist
        bentConnectorSegments: connector.segments?.map((seg: any) => ({
          axis: seg.axis,
          value: seg.value,
          start: seg.start,
          end: seg.end,
          locked: seg.locked
        })),
        midpointMode: connector.midpointMode,
        midpointRatio: connector.midpointRatio,
        midpointOffset: connector.midpointOffset,
        customMidpoint: connector.customMidpoint
      };

      appearance.fill = 'none';

      return {
        ...base,
        type: 'connector',
        intent: connectorIntent,
        layout: connectorLayout,
        appearance
      } as any;
    }

    // --- Image ---
    if (shape.type === 'image') {
      return {
        ...base,
        type: 'image',
        intent: {
          imageUrl: (shape as any).imageUrl,
          imageName: shape.text,
          squareIcon: (shape as any).squareIcon,
          text: shape.text
        },
        layout,
        appearance
      } as any;
    }

    // --- Freehand ---
    if (shape.type === 'freehand') {
      const freehand = shape as FreehandShape;
      return {
        ...base,
        type: 'freehand',
        intent: {
          points: [...freehand.points],
          markerType: freehand.markerType
        },
        layout,
        appearance
      } as any;
    }

    // --- Frame ---
    if (shape.type === 'frame') {
      const frame = shape as any;
      return {
        ...base,
        type: 'frame',
        intent: {
          labelText: frame.labelText,
          collapsed: frame.collapsed,
          isNestedFrame: frame.isNestedFrame,
          childIds: frame.childIds ? [...frame.childIds] : [],
          childFrameIds: frame.childFrameIds ? [...frame.childFrameIds] : [],
          iconContent: (shape as any).iconContent,
          hasIconPlaceholder: (shape as any).hasIconPlaceholder
        },
        layout,
        appearance
      } as any;
    }

    // --- Service Card / React ---
    if (shape.type === 'service-card' || shape.type === 'todo-card') {
      const reactShape = shape as ReactShape;
      return {
        ...base,
        type: shape.type,
        intent: {
          data: reactShape.getData()
        },
        layout,
        appearance
      } as any;
    }

    // --- Rectangle ---
    if (shape.type === 'rectangle') {
      return {
        ...base,
        type: 'rectangle',
        intent: {
          text: shape.text,
          iconKey: shape.iconKey,
          hasIconPlaceholder: (shape as any).hasIconPlaceholder,
          iconContent: (shape as any).iconContent
        },
        layout,
        appearance
      } as any;
    }

    // --- Geometric (Default Fallback) ---
    return {
      ...base,
      type: shape.type as any,
      intent: {
        text: shape.text
      },
      layout,
      appearance
    } as any;
  }
}
