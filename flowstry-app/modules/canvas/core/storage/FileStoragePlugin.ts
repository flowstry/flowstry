import { compressDiagramData, decompressDiagramData, isGzipCompressed } from '../../../../lib/compression';
import { CanvasSettings } from '../SettingsManager';
import { DiagramData, LoadOptions, SaveOptions, StoragePlugin } from './StoragePlugin';

/**
 * File export/import implementation of StoragePlugin
 * Downloads/uploads diagram as compressed .flowstry file (gzip)
 * Uses the same compression format as cloud storage for consistency
 * 
 * @example
 * ```typescript
 * const filePlugin = new FileStoragePlugin();
 * storageManager.registerPlugin(filePlugin);
 * 
 * // To export:
 * await storageManager.saveWith('file', { metadata: { filename: 'my-diagram.flowstry' } });
 * 
 * // To import:
 * await storageManager.loadFrom('file');
 * ```
 */
export class FileStoragePlugin extends StoragePlugin {
  readonly name = 'file';
  readonly type = 'file' as const;
  private lastLoadedFilename: string | null = null;
  private defaultFilename = 'diagram.flowstry';

  async save(data: DiagramData, options?: SaveOptions): Promise<boolean> {
    try {
      // Add metadata
      const dataToSave: DiagramData = {
        ...data,
        metadata: {
          ...data.metadata,
          ...(options?.metadata || {}),
          exportedAt: new Date().toISOString()
        }
      };

      const filename = options?.metadata?.filename || this.defaultFilename;

      // Compress data using same format as cloud storage
      const compressed = compressDiagramData(dataToSave);
      const arrayBuffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/gzip' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to export file:', error);
      return false;
    }
  }

  async load(_options?: LoadOptions): Promise<DiagramData | null> {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.flowstry';
      
      return new Promise((resolve) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          // Store filename
          this.lastLoadedFilename = file.name;

          try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Handle both compressed and legacy uncompressed files
            if (isGzipCompressed(uint8Array)) {
              // Decompress gzip data
              const data = decompressDiagramData<DiagramData>(uint8Array);
              resolve(data);
            } else {
              // Legacy: uncompressed JSON
              const text = new TextDecoder().decode(uint8Array);
              const data = JSON.parse(text) as DiagramData;
              resolve(data);
            }
          } catch (error) {
            console.error('Failed to parse file:', error);
            resolve(null);
          }
        };

        input.oncancel = () => {
          resolve(null);
        };

        // Trigger file picker
        input.click();
      });
    } catch (error) {
      console.error('Failed to import file:', error);
      return null;
    }
  }

  async hasData(): Promise<boolean> {
    // File storage doesn't persist, so always return false
    return false;
  }

  async clear(): Promise<boolean> {
    // Nothing to clear for file storage
    return true;
  }

  async getMetadata(): Promise<Record<string, any> | null> {
    return {
      filename: this.lastLoadedFilename
    };
  }

  /**
   * Set the default filename for exports
   */
  setDefaultFilename(filename: string): void {
    this.defaultFilename = filename;
  }

  async saveSettings(_settings: CanvasSettings): Promise<boolean> {
    // File storage plugin doesn't support settings persistence
    // Settings should use the default LocalStoragePlugin
    return false;
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    // File storage plugin doesn't support settings persistence
    // Settings should use the default LocalStoragePlugin
    return null;
  }
}

