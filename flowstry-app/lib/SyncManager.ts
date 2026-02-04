/**
 * SyncManager - Orchestrates migration between local and cloud storage
 */

import { createCompressedFlowstryBlob } from './compression';
import { workspaceApiClient, type CreateFolderRequest } from './workspace-client';
import { workspaceStore, type DiagramItem } from './workspace-store';

export interface SyncResult {
  success: boolean;
  error?: string;
  cloudId?: string;
}

/**
 * Coordinates migration operations between local IndexedDB and cloud storage
 */
class SyncManager {
  private processingItems = new Set<string>();

  /**
   * Move a local workspace to cloud
   * 1. Creates new cloud workspace
   * 2. Recreates folder structure in cloud
   * 3. Uploads all diagrams to cloud (associated with correct folders)
   * 4. Deletes local workspace
   */
  async moveWorkspaceToCloud(workspaceId: string): Promise<SyncResult> {
    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (this.processingItems.has(workspaceId)) {
      return { success: false, error: 'Already processing' };
    }

    this.processingItems.add(workspaceId);

    try {
      // 1. Create cloud workspace
      const cloudWorkspace = await workspaceApiClient.createWorkspace({
        name: workspace.name,
      });

      // 2. Recreate folder structure
      const folderMap = new Map<string, string>(); // Local Folder ID -> Cloud Folder ID
      const allFolders = await this.getAllFoldersInWorkspace(workspaceId);

      for (const localFolder of allFolders) {
        const folder = await workspaceStore.getFolder(localFolder.id);
        if (!folder) continue;

        const req: CreateFolderRequest = {
          name: folder.name,
          parent_folder_id: folder.parentFolderId ? folderMap.get(folder.parentFolderId) : undefined
        };

        const cloudFolder = await workspaceApiClient.createFolder(cloudWorkspace.id, req);
        folderMap.set(localFolder.id, cloudFolder.id);
      }

      // 3. Migrate diagrams
      const allDiagrams = await this.getAllDiagramsInWorkspace(workspaceId);
      for (const localDiagram of allDiagrams) {
        const diagram = await workspaceStore.getDiagram(localDiagram.id);
        if (!diagram || !diagram.data) continue;

        // Compress data
        const blob = createCompressedFlowstryBlob(diagram.data);

        // Upload to cloud with folder association
        await workspaceApiClient.createDiagram(
          cloudWorkspace.id,
          {
            name: diagram.name,
            folder_id: diagram.folderId ? folderMap.get(diagram.folderId) : undefined
          },
          blob
        );
      }

      // 4. Delete local workspace
      await workspaceStore.deleteWorkspace(workspaceId);

      return { success: true, cloudId: cloudWorkspace.id };
    } catch (error) {
      console.error('Failed to move workspace to cloud:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      this.processingItems.delete(workspaceId);
    }
  }

  /**
   * Move a local workspace into an existing cloud workspace
   * 1. Recreates folder structure under target workspace
   * 2. Uploads all diagrams to cloud (associated with correct folders)
   * 3. Deletes local workspace
   */
  async moveWorkspaceToExistingCloud(workspaceId: string, cloudWorkspaceId: string): Promise<SyncResult> {
    const workspace = await workspaceStore.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    if (!cloudWorkspaceId) {
      return { success: false, error: 'Target workspace not provided' };
    }

    if (this.processingItems.has(workspaceId)) {
      return { success: false, error: 'Already processing' };
    }

    this.processingItems.add(workspaceId);

    try {
      // 1. Recreate folder structure
      const folderMap = new Map<string, string>(); // Local Folder ID -> Cloud Folder ID
      const allFolders = await this.getAllFoldersInWorkspace(workspaceId);

      for (const localFolder of allFolders) {
        const folder = await workspaceStore.getFolder(localFolder.id);
        if (!folder) continue;

        const req: CreateFolderRequest = {
          name: folder.name,
          parent_folder_id: folder.parentFolderId ? folderMap.get(folder.parentFolderId) : undefined,
        };

        const cloudFolder = await workspaceApiClient.createFolder(cloudWorkspaceId, req);
        folderMap.set(localFolder.id, cloudFolder.id);
      }

      // 2. Migrate diagrams
      const allDiagrams = await this.getAllDiagramsInWorkspace(workspaceId);
      for (const localDiagram of allDiagrams) {
        const diagram = await workspaceStore.getDiagram(localDiagram.id);
        if (!diagram || !diagram.data) continue;

        const blob = createCompressedFlowstryBlob(diagram.data);
        await workspaceApiClient.createDiagram(
          cloudWorkspaceId,
          {
            name: diagram.name,
            folder_id: diagram.folderId ? folderMap.get(diagram.folderId) : undefined,
          },
          blob
        );
      }

      // 3. Delete local workspace
      await workspaceStore.deleteWorkspace(workspaceId);

      return { success: true, cloudId: cloudWorkspaceId };
    } catch (error) {
      console.error('Failed to move workspace to existing cloud:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      this.processingItems.delete(workspaceId);
    }
  }

  // ==================== Private Helpers ====================

  private async getAllDiagramsInWorkspace(workspaceId: string): Promise<DiagramItem[]> {
    // Get root diagrams
    const rootDiagrams = await workspaceStore.getDiagrams(workspaceId);

    // Get diagrams from all folders (recursively)
    const allFolders = await this.getAllFoldersInWorkspace(workspaceId);
    const folderDiagrams: DiagramItem[] = [];

    for (const folder of allFolders) {
      const diagrams = await workspaceStore.getDiagrams(workspaceId, folder.id);
      folderDiagrams.push(...diagrams);
    }

    return [...rootDiagrams, ...folderDiagrams];
  }

  // Returns folders in topological order (parents before children)
  private async getAllFoldersInWorkspace(workspaceId: string): Promise<{ id: string }[]> {
    const rootFolders = await workspaceStore.getFolders(workspaceId);
    const allFolders: { id: string }[] = [...rootFolders];

    for (const folder of rootFolders) {
      const subfolders = await this.getSubfoldersRecursive(workspaceId, folder.id);
      allFolders.push(...subfolders);
    }

    return allFolders;
  }

  private async getSubfoldersRecursive(workspaceId: string, parentId: string): Promise<{ id: string }[]> {
    const folders = await workspaceStore.getFolders(workspaceId, parentId);
    const allFolders: { id: string }[] = [...folders];

    for (const folder of folders) {
      const subfolders = await this.getSubfoldersRecursive(workspaceId, folder.id);
      allFolders.push(...subfolders);
    }

    return allFolders;
  }
}

export const syncManager = new SyncManager();
