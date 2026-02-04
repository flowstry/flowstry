/**
 * Workspace Storage Plugin
 * A StoragePlugin that saves diagram data to the workspace store (IndexedDB)
 * Uses the existing workspaceStore for persistence
 */

import { CanvasSettings, DiagramData, LoadOptions, SaveOptions, StoragePlugin } from '@canvas';
import { DEFAULT_DIAGRAM_ID, DEFAULT_WORKSPACE_ID, workspaceStore } from './workspace-store';

const CURRENT_VERSION = '1.0.0';
const SETTINGS_KEY = 'workspace-settings';

/**
 * Storage plugin that saves diagrams to the workspace store
 * Each instance is configured with a specific workspace and diagram ID
 */
export class WorkspaceStoragePlugin extends StoragePlugin {
  readonly name = 'workspace';
  readonly type = 'local' as const;
  
  private workspaceId: string;
  private diagramId: string;
  private initialized = false;

  constructor(
    workspaceId: string = DEFAULT_WORKSPACE_ID,
    diagramId: string = DEFAULT_DIAGRAM_ID
  ) {
    super();
    this.workspaceId = workspaceId;
    this.diagramId = diagramId;
  }

  /**
   * Ensure workspace store is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await workspaceStore.init();
      this.initialized = true;
    }
  }

  /**
   * Update the diagram ID (useful when navigating between diagrams)
   */
  setDiagramId(diagramId: string): void {
    this.diagramId = diagramId;
  }

  /**
   * Get current diagram ID
   */
  getDiagramId(): string {
    return this.diagramId;
  }

  /**
   * Update the workspace ID
   */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId;
  }

  /**
   * Get current workspace ID
   */
  getWorkspaceId(): string {
    return this.workspaceId;
  }

  async save(data: DiagramData, options?: SaveOptions): Promise<boolean> {
    try {
      await this.ensureInit();

      // Add version and timestamp metadata
      const dataToSave: DiagramData = {
        ...data,
        version: CURRENT_VERSION,
        metadata: {
          ...data.metadata,
          ...(options?.metadata || {}),
          updatedAt: new Date().toISOString(),
          createdAt: data.metadata?.createdAt || new Date().toISOString()
        }
      };

      // Save to workspace store (local)
      // Cloud sync happens at workspace level, not per-diagram
      await workspaceStore.saveDiagram(this.diagramId, dataToSave, data.name);

      return true;
    } catch (error) {
      console.error('WorkspaceStoragePlugin: Failed to save:', error);
      return false;
    }
  }


  async load(options?: LoadOptions): Promise<DiagramData | null> {
    try {
      await this.ensureInit();

      const diagram = await workspaceStore.getDiagram(this.diagramId);
      if (!diagram || !diagram.data) {
        return null;
      }

      return diagram.data;
    } catch (error) {
      console.error('WorkspaceStoragePlugin: Failed to load:', error);
      return null;
    }
  }

  async hasData(): Promise<boolean> {
    try {
      await this.ensureInit();
      const diagram = await workspaceStore.getDiagram(this.diagramId);
      return diagram !== null && diagram.data !== undefined;
    } catch {
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await this.ensureInit();
      // Clear diagram data but keep the diagram entry
      const diagram = await workspaceStore.getDiagram(this.diagramId);
      if (diagram) {
        await workspaceStore.saveDiagram(this.diagramId, undefined as any);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<Record<string, any> | null> {
    try {
      await this.ensureInit();
      const diagram = await workspaceStore.getDiagram(this.diagramId);
      if (!diagram || !diagram.data) {
        return null;
      }
      return diagram.data.metadata || null;
    } catch {
      return null;
    }
  }

  async saveSettings(settings: CanvasSettings): Promise<boolean> {
    // Deprecated: Settings are now handled by SettingsManager (UI) and DiagramData (Canvas)
    return true;
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    // Deprecated: Settings are now handled by SettingsManager (UI) and DiagramData (Canvas)
    return null;
  }
}
