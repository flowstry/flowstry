import { DiagramManager } from '../shapes';
import { DiagramShape } from '../shapes/base';
import { FreehandShape } from '../shapes/freehand';
import { ReactShape } from '../shapes/react/ReactShape';
import { ShapeData } from './storage/types';

/**
 * Interface for serialized canvas state
 */
export interface CanvasSnapshot {
  shapes: ShapeData[];
  selectedShapeIds: string[];
  groups: Record<string, { parentId: string | null }>;
}

/**
 * HistoryManager tracks canvas state changes for undo/redo
 */
export class HistoryManager {
  private history: CanvasSnapshot[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50; // Maximum number of undo steps
  private diagramManager: DiagramManager;
  private isRestoring: boolean = false; // Flag to prevent recording during restore
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(diagramManager: DiagramManager) {
    this.diagramManager = diagramManager;
  }

  /**
   * Record the current state
   * @param debounce If true, debounces the recording (useful for text input)
   */
  public recordState(debounce: boolean = false): void {
    // Don't record if we're in the middle of restoring
    if (this.isRestoring) return;

    // Clear existing timer if any
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (debounce) {
      this.debounceTimer = setTimeout(() => {
        this.performRecordState();
        this.debounceTimer = null;
      }, 500); // 500ms debounce
    } else {
      this.performRecordState();
    }
  }

  /**
   * Internal method to actually record the state
   */
  private performRecordState(): void {
    const snapshot = this.captureSnapshot();

    // Don't record if state hasn't changed (prevents duplicate entries)
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      const currentSnapshot = this.history[this.currentIndex];
      if (this.snapshotsAreEqual(currentSnapshot, snapshot)) {
        return; // State hasn't changed, skip recording
      }
    }

    // Remove any history after current index (when user makes new action after undo)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new snapshot
    this.history.push(snapshot);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Apply a remote snapshot (from collaboration) without recording it
   * This prevents infinite loops and duplicate saves
   */
  public applyRemoteSnapshot(snapshot: CanvasSnapshot): void {
    // Set flag to prevent recording during restore
    this.isRestoring = true;
    try {
      // Don't restore selection from remote - keep local selection
      this.restoreSnapshot(snapshot, true);
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Undo the last action
   */
  public undo(): boolean {
    if (!this.canUndo()) return false;

    this.currentIndex--;
    this.restoreSnapshot(this.history[this.currentIndex]);
    return true;
  }

  /**
   * Redo the last undone action
   */
  public redo(): boolean {
    if (!this.canRedo()) return false;

    this.currentIndex++;
    this.restoreSnapshot(this.history[this.currentIndex]);
    return true;
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Clear all history
   */
  public clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Capture current canvas state
   */
  public captureSnapshot(): CanvasSnapshot {
    const shapes = this.diagramManager.getShapes();
    const selectedShapes = this.diagramManager.getSelectedShapes();
    const groups = this.diagramManager.getGroups();

    return {
      shapes: shapes.map(shape => this.serializeShape(shape)),
      selectedShapeIds: selectedShapes.map(shape => shape.id),
      groups: groups
    };
  }

  /**
   * Restore canvas state from snapshot
   */
  private restoreSnapshot(snapshot: CanvasSnapshot, skipSelection: boolean = false): void {
    this.isRestoring = true;

    try {
      // Get current shapes for comparison
      const currentShapes = this.diagramManager.getShapes();
      const currentShapeMap = new Map(currentShapes.map(s => [s.id, s]));
      const snapshotShapeMap = new Map(snapshot.shapes.map(s => [s.id, s]));

      // Remove shapes that don't exist in snapshot
      currentShapes.forEach(shape => {
        if (!snapshotShapeMap.has(shape.id)) {
          this.diagramManager.removeShape(shape);
        }
      });

      // Split snapshot shapes into non-connectors and connectors
      const nonConnectors = snapshot.shapes.filter(s => s.type !== 'connector');
      const connectors = snapshot.shapes.filter(s => s.type === 'connector');

      // Helper function to process a shape snapshot
      const processShapeSnapshot = (shapeData: ShapeData) => {
        const existingShape = currentShapeMap.get(shapeData.id);

        if (existingShape) {
          // Update existing shape
          this.updateShapeFromSnapshot(existingShape, shapeData);
          // Restore parentId
          existingShape.parentId = shapeData.layout.parentId ?? null;
        } else {
          // Create new shape
          let newShape: DiagramShape | null = null;
          
          const { type, layout, intent } = shapeData as any;

          if (type === 'connector') {
            const connectorLayout = layout; // Specific Connector Layout
            // Handle connectors specially
            if (connectorLayout.connectorType && connectorLayout.startPoint && connectorLayout.endPoint) {
              newShape = this.diagramManager.createConnector(
                connectorLayout.connectorType,
                connectorLayout.startPoint,
                connectorLayout.endPoint,
                intent.startShapeId || null,
                intent.endShapeId || null
              );
            }
          } else if (type === 'freehand') {
            // Handle freehand shapes specially
            const freehandIntent = intent;
            if (freehandIntent.points) {
               newShape = this.diagramManager.createFreehandShape(
                 freehandIntent.points,
                 freehandIntent.markerType || 'pen'
               );
            }
          } else if (type === 'image') {
            newShape = this.diagramManager.createImageShape(
              layout.x,
              layout.y,
              intent.imageUrl,
              intent.text || intent.imageName,
              intent.squareIcon
            );
          } else {
            // Regular shapes
            newShape = this.diagramManager.createShape(
              type,
              layout.x,
              layout.y
            );
          }

          if (newShape) {
            // Restore the original ID
            newShape.id = shapeData.id;
            newShape.element.dataset.shapeId = shapeData.id;
            
            // Apply properties
            this.updateShapeFromSnapshot(newShape, shapeData);
            // Restore parentId
            newShape.parentId = layout.parentId ?? null;
          }
        }
      };

      // Pass 1: Restore all non-connector shapes first
      // This ensures that when we restore connectors, their anchor shapes are already in place
      nonConnectors.forEach(processShapeSnapshot);

      // Pass 2: Restore connectors
      // Now that anchor shapes are restored/updated, connectors will attach correctly
      connectors.forEach(processShapeSnapshot);

      // Restore selection only if not skipped
      if (!skipSelection) {
        this.diagramManager.deselectAllShapes();
        snapshot.selectedShapeIds.forEach(id => {
          const shape = this.diagramManager.getShapeById(id);
          if (shape) {
            this.diagramManager.selectShape(shape);
          }
        });
      } else {
        // If skipping selection, we still need to make sure currently selected shapes are updated visually
        // (e.g. if they moved due to remote changes, the selection overlay needs to move too)
        this.diagramManager.updateSelectionOverlay();
      }

      // Restore groups registry
      this.diagramManager.setGroups(snapshot.groups || {});

      // Update selection overlay
      this.diagramManager.updateSelectionOverlay();
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Update an existing shape from snapshot data
   */
  private updateShapeFromSnapshot(shape: DiagramShape, data: ShapeData): void {
    const { type, layout, intent, appearance } = data as any;

    // For connectors, don't use resize() as it doesn't work properly with their point-based system
    if (type !== 'connector') {
      shape.layout.resize(layout.x, layout.y, layout.width, layout.height);
      // Only apply fill properties to non-connector shapes
      shape.appearance.fill = appearance.fill;
      shape.appearance.fillOpacity = appearance.fillOpacity ?? 1;
      if (appearance.fillStyle) {
        shape.appearance.fillStyle = appearance.fillStyle as any;
      }

      if (type === 'rectangle') {
        if (intent.iconKey) shape.iconKey = intent.iconKey;
        (shape as any).iconContent = intent.iconContent ?? null;
        (shape as any).hasIconPlaceholder = intent.hasIconPlaceholder ?? false;
      }
    }
    // Connectors should never have fills - skip fill properties for them
    shape.appearance.stroke = appearance.stroke;
    shape.appearance.strokeWidth = appearance.strokeWidth;
    shape.appearance.strokeOpacity = appearance.strokeOpacity ?? 1;

    if (appearance.strokeStyle) {
      shape.appearance.strokeStyle = appearance.strokeStyle as any;
    }
    if (appearance.strokeDrawStyle) {
      shape.appearance.strokeDrawStyle = appearance.strokeDrawStyle as any;
    }
    if (appearance.fillDrawStyle) {
      shape.appearance.fillDrawStyle = appearance.fillDrawStyle as any;
    }
    if (appearance.drawStyle && !appearance.strokeDrawStyle) {
      // Legacy alias: drawStyle maps to strokeDrawStyle
      shape.appearance.drawStyle = appearance.drawStyle as any;
    }

    if (intent.text) shape.text = intent.text;

    // Apply text style properties from Appearance
    if (appearance.fontSize !== undefined) shape.appearance.fontSize = appearance.fontSize;
    if (appearance.fontFamily !== undefined) shape.appearance.fontFamily = appearance.fontFamily;
    if (appearance.fontWeight !== undefined) shape.appearance.fontWeight = appearance.fontWeight;
    if (appearance.fontStyle !== undefined) shape.appearance.fontStyle = appearance.fontStyle;
    if (appearance.textDecoration !== undefined) shape.appearance.textDecoration = appearance.textDecoration;
    if (appearance.textAlign !== undefined) shape.appearance.textAlign = appearance.textAlign;
    if (appearance.textJustify !== undefined) shape.appearance.textJustify = appearance.textJustify;
    if (appearance.textColor !== undefined) shape.appearance.textColor = appearance.textColor;
    
    // Restore connector-specific properties
    if (type === 'connector') {
      const connector = shape as any;
      const connLayout = layout; // Specific Connector Layout
      const connIntent = intent;

      if (connLayout.startPoint && connLayout.endPoint) {
        connector.setStartPoint(connLayout.startPoint.x, connLayout.startPoint.y);
        connector.setEndPoint(connLayout.endPoint.x, connLayout.endPoint.y);
      }

      connector.startShapeId = connIntent.startShapeId || null;
      connector.endShapeId = connIntent.endShapeId || null;
      connector.startConnectorPoint = connIntent.startConnectorPoint || null;
      connector.endConnectorPoint = connIntent.endConnectorPoint || null;

      // Restore midpoint properties for curved connectors
      if (connLayout.connectorType === 'curved') {
        if (connLayout.midpointMode !== undefined) connector.midpointMode = connLayout.midpointMode;
        if (connLayout.midpointRatio !== undefined) connector.midpointRatio = connLayout.midpointRatio;
        if (connLayout.midpointOffset !== undefined) connector.midpointOffset = connLayout.midpointOffset;
        if (connLayout.customMidpoint !== undefined) connector.customMidpoint = connLayout.customMidpoint;
      }
      // Restore arrowhead types
      if (connIntent.startArrowheadType !== undefined) connector.startArrowheadType = connIntent.startArrowheadType;
      if (connIntent.endArrowheadType !== undefined) connector.endArrowheadType = connIntent.endArrowheadType;

      // Update connector points to match attached shapes
      connector.updateConnectorPoints();

      // Restore animated state
      if (connIntent.animated !== undefined) connector.setAnimated(connIntent.animated);
      // Restore label position
      if (connIntent.labelPosition !== undefined) connector.setLabelPosition(connIntent.labelPosition);
    }

    // Restore freehand-specific properties
    if (type === 'freehand') {
      const freehand = shape as FreehandShape;
      const freehandIntent = intent;
      // Restore points
      freehand.points = [...freehandIntent.points];
      // Restore marker type
      if (freehandIntent.markerType) {
        freehand.setMarkerType(freehandIntent.markerType);
      }
      freehand.state.needsRender = true;
    }

    // Restore ReactShape (service-card, todo-card) specific properties
    if ((type === 'service-card' || type === 'todo-card') && intent.data) {
      const reactShape = shape as ReactShape
      reactShape.updateData(intent.data)
    }

    // Restore Frame
    if (type === 'frame') {
      const frame = shape as any;
      if (intent.labelText) frame.labelText = intent.labelText;
      if (intent.collapsed !== undefined) frame.collapsed = intent.collapsed;
      if (intent.iconContent !== undefined) frame.iconContent = intent.iconContent;
      if (intent.hasIconPlaceholder !== undefined) frame.hasIconPlaceholder = intent.hasIconPlaceholder;
      frame.needsRender = true;
      frame.render();
    }

    this.diagramManager.updateShapeText(shape);
  }

  /**
   * Serialize a shape to snapshot data
   */
  private serializeShape(shape: DiagramShape): ShapeData {
    // 1. Common Layout
    const layout: any = {
      x: shape.layout.x,
      y: shape.layout.y,
      width: shape.layout.width,
      height: shape.layout.height,
      parentId: shape.parentId,
      frameId: (shape.layout as any).frameId
    };

    // 2. Common Appearance
    const appearance: any = {
      opacity: 1,
      stroke: shape.appearance.stroke,
      strokeWidth: shape.appearance.strokeWidth,
      strokeOpacity: shape.appearance.strokeOpacity,
      strokeStyle: shape.appearance.strokeStyle as any,
      strokeDrawStyle: shape.appearance.strokeDrawStyle,
      fill: shape.appearance.fill,
      fillOpacity: shape.appearance.fillOpacity,
      fillStyle: shape.appearance.fillStyle as any,
      fillDrawStyle: shape.appearance.fillDrawStyle,
      drawStyle: shape.appearance.drawStyle,
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

  /**
   * Check if currently restoring (to prevent recording during restore)
   */
  public isCurrentlyRestoring(): boolean {
    return this.isRestoring;
  }

  /**
   * Compare two snapshots to check if they're equal
   */
  private snapshotsAreEqual(a: CanvasSnapshot, b: CanvasSnapshot): boolean {
    // Check if number of shapes is different
    if (a.shapes.length !== b.shapes.length) return false;

    // Check if selection is different
    if (a.selectedShapeIds.length !== b.selectedShapeIds.length) return false;
    if (!a.selectedShapeIds.every((id, i) => id === b.selectedShapeIds[i])) return false;

    // Check if shapes are different (compare by ID and all properties by serializing to JSON)
    // Using JSON stringify is the simplest way to deep compare the nested structure
    // Since ShapeData is pure data, this is safe and effective
    for (let i = 0; i < a.shapes.length; i++) {
      const shapeA = a.shapes[i];
      const shapeB = b.shapes[i];

      if (JSON.stringify(shapeA) !== JSON.stringify(shapeB)) {
        return false;
      }
    }

    // Compare groups registry
    const groupsA = Object.keys(a.groups || {});
    const groupsB = Object.keys(b.groups || {});
    if (groupsA.length !== groupsB.length) return false;
    for (const groupId of groupsA) {
      if (!b.groups?.[groupId]) return false;
      if (a.groups[groupId].parentId !== b.groups[groupId].parentId) return false;
    }

    return true;
  }
}

