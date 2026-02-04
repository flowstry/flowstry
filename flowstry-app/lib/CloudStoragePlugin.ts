/**
 * Cloud Storage Plugin
 * A StoragePlugin that saves diagram data to the cloud via API
 */

import { CanvasSettings, DiagramData, LoadOptions, SaveOptions, StoragePlugin } from '@canvas';
import { createCompressedFlowstryBlob, decompressDiagramData } from './compression';
import { workspaceApiClient } from './workspace-client';

const CURRENT_VERSION = '1.0.0';
const SETTINGS_KEY = 'workspace-settings';
const CLOUD_SAVE_DEBOUNCE_MS = 2000; // 2 seconds debounce

/**
 * Storage plugin that saves diagrams to the cloud via API
 * Each instance is configured with a cloud workspace and diagram ID
 * 
 * Features:
 * - Debounced cloud saves to prevent server overload
 * - Direct GCS uploads via Signed URLs
 */
export class CloudStoragePlugin extends StoragePlugin {
  readonly name = 'cloud';
  readonly type = 'cloud' as const;
  
  private workspaceId: string;
  private diagramId: string;
  private onGetThumbnail: () => Promise<Blob | null>;
  private saveTimer: NodeJS.Timeout | null = null;
  private pendingSaveData: DiagramData | null = null;

  constructor(workspaceId: string, diagramId: string, onGetThumbnail: () => Promise<Blob | null>) {
    super();
    this.workspaceId = workspaceId;
    this.diagramId = diagramId;
    this.onGetThumbnail = onGetThumbnail;
  }

  /**
   * Update the diagram ID
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

      // Debounce cloud save
      this.pendingSaveData = dataToSave;

      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }

      this.saveTimer = setTimeout(async () => {
        if (!this.pendingSaveData) return;

        try {
          console.log('Syncing to cloud...');
          // Compress and upload to cloud using signed URL (handled by client)
          const blob = createCompressedFlowstryBlob(this.pendingSaveData);
          const objectName = await workspaceApiClient.uploadDiagramFile(this.workspaceId, this.diagramId, blob);

          // Generate and upload thumbnail
          let thumbnailObjectName: string | undefined;
          try {
            console.log('CloudStoragePlugin: Requesting thumbnail...');
            const thumbnailBlob = await this.onGetThumbnail();
            if (thumbnailBlob) {
              console.log('CloudStoragePlugin: Got thumbnail blob, uploading...', thumbnailBlob.size);
              thumbnailObjectName = await workspaceApiClient.uploadDiagramThumbnail(this.workspaceId, this.diagramId, thumbnailBlob);
              console.log('CloudStoragePlugin: Thumbnail uploaded:', thumbnailObjectName);
            } else {
              console.warn('CloudStoragePlugin: Thumbnail blob is null, skipping upload');
            }
          } catch (err) {
            console.error('Failed to upload thumbnail:', err);
            // Non-critical, continue
          }

          // Update diagram metadata with new file/thumbnail paths
          await workspaceApiClient.updateDiagram(this.workspaceId, this.diagramId, {
            thumbnail: thumbnailObjectName,
            file_url: objectName
          });

          console.log('Cloud sync complete');
          this.pendingSaveData = null;
        } catch (err) {
          console.error('Background cloud save failed:', err);
        }
      }, CLOUD_SAVE_DEBOUNCE_MS);

      return true;
    } catch (error) {
      console.error('CloudStoragePlugin: Failed to save:', error);
      return false;
    }
  }

  async load(options?: LoadOptions): Promise<DiagramData | null> {
    try {
      console.log('Downloading from cloud...');

      // Always download from cloud
      const blob = await workspaceApiClient.downloadDiagram(this.workspaceId, this.diagramId);
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Decompress
      const data = decompressDiagramData<DiagramData>(uint8Array);

      return data;
    } catch (error) {
      console.error('CloudStoragePlugin: Failed to load:', error);
      return null;
    }
  }

  async hasData(): Promise<boolean> {
    try {
      // Check cloud
      const diagram = await workspaceApiClient.getDiagram(this.workspaceId, this.diagramId);
      return diagram !== null && diagram.file_size > 0;
    } catch {
      return false;
    }
  }

  async clear(): Promise<boolean> {
    // Cloud diagrams can't be "cleared" via this API - they would need to be deleted
    console.warn('CloudStoragePlugin: clear() not supported for cloud diagrams');
    return false;
  }

  async getMetadata(): Promise<Record<string, any> | null> {
    try {
      const data = await this.load();
      if (!data) {
        return null;
      }
      return data.metadata || null;
    } catch {
      return null;
    }
  }

  async saveSettings(settings: CanvasSettings): Promise<boolean> {
    try {
      // Save settings to localStorage (shared across all diagrams)
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
      return true;
    } catch {
      return false;
    }
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    try {
      if (typeof window === 'undefined') {
        return null;
      }
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) {
        return null;
      }
      return JSON.parse(stored) as CanvasSettings;
    } catch {
      return null;
    }
  }
}
