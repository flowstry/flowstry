import { CanvasSettings } from '../SettingsManager';
import { DiagramData, LoadOptions, SaveOptions, StoragePlugin } from './StoragePlugin';

const CURRENT_VERSION = '1.0.0';
const DEFAULT_STORAGE_KEY = 'flowstry-canvas-diagram';
const SETTINGS_STORAGE_KEY = 'flowstry_workspace_settings';

/**
 * LocalStorage implementation of StoragePlugin
 * Stores diagram data in browser's localStorage
 */
export class LocalStoragePlugin extends StoragePlugin {
  readonly name = 'localStorage';
  readonly type = 'local' as const;
  private storageKey: string;

  constructor(storageKey: string = DEFAULT_STORAGE_KEY) {
    super();
    this.storageKey = storageKey;
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
          // Set createdAt only if it doesn't exist
          createdAt: data.metadata?.createdAt || new Date().toISOString()
        }
      };

      // Use JSON.stringify with proper spacing for readability and whitespace preservation
      const serialized = JSON.stringify(dataToSave, null, 2);
      localStorage.setItem(this.storageKey, serialized);
      
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  async load(_options?: LoadOptions): Promise<DiagramData | null> {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (!serialized) {
        return null;
      }

      const data = JSON.parse(serialized) as DiagramData;
      
      // TODO: Add version migration logic here if needed
      // if (data.version !== CURRENT_VERSION) {
      //   data = migrateVersion(data);
      // }

      return data;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  async hasData(): Promise<boolean> {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      return serialized !== null;
    } catch (error) {
      console.error('Failed to check localStorage:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  async getMetadata(): Promise<Record<string, any> | null> {
    try {
      const data = await this.load();
      return data?.metadata || null;
    } catch (error) {
      console.error('Failed to get metadata from localStorage:', error);
      return null;
    }
  }

  /**
   * Get the storage key used by this plugin
   */
  getStorageKey(): string {
    return this.storageKey;
  }

  /**
   * Set a custom storage key
   */
  setStorageKey(key: string): void {
    this.storageKey = key;
  }

  async saveSettings(settings: CanvasSettings): Promise<boolean> {
    try {
      const serialized = JSON.stringify(settings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
      return true;
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      return false;
    }
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    try {
      const serialized = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!serialized) {
        return null;
      }
      return JSON.parse(serialized) as CanvasSettings;
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      return null;
    }
  }
}

