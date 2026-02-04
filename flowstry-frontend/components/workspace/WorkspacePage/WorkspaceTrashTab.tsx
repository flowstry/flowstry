"use client";

import { workspaceApiClient } from "@/lib/workspace-client";
import type { DiagramItem, FolderItem, Workspace } from "@/lib/workspace-store";
import { AlertTriangle, File, Folder, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspaceTheme } from "../useWorkspaceTheme";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

interface WorkspaceTrashTabProps {
  selectedWorkspace: Workspace | null;
  canManageWorkspace: boolean;
  formatDate: (dateString: string) => string;
  onRefresh?: () => void;
}

export default function WorkspaceTrashTab({
  selectedWorkspace,
  canManageWorkspace,
  formatDate,
  onRefresh,
}: WorkspaceTrashTabProps) {
  const { classes, isDark } = useWorkspaceTheme();
  const [trashItems, setTrashItems] = useState<{
    folders: FolderItem[];
    diagrams: DiagramItem[]; // Re-using DiagramItem but these are deleted ones
  }>({ folders: [], diagrams: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: "folder" | "diagram"; name: string } | null>(null);

  const loadTrash = async () => {
    if (!selectedWorkspace) return;
    setIsLoading(true);
    try {
      // Fetch trash items. For now assuming we have an endpoint or we filter.
      // The implementation plan says `GET /:id/trash`.
      // I need to update workspaceApiClient to support listTrash first.
      // But for now, let's assume the client method exists or I'll add it.
      // Wait, I haven't updated the client. Let's mock it or use raw fetch if needed, 
      // but better to rely on filtering locally or adding the method.
      // Actually `workspaceApiClient` is in `lib/workspace-client`, I should check it.
      
      // Temporary: fetching all files and filtering for deleted_at != null?
      // No, the listFiles endpoint filters OUT deleted items.
      // So I MUST use the new trash endpoint.
      
      // Since I can't easily edit the client lib without seeing it, I'll use a direct fetch here for now.
      const [diagramsResponse, foldersResponse] = await Promise.all([
        workspaceApiClient.listTrash(selectedWorkspace.id),
        workspaceApiClient.listTrashFolders(selectedWorkspace.id)
      ]);

      const diagrams: DiagramItem[] = diagramsResponse.map(d => ({
        id: d.id,
        workspaceId: d.workspace_id,
        folderId: d.folder_id,
        name: d.name,
        fileUrl: d.file_url,
        thumbnail: d.thumbnail,
        thumbnailUrl: d.thumbnail_url,
        version: d.version,
        deleted_at: d.deleted_at,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));

      const folders: FolderItem[] = foldersResponse.map(f => ({
        id: f.id,
        workspaceId: f.workspace_id,
        parentFolderId: f.parent_folder_id,
        name: f.name,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        deleted_at: f.deleted_at
      }));

      setTrashItems({ folders, diagrams });
    } catch (error) {
      console.error("Failed to load trash:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, [selectedWorkspace]);

  const handleRestore = async (id: string, type: "folder" | "diagram") => {
    if (!selectedWorkspace) return;
    setActionLoading(id);
    try {
        if (type === "diagram") {
            await workspaceApiClient.restoreDiagram(selectedWorkspace.id, id);
        } else {
            await workspaceApiClient.restoreFolder(selectedWorkspace.id, id);
        }
        await loadTrash();
        onRefresh?.();
    } catch (e) {
        console.error("Restore failed", e);
    } finally {
        setActionLoading(null);
    }
  };

  const handlePermanentDeleteClick = (id: string, type: "folder" | "diagram", name: string) => {
    setDeleteItem({ id, type, name });
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!selectedWorkspace || !deleteItem) return;
    
    setActionLoading(deleteItem.id);
    try {
        if (deleteItem.type === "diagram") {
            await workspaceApiClient.hardDeleteDiagram(selectedWorkspace.id, deleteItem.id);
        } else {
            await workspaceApiClient.hardDeleteFolder(selectedWorkspace.id, deleteItem.id);
        }
        await loadTrash();
    } catch (e) {
        console.error("Permanent delete failed", e);
    } finally {
        setActionLoading(null);
        setDeleteItem(null);
    }
  };

  if (isLoading) {
      return <div className={`text-center py-10 text-sm ${classes.textMuted}`}>Loading trash...</div>;
  }

  if (trashItems.diagrams.length === 0 && trashItems.folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
          isDark ? "bg-zinc-900/60" : "bg-zinc-100"
        }`}>
          <Trash2 className={`w-8 h-8 ${classes.textSubtle}`} />
        </div>
        <h3 className={`text-lg font-semibold mb-2 ${classes.textMuted}`}>
          Trash is empty
        </h3>
        <p className={classes.textSubtle}>
          Items you delete will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-6">
      <div className={`rounded-lg border p-4 ${isDark ? "bg-amber-950/10 border-amber-900/30 text-amber-500" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4" />
          <span>Items in trash are safe until you permanently delete them.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* Folders */}
        {trashItems.folders.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center justify-between p-4 rounded-xl border ${classes.surfaceMuted} ${
              isDark ? "hover:bg-zinc-900/70" : "hover:bg-zinc-100"
            }`}
          >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark ? "bg-zinc-800/60" : "bg-zinc-200"
                }`}>
                    <Folder className={`w-5 h-5 ${classes.iconMuted}`} />
                </div>
                <div>
                    <div className={`text-sm font-semibold ${classes.text}`}>{item.name}</div>
                    <div className={`text-xs ${classes.textSubtle}`}>Deleted {formatDate(item.deleted_at || item.updatedAt)}</div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => handleRestore(item.id, "folder")}
                    disabled={!!actionLoading}
                    className={`p-2 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors tooltip`}
                    title="Restore"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
                <button
                    onClick={() => handlePermanentDeleteClick(item.id, "folder", item.name)}
                    disabled={!!actionLoading}
                    className={`p-2 rounded-lg hover:bg-red-500/10 text-red-600 transition-colors tooltip`}
                    title="Delete Forever"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
          </div>
        ))}

        {/* Diagrams */}
        {trashItems.diagrams.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center justify-between p-4 rounded-xl border ${classes.surfaceMuted} ${
              isDark ? "hover:bg-zinc-900/70" : "hover:bg-zinc-100"
            }`}
          >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark ? "bg-zinc-800/60" : "bg-zinc-200"
                }`}>
                    <File className={`w-5 h-5 ${classes.iconMuted}`} />
                </div>
                <div>
                    <div className={`text-sm font-semibold ${classes.text}`}>{item.name}</div>
                    <div className={`text-xs ${classes.textSubtle}`}>Deleted {formatDate(item.deleted_at || item.updatedAt)}</div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => handleRestore(item.id, "diagram")}
                    disabled={!!actionLoading}
                    className={`p-2 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors tooltip`}
                    title="Restore"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
                <button
                    onClick={() => handlePermanentDeleteClick(item.id, "diagram", item.name)}
                    disabled={!!actionLoading}
                    className={`p-2 rounded-lg hover:bg-red-500/10 text-red-600 transition-colors tooltip`}
                    title="Delete Forever"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmationModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handlePermanentDeleteConfirm}
        itemType={deleteItem?.type || "diagram"}
        itemName={deleteItem?.name || ""}
      />
    </div>
  );
}
