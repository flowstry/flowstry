import { CanvasSettings, DiagramData, LoadOptions, SaveOptions, StoragePlugin } from '@canvas';

const CURRENT_VERSION = '1.0.0';
const DEFAULT_DB_NAME = 'flowstry-canvas-db';
const DEFAULT_STORE_NAME = 'diagrams';
const SETTINGS_STORE_NAME = 'settings';
const DEFAULT_DIAGRAM_KEY = 'default-diagram';
const SETTINGS_KEY = 'workspace-settings';

/**
 * IndexedDB implementation of StoragePlugin
 * Stores diagram data in browser's IndexedDB for larger storage capacity
 * This is used for the free tier to overcome localStorage size limitations
 */
export class IndexedDBStoragePlugin extends StoragePlugin {
  readonly name = 'indexedDB';
  readonly type = 'local' as const;
  private dbName: string;
  private storeName: string;
  private diagramKey: string;
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor(
    dbName: string = DEFAULT_DB_NAME,
    storeName: string = DEFAULT_STORE_NAME,
    diagramKey: string = DEFAULT_DIAGRAM_KEY
  ) {
    super();
    this.dbName = dbName;
    this.storeName = storeName;
    this.diagramKey = diagramKey;
    this.dbReady = this.initDB();
  }

  /**
   * Initialize the IndexedDB database
   */
  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for diagrams if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }

        // Create object store for settings if it doesn't exist
        if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Get a database connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    return this.dbReady;
  }

  async save(data: DiagramData, options?: SaveOptions): Promise<boolean> {
    try {
      const db = await this.getDB();

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

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const request = store.put({
          key: this.diagramKey,
          data: dataToSave
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error('Failed to save to IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
      return false;
    }
  }

  async load(options?: LoadOptions): Promise<DiagramData | null> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);

        const request = store.get(this.diagramKey);

        request.onsuccess = () => {
          if (request.result) {
            // TODO: Add version migration logic here if needed
            resolve(request.result.data as DiagramData);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('Failed to load from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error);
      return null;
    }
  }

  async hasData(): Promise<boolean> {
    try {
      const data = await this.load();
      return data !== null;
    } catch (error) {
      console.error('Failed to check IndexedDB:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const request = store.delete(this.diagramKey);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error('Failed to clear IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
      return false;
    }
  }

  async getMetadata(): Promise<Record<string, unknown> | null> {
    try {
      const data = await this.load();
      return data?.metadata || null;
    } catch (error) {
      console.error('Failed to get metadata from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Get the database name used by this plugin
   */
  getDbName(): string {
    return this.dbName;
  }

  /**
   * Get the store name used by this plugin
   */
  getStoreName(): string {
    return this.storeName;
  }

  /**
   * Get the diagram key used by this plugin
   */
  getDiagramKey(): string {
    return this.diagramKey;
  }

  async saveSettings(settings: CanvasSettings): Promise<boolean> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE_NAME);

        const request = store.put({
          key: SETTINGS_KEY,
          data: settings
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error('Failed to save settings to IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save settings to IndexedDB:', error);
      return false;
    }
  }

  async loadSettings(): Promise<CanvasSettings | null> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(SETTINGS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE_NAME);

        const request = store.get(SETTINGS_KEY);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.data as CanvasSettings);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('Failed to load settings from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load settings from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
