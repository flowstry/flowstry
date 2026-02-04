"use client";

import { useAuth } from "@/contexts/AuthContext";
import { syncManager } from "@/lib/SyncManager";
import { workspaceApiClient, type WorkspaceRole } from "@/lib/workspace-client";
import { workspaceStore, type DiagramItem, type Workspace } from "@/lib/workspace-store";
import { LayoutGrid, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaceTheme } from "./useWorkspaceTheme";
import { WorkspaceCard } from "./WorkspaceCard";

interface WorkspaceWithStats extends Workspace {
  diagramCount: number;
  folderCount: number;
  userRole?: WorkspaceRole;
  recentThumbnails: string[];
}

export default function WorkspacesIndexPage() {
  const router = useRouter();
  const { isAuthenticated, isNewSignup, clearNewSignupFlag } = useAuth();
  const { classes, isDark } = useWorkspaceTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [cloudWorkspaces, setCloudWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [localDiagrams, setLocalDiagrams] = useState<DiagramItem[]>([]);
  const [moveSourceWorkspace, setMoveSourceWorkspace] = useState<WorkspaceWithStats | null>(null);
  const [moveTargetWorkspaceId, setMoveTargetWorkspaceId] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const buildThumbnailList = (items: Array<{ updatedAt: string; thumbnail?: string; thumbnailUrl?: string }>, limit = 4) => {
    return items
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((item) => item.thumbnailUrl || item.thumbnail)
      .filter((thumbnail): thumbnail is string => Boolean(thumbnail))
      .slice(0, Math.max(limit, 0));
  };

  const loadWorkspaces = async () => {
    setIsLoading(true);
    try {
      await workspaceStore.init();
      const allLocalWorkspaces = await workspaceStore.getWorkspaces();
      const localWithStats = await Promise.all(
        allLocalWorkspaces.map(async (ws) => {
          const stats = await workspaceStore.getWorkspaceStats(ws.id);
          const diagrams = await workspaceStore.getDiagrams(ws.id);
          const recentThumbnails = buildThumbnailList(diagrams, 4);
          return { ...ws, diagramCount: stats.diagramCount, folderCount: stats.folderCount, recentThumbnails };
        })
      );
      const emptyLocal = localWithStats.filter((ws) => ws.diagramCount === 0);
      if (emptyLocal.length > 0) {
        await Promise.all(emptyLocal.map((ws) => workspaceStore.deleteWorkspace(ws.id)));
      }
      const nonEmptyLocal = localWithStats.filter((ws) => ws.diagramCount > 0);
      setLocalWorkspaces(nonEmptyLocal);
      const recentLocalDiagrams = await workspaceStore.getRecentDiagrams(50);
      setLocalDiagrams(recentLocalDiagrams);

      let cloudWithStats: WorkspaceWithStats[] = [];
      if (isAuthenticated) {
        const cloudList = await workspaceApiClient.listWorkspaces();
        const cloudWithDiagrams = await Promise.all(
          cloudList.map(async (w) => {
            const diagrams = await workspaceApiClient.listDiagrams(w.id);
            const recentThumbnails = buildThumbnailList(
              diagrams.map((d) => ({
                updatedAt: d.updated_at,
                thumbnail: d.thumbnail,
                thumbnailUrl: d.thumbnail_url,
              })),
              4
            );
            return {
              id: w.id,
              name: w.name,
              createdAt: w.created_at,
              updatedAt: w.updated_at,
              diagramCount: w.diagram_count || 0,
              folderCount: w.folder_count || 0,
              userRole: w.user_role,
              recentThumbnails,
            };
          })
        );
        cloudWithStats = cloudWithDiagrams;
        setCloudWorkspaces(cloudWithStats);
      } else {
        setCloudWorkspaces([]);
      }

      if (isAuthenticated && isNewSignup && cloudWithStats.length > 0 && nonEmptyLocal.length > 0) {
        const workspaceToMigrate = nonEmptyLocal[0];
        const targetWorkspaceId = cloudWithStats[0].id;
        const result = await syncManager.moveWorkspaceToExistingCloud(workspaceToMigrate.id, targetWorkspaceId);
        if (result.success) {
          const refreshed = await workspaceApiClient.listWorkspaces();
          const refreshedWithThumbs = await Promise.all(
            refreshed.map(async (w) => {
              const diagrams = await workspaceApiClient.listDiagrams(w.id);
              const recentThumbnails = buildThumbnailList(
                diagrams.map((d) => ({
                  updatedAt: d.updated_at,
                  thumbnail: d.thumbnail,
                  thumbnailUrl: d.thumbnail_url,
                })),
                4
              );
              return {
                id: w.id,
                name: w.name,
                createdAt: w.created_at,
                updatedAt: w.updated_at,
                diagramCount: w.diagram_count || 0,
                folderCount: w.folder_count || 0,
                userRole: w.user_role,
                recentThumbnails,
              };
            })
          );
          setCloudWorkspaces(refreshedWithThumbs);
          setLocalWorkspaces((prev) => prev.filter((ws) => ws.id !== workspaceToMigrate.id));
        }
        clearNewSignupFlag();
      }
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [isAuthenticated]);

  const handleWorkspaceClick = (workspace: Workspace) => {
    router.push(`/workspace?workspaceId=${workspace.id}`);
  };

  const handleCreateWorkspace = async (name: string) => {
    if (!isAuthenticated) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsCreatingWorkspace(true);
    const cloudWs = await workspaceApiClient.createWorkspace({ name: trimmedName });
    const newWs: WorkspaceWithStats = {
      id: cloudWs.id,
      name: cloudWs.name,
      createdAt: cloudWs.created_at,
      updatedAt: cloudWs.updated_at,
      diagramCount: 0,
      folderCount: 0,
      userRole: cloudWs.user_role || "owner",
      recentThumbnails: [],
    };
    setCloudWorkspaces((prev) => [newWs, ...prev]);
    setIsCreatingWorkspace(false);
    setIsCreateModalOpen(false);
    setNewWorkspaceName("");
    router.push(`/workspace?workspaceId=${newWs.id}`);
  };

  const handleOpenMoveModal = (workspace: WorkspaceWithStats) => {
    if (!cloudWorkspaces.length) return;
    setMoveSourceWorkspace(workspace);
    setMoveTargetWorkspaceId(cloudWorkspaces[0].id);
  };

  const handleMoveToCloud = async () => {
    if (!moveSourceWorkspace || !moveTargetWorkspaceId) return;
    const result = await syncManager.moveWorkspaceToExistingCloud(
      moveSourceWorkspace.id,
      moveTargetWorkspaceId
    );
    if (result.success) {
      setLocalWorkspaces((prev) => prev.filter((ws) => ws.id !== moveSourceWorkspace.id));
      const refreshed = await workspaceApiClient.listWorkspaces();
      const refreshedWithThumbs = await Promise.all(
        refreshed.map(async (w) => {
          const diagrams = await workspaceApiClient.listDiagrams(w.id);
          const recentThumbnails = buildThumbnailList(
            diagrams.map((d) => ({
              updatedAt: d.updated_at,
              thumbnail: d.thumbnail,
              thumbnailUrl: d.thumbnail_url,
            })),
            4
          );
          return {
            id: w.id,
            name: w.name,
            createdAt: w.created_at,
            updatedAt: w.updated_at,
            diagramCount: w.diagram_count || 0,
            folderCount: w.folder_count || 0,
            userRole: w.user_role,
            recentThumbnails,
          };
        })
      );
      setCloudWorkspaces(refreshedWithThumbs);
    }
    setMoveSourceWorkspace(null);
  };

  const handleDeleteLocalDiagram = async (diagramId: string) => {
    try {
      await workspaceStore.deleteDiagram(diagramId);
      setLocalDiagrams((prev) => prev.filter((diagram) => diagram.id !== diagramId));
    } catch (error) {
      console.error("Failed to delete local diagram:", error);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${classes.textMuted}`}>
        Loading workspaces...
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full px-3 py-4 sm:px-8 sm:py-6 ${classes.text}`}>
      <div
        className={`flex items-center justify-between gap-3 border-b pb-4 ${classes.borderStrong}`}
      >
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${classes.surface}`}>
          <LayoutGrid className="h-4 w-4" />
          Workspaces
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#36C3AD] px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#2eb39e]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Workspace</span>
        </button>
      </div>

      <div className="pt-6 space-y-8 max-h-[calc(100vh-220px)] overflow-y-auto pr-0 sm:max-h-[calc(100vh-260px)] sm:pr-2">
        {cloudWorkspaces.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs ${classes.textSubtle}`}>
                {cloudWorkspaces.length} workspace{cloudWorkspaces.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {cloudWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  name={workspace.name}
                  onClick={() => handleWorkspaceClick(workspace)}
                  thumbnails={workspace.recentThumbnails}
                  fileCount={workspace.diagramCount + workspace.folderCount}
                  updatedAt={workspace.updatedAt}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}

        {localDiagrams.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xs font-semibold uppercase tracking-wider ${classes.textSubtle}`}>Local diagrams</h2>
              <span className={`text-xs ${classes.textSubtle}`}>
                {localDiagrams.length} diagram{localDiagrams.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {localDiagrams.map((diagram) => (
                <div
                  key={diagram.id}
                  className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${classes.surfaceMuted}`}
                >
                  <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:gap-3">
                    <span className={`truncate text-sm font-semibold ${classes.text}`}>{diagram.name}</span>
                    <button
                      onClick={() => handleDeleteLocalDiagram(diagram.id)}
                      className={`self-start rounded-md border px-2 py-1 text-xs font-semibold sm:self-auto ${classes.border} ${
                        isDark ? "text-zinc-300 hover:bg-zinc-900" : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                  <span className={`text-xs ${classes.textSubtle}`}>{formatDate(diagram.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {moveSourceWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${classes.surfaceStrong}`}>
            <h3 className={`text-lg font-semibold ${classes.text}`}>Move local diagrams</h3>
            <p className={`mt-2 text-sm ${classes.textMuted}`}>
              Choose a workspace to move “{moveSourceWorkspace.name}”.
            </p>
            <div className="mt-4">
              <label className={`text-xs uppercase tracking-wide ${classes.textSubtle}`}>Target workspace</label>
              <select
                value={moveTargetWorkspaceId}
                onChange={(e) => setMoveTargetWorkspaceId(e.target.value)}
                className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${classes.input}`}
              >
                {cloudWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setMoveSourceWorkspace(null)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${classes.border} ${
                  isDark ? "text-zinc-300 hover:bg-zinc-900" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToCloud}
                disabled={!moveTargetWorkspaceId}
                className="rounded-lg bg-[#36C3AD] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#2eb39e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${classes.surfaceStrong}`}>
            <h3 className={`text-lg font-semibold ${classes.text}`}>New workspace</h3>
            <p className={`mt-2 text-sm ${classes.textMuted}`}>
              Name your workspace to get started.
            </p>
            <div className="mt-4">
              <label className={`text-xs uppercase tracking-wide ${classes.textSubtle}`}>Workspace name</label>
              <input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name"
                className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${classes.input}`}
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewWorkspaceName("");
                }}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${classes.border} ${
                  isDark ? "text-zinc-300 hover:bg-zinc-900" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateWorkspace(newWorkspaceName)}
                disabled={!newWorkspaceName.trim() || isCreatingWorkspace}
                className="rounded-lg bg-[#36C3AD] px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-[#2eb39e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingWorkspace ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
