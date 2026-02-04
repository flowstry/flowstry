import { fetchWithAuth } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Types matching backend models
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface WorkspaceResponse {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  diagram_count: number;
  folder_count: number;
  user_role?: WorkspaceRole;
}

export interface FolderResponse {
  id: string;
  workspace_id: string;
  parent_folder_id?: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface DiagramResponse {
  id: string;
  workspace_id: string;
  folder_id?: string;
  name: string;
  description?: string;
  file_url: string;
  file_size: number;
  thumbnail?: string;
  thumbnail_url?: string;
  version: number;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RecentDiagramResponse {
  id: string;
  workspace_id: string;
  workspace_name: string;
  folder_id?: string;
  name: string;
  thumbnail?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFilesResponse {
  folders: FolderResponse[];
  diagrams: DiagramResponse[];
}

export interface WorkspaceMemberResponse {
  id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: WorkspaceRole;
  joined_at: string;
}

export interface WorkspaceInviteResponse {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  email: string;
  role: WorkspaceRole;
  token?: string;
  invited_by: string;
  inviter_name?: string;
  expires_at: string;
  created_at: string;
}

// Request types
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
}

export interface CreateFolderRequest {
  name: string;
  description?: string;
  parent_folder_id?: string;
  color?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  color?: string;
}

export interface CreateDiagramRequest {
  name: string;
  description?: string;
  folder_id?: string;
}

export interface UpdateDiagramRequest {
  name?: string;
  description?: string;
  thumbnail?: string;
  file_url?: string;
}

export interface CreateInviteRequest {
  email: string;
  role: WorkspaceRole;
}

class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: string
  ) {
    super(message);
    this.name = 'WorkspaceApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new WorkspaceApiError(
      data.error || data.message || 'An error occurred',
      response.status,
      data.error
    );
  }

  // Backend wraps successful responses in { data: ... }
  return data.data || data;
}

export const workspaceApiClient = {
  // ==================== WORKSPACES ====================
  
  async listWorkspaces(): Promise<WorkspaceResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceResponse[]>(response);
  },

  async listRecentDiagrams(limit = 12): Promise<RecentDiagramResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/recents?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<RecentDiagramResponse[]>(response);
  },

  async getWorkspace(id: string): Promise<WorkspaceResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceResponse>(response);
  },

  async createWorkspace(req: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<WorkspaceResponse>(response);
  },

  async updateWorkspace(id: string, req: UpdateWorkspaceRequest): Promise<WorkspaceResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<WorkspaceResponse>(response);
  },

  async getWorkspaceKey(workspaceId: string): Promise<string> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/key`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const data = await handleResponse<{ key: string }>(response);
    return data.key;
  },

  async deleteWorkspace(id: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to delete workspace', response.status);
    }
  },

  // Get all folders and diagrams in a workspace with hierarchy info
  async listFiles(workspaceId: string): Promise<WorkspaceFilesResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/files`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceFilesResponse>(response);
  },

  // ==================== FOLDERS ====================


  async listFolders(workspaceId: string): Promise<FolderResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<FolderResponse[]>(response);
  },

  async listTrashFolders(workspaceId: string): Promise<FolderResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/trash`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<FolderResponse[]>(response);
  },

  async getFolder(workspaceId: string, folderId: string): Promise<FolderResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/${folderId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<FolderResponse>(response);
  },

  async createFolder(workspaceId: string, req: CreateFolderRequest): Promise<FolderResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<FolderResponse>(response);
  },

  async updateFolder(workspaceId: string, folderId: string, req: UpdateFolderRequest): Promise<FolderResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<FolderResponse>(response);
  },

  async deleteFolder(workspaceId: string, folderId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to delete folder', response.status);
    }
  },

  async restoreFolder(workspaceId: string, folderId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/${folderId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to restore folder', response.status);
    }
  },

  async hardDeleteFolder(workspaceId: string, folderId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/folders/${folderId}/permanent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to permanently delete folder', response.status);
    }
  },

  // ==================== DIAGRAMS ====================

  async listDiagrams(workspaceId: string): Promise<DiagramResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<DiagramResponse[]>(response);
  },

  async listTrash(workspaceId: string): Promise<DiagramResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/trash`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<DiagramResponse[]>(response);
  },

  async getDiagram(workspaceId: string, diagramId: string): Promise<DiagramResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<DiagramResponse>(response);
  },

  async createDiagram(workspaceId: string, req: CreateDiagramRequest, fileData?: Blob): Promise<DiagramResponse> {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(req));
    if (fileData) {
      formData.append('file', fileData, 'diagram.flowstry');
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return handleResponse<DiagramResponse>(response);
  },

  async updateDiagram(workspaceId: string, diagramId: string, req: UpdateDiagramRequest): Promise<DiagramResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<DiagramResponse>(response);
  },

  async getUploadUrl(workspaceId: string, diagramId: string, fileType: 'diagram' | 'thumbnail' = 'diagram'): Promise<{ upload_url: string; object_name: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}/upload-url?type=${fileType}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ upload_url: string; object_name: string }>(response);
  },

  async getDownloadUrl(workspaceId: string, diagramId: string): Promise<string> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}/download-url`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const data = await handleResponse<{ download_url: string }>(response);
    return data.download_url;
  },

  async uploadDiagramFile(workspaceId: string, diagramId: string, fileData: Blob): Promise<string> {
    // 1. Get signed URL
    const { upload_url, object_name } = await this.getUploadUrl(workspaceId, diagramId, 'diagram');

    // 2. Upload directly to GCS
    const response = await fetch(upload_url, {
      method: 'PUT',
      body: fileData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      // Important: Do not send cookies/auth headers to GCS
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to GCS: ${response.statusText}`);
    }
    return object_name;
  },

  async uploadDiagramThumbnail(workspaceId: string, diagramId: string, fileData: Blob): Promise<string> {
    // 1. Get signed URL for thumbnail
    const { upload_url, object_name } = await this.getUploadUrl(workspaceId, diagramId, 'thumbnail');

    // 2. Upload directly to GCS
    const response = await fetch(upload_url, {
      method: 'PUT',
      body: fileData,
      headers: {
        'Content-Type': 'image/png',
      },
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Failed to upload thumbnail to GCS: ${response.statusText}`);
    }

    return object_name;
  },

  async downloadDiagram(workspaceId: string, diagramId: string): Promise<Blob> {
    // 1. Get signed URL
    const downloadUrl = await this.getDownloadUrl(workspaceId, diagramId);

    // 2. Download directly from GCS
    const response = await fetch(downloadUrl, {
      method: 'GET',
      // Important: Do not send cookies/auth headers to GCS
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Failed to download from GCS: ${response.statusText}`);
    }
    return response.blob();
  },

  async deleteDiagram(workspaceId: string, diagramId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to delete diagram', response.status);
    }
  },

  async restoreDiagram(workspaceId: string, diagramId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to restore diagram', response.status);
    }
  },

  async hardDeleteDiagram(workspaceId: string, diagramId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}/permanent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new WorkspaceApiError(data.error || 'Failed to permanently delete diagram', response.status);
    }
  },

  // ==================== MEMBERS ====================

  async listMembers(workspaceId: string): Promise<WorkspaceMemberResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/members`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceMemberResponse[]>(response);
  },

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/members/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    await handleResponse(response);
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    await handleResponse(response);
  },

  // ==================== INVITES ====================

  async listWorkspaceInvites(workspaceId: string): Promise<WorkspaceInviteResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/invites`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceInviteResponse[]>(response);
  },

  async createInvite(workspaceId: string, req: CreateInviteRequest): Promise<WorkspaceInviteResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(req),
    });
    return handleResponse<WorkspaceInviteResponse>(response);
  },

  async revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    await handleResponse(response);
  },

  async getLiveCollabToken(workspaceId: string, diagramId: string): Promise<{ token: string; ws_url: string; expires_in: number }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/diagrams/${diagramId}/live/token`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ token: string; ws_url: string; expires_in: number }>(response);
  },

  async listUserInvites(): Promise<WorkspaceInviteResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/invites`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<WorkspaceInviteResponse[]>(response);
  },

  async acceptInvite(token: string): Promise<{ message: string; workspace_id: string; role: WorkspaceRole }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/invites/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ message: string; workspace_id: string; role: WorkspaceRole }>(response);
  },
};

export { WorkspaceApiError };
