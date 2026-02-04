import { DiagramManager } from '../../shapes';
import { DiagramShape } from '../../shapes/base';
import { RectangleShape } from '../../shapes/basic/rectangle';
import { ConnectorShape } from '../../shapes/connectors/base';
import { BentConnector } from '../../shapes/connectors/bent/BentConnector';
import { CurvedConnector } from '../../shapes/connectors/CurvedConnector';
import { FrameShape } from '../../shapes/FrameShape';
import { FreehandShape } from '../../shapes/freehand';
import { ImageShape } from '../../shapes/image/base';
import { ReactShape } from '../../shapes/react/ReactShape';
import { CanvasSettings, SettingsManager } from '../SettingsManager';
import { LocalStoragePlugin } from './LocalStoragePlugin';
import { DiagramData, LoadOptions, SaveOptions, StoragePlugin } from './StoragePlugin';
import {
  ConnectorIntent,
  ConnectorLayout,
  FrameIntent,
  ShapeAppearanceData,
  ShapeData,
  ShapeLayoutData
} from './types';

/**
 * StorageManager coordinates diagram persistence across different storage plugins
 * Supports multiple backends: localStorage, file export, cloud storage, etc.
 * 
 * Automatically creates and registers a default LocalStoragePlugin to ensure
 * storage is always available.
 */
export class StorageManager {
  private diagramManager: DiagramManager;
  private settingsManager: SettingsManager;
  private plugins: Map<string, StoragePlugin> = new Map();
  private activePlugin: StoragePlugin | null = null;
  private defaultPlugin: LocalStoragePlugin;
  private autoSaveEnabled: boolean = false;
  private autoSaveInterval: number = 30000; // 30 seconds
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;
  private isLoading: boolean = false; // Flag to prevent saves during load
  private onPluginChange: (() => void) | null = null; // Callback when active plugin changes
  private currentFilename: string | undefined; // Current diagram filename for persistence

  constructor(diagramManager: DiagramManager, settingsManager?: SettingsManager) {
    this.diagramManager = diagramManager;
    this.settingsManager = settingsManager || null as any; // Will be set later if needed
    
    // Automatically create and register default LocalStoragePlugin
    // This ensures storage is always available
    this.defaultPlugin = new LocalStoragePlugin();
    this.registerPlugin(this.defaultPlugin);
    this.activePlugin = this.defaultPlugin;
  }

  /**
   * Register a storage plugin
   */
  registerPlugin(plugin: StoragePlugin): void {
    this.plugins.set(plugin.name, plugin);
    
    // Set as active plugin if none is set
    if (!this.activePlugin) {
      this.activePlugin = plugin;
    }
  }

  /**
   * Unregister a storage plugin
   * Cannot unregister the default LocalStoragePlugin
   */
  unregisterPlugin(pluginName: string): void {
    // Prevent unregistering the default plugin
    if (pluginName === this.defaultPlugin.name) {
      console.warn(`Cannot unregister default plugin "${pluginName}"`);
      return;
    }
    
    const plugin = this.plugins.get(pluginName);
    if (plugin === this.activePlugin) {
      // If unregistering the active plugin, fallback to default
      this.activePlugin = this.defaultPlugin;
    }
    this.plugins.delete(pluginName);
  }

  /**
   * Set the active storage plugin
   */
  setActivePlugin(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.error(`Plugin "${pluginName}" not found`);
      return false;
    }
    this.activePlugin = plugin;

    // Notify that plugin changed - settings should be reloaded from new plugin
    if (this.onPluginChange) {
      this.onPluginChange();
    }

    return true;
  }

  /**
   * Get the active storage plugin
   */
  getActivePlugin(): StoragePlugin | null {
    return this.activePlugin;
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(pluginName: string): StoragePlugin | null {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): StoragePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Save diagram using active plugin
   */
  async save(options?: SaveOptions): Promise<boolean> {
    // Don't save if we're currently loading
    if (this.isLoading) {
      return false;
    }
    
    // Ensure we have an active plugin (fallback to default if needed)
    if (!this.activePlugin) {
      this.activePlugin = this.defaultPlugin;
    }

    const name = options?.metadata?.filename;
    const data = this.serializeDiagram(name);
    const result = await this.activePlugin.save(data, options);
    
    if (result) {
      this.isDirty = false;
    }
    
    return result;
  }

  /**
   * Save diagram using a specific plugin
   */
  async saveWith(pluginName: string, options?: SaveOptions): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.error(`Plugin "${pluginName}" not found`);
      return false;
    }

    const name = options?.metadata?.filename;
    const data = this.serializeDiagram(name);
    return await plugin.save(data, options);
  }

  /**
   * Load diagram using active plugin
   */
  async load(options?: LoadOptions): Promise<{ success: boolean, name?: string }> {
    // Ensure we have an active plugin (fallback to default if needed)
    if (!this.activePlugin) {
      this.activePlugin = this.defaultPlugin;
    }

    const data = await this.activePlugin.load(options);
    if (!data) {
      return { success: false };
    }

    // Set loading flag to prevent saves during restoration
    this.isLoading = true;
    try {
      const result = this.deserializeDiagram(data, options?.merge);
      return result;
    } finally {
      // Always clear loading flag, even if there's an error
      this.isLoading = false;
    }
  }

  /**
   * Load diagram using a specific plugin
   */
  async loadFrom(pluginName: string, options?: LoadOptions): Promise<{ success: boolean, name?: string }> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.error(`Plugin "${pluginName}" not found`);
      return { success: false };
    }

    const data = await plugin.load(options);
    if (!data) {
      return { success: false };
    }

    // Set loading flag to prevent saves during restoration
    this.isLoading = true;
    try {
      const result = this.deserializeDiagram(data, options?.merge);
      return result;
    } finally {
      // Always clear loading flag, even if there's an error
      this.isLoading = false;
    }
  }

  /**
   * Check if active plugin has saved data
   */
  async hasData(): Promise<boolean> {
    const plugin = this.activePlugin || this.defaultPlugin;
    return await plugin.hasData();
  }

  /**
   * Clear saved data from active plugin
   */
  async clear(): Promise<boolean> {
    const plugin = this.activePlugin || this.defaultPlugin;
    return await plugin.clear();
  }

  /**
   * Get metadata from active plugin
   */
  async getMetadata(): Promise<Record<string, any> | null> {
    const plugin = this.activePlugin || this.defaultPlugin;
    return await plugin.getMetadata();
  }

  /**
   * Load diagram directly from data object (no plugin involved)
   * Used when loading from external sources like workspace store
   */
  loadFromData(data: DiagramData, options?: { merge?: boolean }): { success: boolean, name?: string } {
    // Set loading flag to prevent saves during restoration
    this.isLoading = true;
    try {
      const result = this.deserializeDiagram(data, options?.merge);
      return result;
    } finally {
      // Always clear loading flag, even if there's an error
      this.isLoading = false;
    }
  }

  /**
   * Serialize current diagram to data format
   * Returns the diagram data without saving to any plugin
   */
  serialize(name?: string): DiagramData {
    return this.serializeDiagram(name);
  }

  /**
   * Save settings using active plugin
   */
  async saveSettings(settings: CanvasSettings): Promise<boolean> {
    const plugin = this.activePlugin || this.defaultPlugin;
    return await plugin.saveSettings(settings);
  }

  /**
   * Load settings using active plugin
   */
  async loadSettings(): Promise<CanvasSettings | null> {
    const plugin = this.activePlugin || this.defaultPlugin;
    return await plugin.loadSettings();
  }

  /**
   * Set callback for when active plugin changes
   * This is used to notify SettingsManager to reload settings from the new plugin
   */
  setOnPluginChange(callback: (() => void) | null): void {
    this.onPluginChange = callback;
  }

  /**
   * Set the current diagram filename
   * This is used to persist the filename across auto-saves
   */
  setFilename(name: string | undefined): void {
    this.currentFilename = name;
  }

  /**
   * Get the current diagram filename
   */
  getFilename(): string | undefined {
    return this.currentFilename;
  }

  /**
   * Mark the diagram as dirty (needs saving)
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Check if diagram has unsaved changes
   */
  isDiagramDirty(): boolean {
    return this.isDirty;
  }

  /**
   * Enable auto-save functionality
   */
  enableAutoSave(intervalMs?: number): void {
    if (intervalMs) {
      this.autoSaveInterval = intervalMs;
    }
    
    this.autoSaveEnabled = true;
    this.startAutoSave();
  }

  /**
   * Disable auto-save functionality
   */
  disableAutoSave(): void {
    this.autoSaveEnabled = false;
    this.stopAutoSave();
  }

  /**
   * Check if auto-save is enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled;
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave(); // Clear any existing timer
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty && this.autoSaveEnabled) {
        await this.save({ autoSave: true });
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Serialize current diagram to data format
   */
  private serializeDiagram(name?: string): DiagramData {
    const shapes = this.diagramManager.getShapes();
    // Use provided name, fall back to stored filename
    const diagramName = name ?? this.currentFilename;
    
    return {
      version: '2.0.0', // Bump version for new structure
      name: diagramName,
      shapes: shapes.map(shape => this.serializeShape(shape)),
      groups: this.diagramManager.getGroups(), // Include groups registry
      settings: this.settingsManager.getSettings()
    };
  }

  /**
   * Serialize a single shape
   */
  private serializeShape(shape: DiagramShape): ShapeData {
    // 1. Common Layout
    const layout: ShapeLayoutData = shape.layout.toJSON();

    // 2. Common Appearance
    const appearance: ShapeAppearanceData = shape.appearance.toJSON();

    // 3. Shape Specific Intent & Layout extensions
    const base = {
      id: shape.id,
      options: (shape as any).options,
    };

    // --- Connector ---
    if (shape.type === 'connector') {
      const connector = shape as ConnectorShape;
      const connectorIntent: ConnectorIntent = {
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

      const connectorLayout: ConnectorLayout = {
        ...layout,
        connectorType: connector.connectorType,
        startPoint: connector.startPoint,
        endPoint: connector.endPoint,
        pointsStraight: connector.pointsStraight,
        pointsBent: connector.pointsBent,
        pointsCurved: connector.pointsCurved,
      };

      if (connector.connectorType === 'bent') {
        const bent = connector as BentConnector;
        connectorLayout.bentConnectorRoutingMode = bent.routingMode;
        connectorLayout.hasUserModifiedPath = bent.hasUserModifiedPath;
        connectorLayout.bentConnectorSegments = bent.segments?.map((seg: any) => ({
          axis: seg.axis,
          value: seg.value,
          start: seg.start,
          end: seg.end,
          locked: seg.locked
        }));
      } else if (connector.connectorType === 'curved') {
        const curved = connector as CurvedConnector;
        connectorLayout.midpointMode = curved.midpointMode;
        connectorLayout.midpointRatio = curved.midpointRatio;
        connectorLayout.midpointOffset = curved.midpointOffset;
        connectorLayout.customMidpoint = curved.customMidpoint;
      }

      // Connectors usually don't have fill, override appearance if needed
      appearance.fill = 'none';

      return {
        ...base,
        type: 'connector',
        intent: connectorIntent,
        layout: connectorLayout,
        appearance
      };
    }

    // --- Image ---
    if (shape.type === 'image') {
      const imageShape = shape as ImageShape;
      return {
        ...base,
        type: 'image',
        intent: {
          imageUrl: imageShape.imageUrl || '',
          imageName: shape.text, // Mapping text to imageName for images
          squareIcon: imageShape.squareIcon,
          text: shape.text
        },
        layout,
        appearance
      };
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
      };
    }

    // --- Frame ---
    if (shape.type === 'frame') {
      const frame = shape as unknown as FrameShape;
      return {
        ...base,
        type: 'frame',
        intent: {
          labelText: frame.labelText,
          collapsed: frame.collapsed,
          isNestedFrame: frame.isNestedFrame,
          childIds: frame.childIds ? [...frame.childIds] : [],
          childFrameIds: frame.childFrameIds ? [...frame.childFrameIds] : [],
          iconContent: frame.iconContent ?? undefined,
          hasIconPlaceholder: frame.hasIconPlaceholder
        },
        layout,
        appearance
      };
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
      };
    }

    // --- Rectangle ---
    if (shape.type === 'rectangle') {
      const rect = shape as RectangleShape;
      return {
        ...base,
        type: 'rectangle',
        intent: {
          text: shape.text,
          iconKey: shape.iconKey,
          hasIconPlaceholder: rect.hasIconPlaceholder,
          iconContent: rect.iconContent ?? undefined
        },
        layout,
        appearance
      };
    }

    // --- Geometric (Default Fallback) ---
    // Ellipse, Diamond, Triangle, etc.
    return {
      ...base,
      type: shape.type as ShapeData['type'], // Validated by ShapeData union
      intent: {
        text: shape.text
      },
      layout,
      appearance
    } as ShapeData;
  }

  /**
   * Helper to migrate legacy shape data (flat) to new structure (nested)
   */
  private migrateLegacyShape(data: any): ShapeData {
    // If it already has intent/layout, return as is
    if (data.intent && data.layout) {
      return data as ShapeData;
    }

    // Migration Logic
    const layout = {
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      parentId: data.parentId,
      frameId: data.frameId
    };

    const appearance = {
      stroke: data.stroke,
      strokeWidth: data.strokeWidth,
      strokeOpacity: data.strokeOpacity,
      strokeStyle: data.strokeStyle,
      fill: data.fill,
      fillOpacity: data.fillOpacity,
      fillStyle: data.fillStyle,
      textColor: data.textColor,
      fontSize: data.fontSize,
      fontFamily: data.fontFamily,
      fontWeight: data.fontWeight,
      fontStyle: data.fontStyle,
      textDecoration: data.textDecoration,
      textAlign: data.textAlign,
      textJustify: data.textJustify,
      drawStyle: data.drawStyle // Restore drawStyle from legacy data (if present)
    };



    const base = {
      id: data.id,
      options: data.options
    };

    if (data.type === 'connector') {
      return {
        ...base,
        type: 'connector',
        intent: {
          text: data.text,
          startShapeId: data.startShapeId,
          endShapeId: data.endShapeId,
          startConnectorPoint: data.startConnectorPoint,
          endConnectorPoint: data.endConnectorPoint,
          startArrowheadType: data.startArrowheadType,
          endArrowheadType: data.endArrowheadType,
          animated: data.animated,
          labelPosition: data.labelPosition
        },
        layout: {
          ...layout,
          connectorType: data.connectorType,
          startPoint: data.startPoint,
          endPoint: data.endPoint,
          pointsStraight: data.pointsStraight,
          pointsBent: data.pointsBent,
          pointsCurved: data.pointsCurved,
          hasUserModifiedPath: data.hasUserModifiedPath,
          bentConnectorSegments: data.bentConnectorSegments,
          bentConnectorRoutingMode: data.bentConnectorRoutingMode,
          midpointMode: data.midpointMode,
          midpointRatio: data.midpointRatio,
          midpointOffset: data.midpointOffset,
          customMidpoint: data.customMidpoint
        },
        appearance
      } as any;
    }

    if (data.type === 'image') {
      return {
        ...base,
        type: 'image',
        intent: {
          imageUrl: data.imageUrl,
          imageName: data.imageName || data.text,
          squareIcon: data.squareIcon,
          text: data.text
        },
        layout,
        appearance
      } as any;
    }

    if (data.type === 'freehand') {
      return {
        ...base,
        type: 'freehand',
        layout,
        appearance,
        intent: {
          points: data.freehandPoints || [],
          markerType: data.freehandMarkerType
        }
      } as any;
    }

    if (data.type === 'frame') {
      return {
        ...base,
        type: 'frame',
        layout,
        appearance,
        intent: {
          labelText: data.labelText || data.text,
          collapsed: data.collapsed,
          isNestedFrame: data.isNestedFrame,
          childIds: data.childIds,
          childFrameIds: data.childFrameIds,
          iconContent: data.iconContent,
          hasIconPlaceholder: data.hasIconPlaceholder
        }
      } as any;
    }

    if (data.type === 'service-card' || data.type === 'todo-card') {
      return {
        ...base,
        type: data.type,
        layout,
        appearance,
        intent: {
          data: data.reactShapeData || {}
        }
      } as any;
    }

    if (data.type === 'rectangle') {
      return {
        ...base,
        type: 'rectangle',
        layout,
        appearance,
        intent: {
          text: data.text,
          iconKey: data.iconKey,
          hasIconPlaceholder: data.hasIconPlaceholder,
          iconContent: data.iconContent
        }
      } as any;
    }

    // Default Geometric
    return {
      ...base,
      type: data.type,
      layout,
      appearance,
      intent: {
        text: data.text
      }
    } as any;
  }

  /**
   * Deserialize diagram data and apply to canvas
   */
  private deserializeDiagram(data: DiagramData, merge: boolean = false): { success: boolean, name?: string } {
    try {
      // Suppress timestamp updates during deserialization
      DiagramShape.setSuppressTimestampUpdates(true);

      try {
        // If not merging, clear existing shapes and groups
        if (!merge) {
          const existingShapes = this.diagramManager.getShapes();
          existingShapes.forEach(shape => {
            this.diagramManager.removeShape(shape);
          });
          this.diagramManager.clearGroups();
        }

        // Create shapes from data
        data.shapes.forEach(legacyOrNewShapeData => {
          // 1. Migrate to new structure if needed
          const shapeData = this.migrateLegacyShape(legacyOrNewShapeData);

          let shape: DiagramShape | null = null;

          const { layout, intent, appearance, type, id } = shapeData;

          // --- Connectors ---
          if (type === 'connector') {
            const connectorLayout = layout; // Has connector specific props
            if (connectorLayout.connectorType && connectorLayout.startPoint && connectorLayout.endPoint) {
              shape = this.diagramManager.createConnector(
                connectorLayout.connectorType,
                connectorLayout.startPoint,
                connectorLayout.endPoint,
                intent.startShapeId || null,
                intent.endShapeId || null
              );
            }
          }
          // --- Freehand ---
          else if (type === 'freehand') {
            if (intent.points) {
              shape = this.diagramManager.createFreehandShape(
                intent.points,
                intent.markerType || 'pen'
              );
            }
          }
          // --- Regular Shapes ---
          else {
            // For Image, Intent has imageUrl. For others, it might not.
            // createShape signature: (type, x, y, imageUrl?, imageName?, squareIcon?)
            const imageUrl = (type === 'image') ? intent.imageUrl : undefined;
            const imageName = (type === 'image') ? intent.imageName : undefined;
            const squareIcon = (type === 'image') ? intent.squareIcon : undefined;

            shape = this.diagramManager.createShape(
              type,
              layout.x,
              layout.y,
              imageUrl,
              imageName,
              squareIcon
            );
          }

          if (shape) {
            // Restore Common properties
            shape.id = id;
            shape.element.dataset.shapeId = id;
            shape.layout.parentId = layout.parentId ?? null;
            if (layout.frameId !== undefined) {
              shape.layout.frameId = layout.frameId;
            }

            // Layout
            if (type !== 'connector') {
              shape.layout.resize(layout.x, layout.y, layout.width, layout.height);

              // Appearance (Fill)
              shape.appearance.fill = appearance.fill || 'none';
              shape.appearance.fillOpacity = appearance.fillOpacity ?? 1;
              if (appearance.fillStyle) shape.appearance.fillStyle = appearance.fillStyle;

              // Rectangle specifics
              if (type === 'rectangle') {
                if (intent.iconKey) shape.iconKey = intent.iconKey;
                (shape as any).iconContent = intent.iconContent ?? null;
                (shape as any).hasIconPlaceholder = intent.hasIconPlaceholder ?? false;
              }
            } else {
              // Connector Specific Restoration from Layout & Intent
              const connector = shape as ConnectorShape;
              const connLayout = layout as ConnectorLayout;
              const connIntent = intent as ConnectorIntent;

              if (connIntent.startArrowheadType) connector.startArrowheadType = connIntent.startArrowheadType;
              if (connIntent.endArrowheadType) connector.endArrowheadType = connIntent.endArrowheadType;

              if (connLayout.pointsStraight) connector.pointsStraight = connLayout.pointsStraight;
              if (connLayout.pointsBent) connector.pointsBent = connLayout.pointsBent;
              if (connLayout.pointsCurved) connector.pointsCurved = connLayout.pointsCurved;

              if (connector instanceof CurvedConnector) {
                if (connLayout.midpointMode) connector.midpointMode = connLayout.midpointMode as any;
                if (connLayout.midpointRatio !== undefined) connector.midpointRatio = connLayout.midpointRatio;
                if (connLayout.midpointOffset !== undefined) connector.midpointOffset = connLayout.midpointOffset;
                if (connLayout.customMidpoint) connector.customMidpoint = connLayout.customMidpoint;
              }

              if (connector instanceof BentConnector) {
                if (connLayout.hasUserModifiedPath !== undefined) connector.hasUserModifiedPath = connLayout.hasUserModifiedPath;
                if (connLayout.bentConnectorRoutingMode) connector.routingMode = connLayout.bentConnectorRoutingMode;

                if (connLayout.bentConnectorSegments) {
                  // Map segments back
                  connector.segments = connLayout.bentConnectorSegments.map((seg: any) => ({
                    axis: seg.axis,
                    value: seg.value,
                    start: seg.start,
                    end: seg.end,
                    locked: seg.locked
                  }));
                  // Sync pointsBent from segments if needed (requires segmentManager)
                  // Note: In typical flowstry usage, updating segments recalculates points automatically or via explicit call
                  // We assume pointsBent restoration above handles visual state, segments handle logical state.
                }
              }

              if (connIntent.startConnectorPoint) connector.startConnectorPoint = connIntent.startConnectorPoint;
              if (connIntent.endConnectorPoint) connector.endConnectorPoint = connIntent.endConnectorPoint;

              if (connIntent.animated !== undefined) connector.setAnimated(connIntent.animated);
              if (connIntent.labelPosition !== undefined) connector.setLabelPosition(connIntent.labelPosition);
            }

            // Common Appearance (Stroke & Text)
            // Common Appearance (Stroke & Text)
            shape.appearance.stroke = appearance.stroke || '#000000';
            shape.appearance.strokeWidth = appearance.strokeWidth ?? 1;
            shape.appearance.strokeOpacity = appearance.strokeOpacity ?? 1;
            if (appearance.strokeStyle) shape.appearance.strokeStyle = appearance.strokeStyle;
            if (appearance.strokeDrawStyle) shape.appearance.strokeDrawStyle = appearance.strokeDrawStyle;
            if (appearance.fillDrawStyle) shape.appearance.fillDrawStyle = appearance.fillDrawStyle;
            if (appearance.drawStyle) shape.appearance.drawStyle = appearance.drawStyle;

            // Intent Text (or Appearance Text Style)
            // Note: intent.text contains the content. appearance contains the style.
            if ('text' in intent && intent.text) shape.text = intent.text;

            // Text Styles
            if (appearance.fontSize !== undefined) shape.appearance.fontSize = appearance.fontSize;
            if (appearance.fontFamily !== undefined) shape.appearance.fontFamily = appearance.fontFamily;
            if (appearance.fontWeight !== undefined) shape.appearance.fontWeight = appearance.fontWeight;
            if (appearance.textDecoration !== undefined) shape.appearance.textDecoration = appearance.textDecoration;
            if (appearance.textAlign !== undefined) shape.appearance.textAlign = appearance.textAlign;
            if (appearance.textJustify !== undefined) shape.appearance.textJustify = appearance.textJustify;
            if (appearance.textColor !== undefined) shape.appearance.textColor = appearance.textColor;

            // Freehand
            if (type === 'freehand') {
              const freehand = shape as FreehandShape;
              // Points set at creation.
              // Marker type set at creation.
              // Just appearance already set above.
            }

            // React Data
            if ((type === 'service-card' || type === 'todo-card') && intent.data) {
              const reactShape = shape as ReactShape;
              reactShape.updateData(intent.data);
            }

            // Frame
            if (type === 'frame') {
              const frame = shape as unknown as FrameShape;
              const frIntent = intent as FrameIntent; // Infer intent type

              if (frIntent.labelText) frame.setLabel(frIntent.labelText);
              // Check properties existence on intent (FrameIntent has them)
              if (frIntent.collapsed !== undefined) frame.collapsed = frIntent.collapsed;
              if (frIntent.iconContent !== undefined) (frame as any).iconContent = frIntent.iconContent; // FrameShape might need iconContent property added to class if strict
              // Wait, FrameShape in my view had iconContent? No, I added it to Intent but maybe not class.
              // Let's assume frame.iconContent exists or cast to any for this specific property if needed, but try strict first.
              if (frIntent.hasIconPlaceholder !== undefined) (frame as any).hasIconPlaceholder = frIntent.hasIconPlaceholder;

              frame.state.needsRender = true;
              frame.render();
            }

            this.diagramManager.updateShapeText(shape);
          }
        });

        // Load settings from data (Canvas Theme & Snap to Grid)
        // Global UI settings are handled separately by SettingsManager
        if (data.settings && this.settingsManager) {
          // Identify which parts of settings are "canvas specific" vs "global"
          // We only want to restore canvas-specific settings from the diagram
          this.settingsManager.loadCanvasSettings(data.settings);
        }

        // Load logical groups from data
        if (data.groups) {
          this.diagramManager.setGroups(data.groups);
        }

        // Rebuild frame relationships and fix z-order
        // This ensures frame.childIds are populated and children are above frames
        this.diagramManager.rebuildFrameRelationshipsAndZOrder();

        // Store the loaded filename for future saves
        if (data.name) {
          this.currentFilename = data.name;
        }

        this.isDirty = false;
        return { success: true, name: data.name };
      } finally {
        // Re-enable timestamp updates after deserialization
        DiagramShape.setSuppressTimestampUpdates(false);
      }
    } catch (error) {
      console.error('Failed to deserialize diagram:', error);
      // Ensure timestamp updates are re-enabled even on error
      DiagramShape.setSuppressTimestampUpdates(false);
      return { success: false };
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSave();
    this.plugins.clear();
    this.activePlugin = null;
  }
}

