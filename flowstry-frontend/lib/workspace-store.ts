/**
 * Workspace Store - IndexedDB wrapper for workspaces, folders, and diagrams
 */

import type { DiagramData } from '@canvas';

// Types
export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  id: string;
  workspaceId: string;
  parentFolderId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deleted_at?: string;
}

export interface DiagramItem {
  id: string;
  workspaceId: string;
  folderId?: string;
  name: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  data?: DiagramData;
  deleted_at?: string;
  createdAt: string;
  updatedAt: string;
}


// Constants
const DB_NAME = 'flowstry-workspaces';
const DB_VERSION = 1;
const STORES = {
  WORKSPACES: 'workspaces',
  FOLDERS: 'folders',
  DIAGRAMS: 'diagrams',
} as const;

export const DEFAULT_WORKSPACE_ID = 'default';
export const DEFAULT_DIAGRAM_ID = 'default-diagram';

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

class WorkspaceStore {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase> | null = null;
  private initialized = false;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.initialized && this.db) return;

    if (!this.dbReady) {
      this.dbReady = this.openDatabase();
    }

    this.db = await this.dbReady;
    this.initialized = true;

    // Ensure default workspace exists
    await this.ensureInitialWorkspace();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Workspaces store
        if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
          db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' });
        }

        // Folders store with indexes
        if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
          const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
          folderStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          folderStore.createIndex('parentFolderId', 'parentFolderId', { unique: false });
        }

        // Diagrams store with indexes
        if (!db.objectStoreNames.contains(STORES.DIAGRAMS)) {
          const diagramStore = db.createObjectStore(STORES.DIAGRAMS, { keyPath: 'id' });
          diagramStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          diagramStore.createIndex('folderId', 'folderId', { unique: false });
        }
      };
    });
  }

  private async ensureInitialWorkspace(): Promise<void> {
    const workspaces = await this.getWorkspaces();
    if (workspaces.length === 0) {
      const now = new Date().toISOString();
      const workspaceId = generateId();

      await this.createWorkspace({
        id: workspaceId,
        name: 'My Diagrams',
        createdAt: now,
        updatedAt: now,
      });

      // Create default diagram
      await this.createDiagram({
        id: generateId(), // Random ID for diagram too
        workspaceId: workspaceId,
        name: 'Untitled Diagram',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private getDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // ==================== WORKSPACES ====================

  async getWorkspaces(): Promise<Workspace[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.WORKSPACES, 'readonly');
      const store = tx.objectStore(STORES.WORKSPACES);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort: default first, then by name
        const workspaces = request.result as Workspace[];
        workspaces.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
        resolve(workspaces);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.WORKSPACES, 'readonly');
      const store = tx.objectStore(STORES.WORKSPACES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async createWorkspace(workspace: Workspace): Promise<Workspace> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORES.WORKSPACES);
      const request = store.add(workspace);

      request.onsuccess = () => resolve(workspace);
      request.onerror = () => reject(request.error);
    });
  }

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    await this.init();
    const existing = await this.getWorkspace(id);
    if (!existing) throw new Error(`Workspace ${id} not found`);

    const updated: Workspace = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORES.WORKSPACES);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.init();
    // Delete all diagrams in workspace
    const diagrams = await this.getDiagrams(id);
    for (const diagram of diagrams) {
      await this.deleteDiagram(diagram.id);
    }

    // Delete all folders in workspace
    const folders = await this.getFolders(id);
    for (const folder of folders) {
      await this.deleteFolder(folder.id);
    }

    // Delete workspace
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.WORKSPACES, 'readwrite');
      const store = tx.objectStore(STORES.WORKSPACES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== FOLDERS ====================

  async getFolders(workspaceId: string, parentFolderId?: string): Promise<FolderItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readonly');
      const store = tx.objectStore(STORES.FOLDERS);
      const index = store.index('workspaceId');
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        let folders = request.result as FolderItem[];
        // Filter by parent folder
        folders = folders.filter((f) =>
          parentFolderId ? f.parentFolderId === parentFolderId : !f.parentFolderId
        );
        // Sort by name
        folders.sort((a, b) => a.name.localeCompare(b.name));
        resolve(folders);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getFolder(id: string): Promise<FolderItem | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readonly');
      const store = tx.objectStore(STORES.FOLDERS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async createFolder(workspaceId: string, name: string, parentFolderId?: string): Promise<FolderItem> {
    await this.init();
    const now = new Date().toISOString();
    const folder: FolderItem = {
      id: generateId(),
      workspaceId,
      parentFolderId,
      name,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readwrite');
      const store = tx.objectStore(STORES.FOLDERS);
      const request = store.add(folder);

      request.onsuccess = () => resolve(folder);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFolder(id: string, updates: Partial<FolderItem>): Promise<FolderItem> {
    await this.init();
    const existing = await this.getFolder(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const updated: FolderItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readwrite');
      const store = tx.objectStore(STORES.FOLDERS);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    await this.init();
    const folder = await this.getFolder(id);
    if (!folder) return;

    // Delete diagrams in folder
    const diagrams = await this.getDiagrams(folder.workspaceId, id);
    for (const diagram of diagrams) {
      await this.deleteDiagram(diagram.id);
    }

    // Delete subfolders
    const subfolders = await this.getFolders(folder.workspaceId, id);
    for (const subfolder of subfolders) {
      await this.deleteFolder(subfolder.id);
    }

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readwrite');
      const store = tx.objectStore(STORES.FOLDERS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== DIAGRAMS ====================

  async getDiagrams(workspaceId: string, folderId?: string): Promise<DiagramItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readonly');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const index = store.index('workspaceId');
      const request = index.getAll(workspaceId);

      request.onsuccess = () => {
        let diagrams = request.result as DiagramItem[];
        // Filter by folder
        diagrams = diagrams.filter((d) =>
          folderId ? d.folderId === folderId : !d.folderId
        );
        // Sort by updated date (newest first)
        diagrams.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        resolve(diagrams);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getDiagram(id: string): Promise<DiagramItem | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readonly');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async createDiagram(diagram: Omit<DiagramItem, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<DiagramItem> {
    await this.init();
    const now = new Date().toISOString();
    const newDiagram: DiagramItem = {
      ...diagram,
      id: diagram.id || generateId(),
      createdAt: diagram.createdAt || now,
      updatedAt: diagram.updatedAt || now,
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readwrite');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.add(newDiagram);

      request.onsuccess = () => resolve(newDiagram);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDiagram(id: string, data: DiagramData, name?: string): Promise<DiagramItem> {
    await this.init();
    const existing = await this.getDiagram(id);
    if (!existing) throw new Error(`Diagram ${id} not found`);

    const updated: DiagramItem = {
      ...existing,
      data,
      name: name ?? existing.name,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readwrite');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async updateDiagram(id: string, updates: Partial<DiagramItem>): Promise<DiagramItem> {
    await this.init();
    const existing = await this.getDiagram(id);
    if (!existing) throw new Error(`Diagram ${id} not found`);

    const updated: DiagramItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readwrite');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDiagram(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readwrite');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILS ====================

  async getWorkspaceStats(workspaceId: string): Promise<{ diagramCount: number; folderCount: number }> {
    await this.init();
    const [diagrams, folders] = await Promise.all([
      this.getDiagramsAll(workspaceId),
      this.getFoldersAll(workspaceId),
    ]);
    return {
      diagramCount: diagrams.length,
      folderCount: folders.length,
    };
  }

  async getRecentDiagrams(limit = 12): Promise<DiagramItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readonly');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const request = store.getAll();

      request.onsuccess = () => {
        const diagrams = (request.result as DiagramItem[]).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        resolve(diagrams.slice(0, Math.max(limit, 0)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async getDiagramsAll(workspaceId: string): Promise<DiagramItem[]> {
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.DIAGRAMS, 'readonly');
      const store = tx.objectStore(STORES.DIAGRAMS);
      const index = store.index('workspaceId');
      const request = index.getAll(workspaceId);

      request.onsuccess = () => resolve(request.result as DiagramItem[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async getFoldersAll(workspaceId: string): Promise<FolderItem[]> {
    return new Promise((resolve, reject) => {
      const tx = this.getDB().transaction(STORES.FOLDERS, 'readonly');
      const store = tx.objectStore(STORES.FOLDERS);
      const index = store.index('workspaceId');
      const request = index.getAll(workspaceId);

      request.onsuccess = () => resolve(request.result as FolderItem[]);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const workspaceStore = new WorkspaceStore();
