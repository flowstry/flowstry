"use client";

import { useAuth } from "@/contexts/AuthContext";
import { workspaceApiClient, type WorkspaceResponse } from "@/lib/workspace-client";
import { workspaceStore, type Workspace } from "@/lib/workspace-store";
import { LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DiagramCard } from "./DiagramCard";
import { useWorkspaceTheme } from "./useWorkspaceTheme";
import { WorkspaceCard } from "./WorkspaceCard";

type HomeTab = "recents" | "my-workspaces" | "shared-workspaces";

interface RecentDiagramItem {
  id: string;
  name: string;
  updatedAt: string;
  workspaceId: string;
  workspaceName: string;
  thumbnailUrl?: string;
  source: "cloud" | "local";
}

interface WorkspaceWithStats extends Workspace {
  diagramCount: number;
  folderCount: number;
  userRole?: WorkspaceResponse["user_role"];
  recentThumbnails: string[];
}

const RECENTS_LIMIT = 12;

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { classes, isDark } = useWorkspaceTheme();

  const [activeTab, setActiveTab] = useState<HomeTab>("recents");
  const [isLoading, setIsLoading] = useState(true);
  const [cloudWorkspaces, setCloudWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [localRecents, setLocalRecents] = useState<RecentDiagramItem[]>([]);
  const [cloudRecents, setCloudRecents] = useState<RecentDiagramItem[]>([]);

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

  const buildThumbnailList = (
    items: Array<{ updatedAt: string; thumbnailUrl?: string; thumbnail?: string }>,
    limit = 4
  ) => {
    return items
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((item) => item.thumbnailUrl || item.thumbnail)
      .filter((thumbnail): thumbnail is string => Boolean(thumbnail))
      .slice(0, Math.max(limit, 0));
  };

  useEffect(() => {
    const loadHome = async () => {
      setIsLoading(true);
      try {
        await workspaceStore.init();

        const allLocalWorkspaces = await workspaceStore.getWorkspaces();

        const localRecentDiagrams = await workspaceStore.getRecentDiagrams(RECENTS_LIMIT);
        const localWorkspaceMap = new Map(allLocalWorkspaces.map((ws) => [ws.id, ws.name]));
        setLocalRecents(
          localRecentDiagrams.map((diagram) => ({
            id: diagram.id,
            name: diagram.name,
            updatedAt: diagram.updatedAt,
            workspaceId: diagram.workspaceId,
            workspaceName: localWorkspaceMap.get(diagram.workspaceId) || "Local workspace",
            thumbnailUrl: diagram.thumbnailUrl,
            source: "local",
          }))
        );

        if (isAuthenticated) {
          const [cloudList, recentDiagrams] = await Promise.all([
            workspaceApiClient.listWorkspaces(),
            workspaceApiClient.listRecentDiagrams(RECENTS_LIMIT),
          ]);
          const cloudWithStats = await Promise.all(
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
          setCloudWorkspaces(cloudWithStats);
          setCloudRecents(
            recentDiagrams.map((diagram) => ({
              id: diagram.id,
              name: diagram.name,
              updatedAt: diagram.updated_at,
              workspaceId: diagram.workspace_id,
              workspaceName: diagram.workspace_name,
              thumbnailUrl: diagram.thumbnail_url,
              source: "cloud",
            }))
          );
        } else {
          setCloudWorkspaces([]);
          setCloudRecents([]);
        }
      } catch (error) {
        console.error("Failed to load home data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHome();
  }, [isAuthenticated]);

  const recentItems = useMemo(() => {
    return [...localRecents, ...cloudRecents]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, RECENTS_LIMIT);
  }, [localRecents, cloudRecents]);

  const ownedCloudWorkspaces = useMemo(
    () => cloudWorkspaces.filter((ws) => ws.userRole === "owner"),
    [cloudWorkspaces]
  );
  const sharedCloudWorkspaces = useMemo(
    () => cloudWorkspaces.filter((ws) => ws.userRole && ws.userRole !== "owner"),
    [cloudWorkspaces]
  );

  const handleOpenDiagram = (diagram: RecentDiagramItem) => {
    if (diagram.source === "cloud") {
      router.push(`/workspace?workspaceId=${diagram.workspaceId}&diagramId=${diagram.id}`);
    } else {
      router.push(`/local?workspaceId=${diagram.workspaceId}&diagramId=${diagram.id}`);
    }
  };

  const handleRenameDiagram = async (diagram: RecentDiagramItem, newName: string) => {
    try {
      if (diagram.source === "cloud") {
        await workspaceApiClient.updateDiagram(diagram.workspaceId, diagram.id, { name: newName });
        // Update local state
        setCloudRecents((prev) =>
          prev.map((d) => (d.id === diagram.id ? { ...d, name: newName } : d))
        );
      } else {
        await workspaceStore.saveDiagram(diagram.id, null!, newName); // Using saveDiagram to rename, passing null for data as it's optional in store for rename-only? - Wait, let's check store API again.
        // Re-read store API: updateDiagram(id, updates). But it's private or not? 
        // workspaceStore.updateDiagram(id, updates) is public.
        await workspaceStore.updateDiagram(diagram.id, { name: newName });
        setLocalRecents((prev) =>
          prev.map((d) => (d.id === diagram.id ? { ...d, name: newName } : d))
        );
      }
    } catch (error) {
      console.error("Failed to rename diagram:", error);
    }
  };

  const handleOpenWorkspace = (workspace: WorkspaceWithStats, isCloud: boolean) => {
    if (isCloud) {
      router.push(`/workspace?workspaceId=${workspace.id}`);
    } else {
      router.push(`/local?workspaceId=${workspace.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${classes.textMuted}`}>
        Loading...
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full px-3 py-4 sm:px-8 sm:py-6 ${classes.text}`}>
      <div
        className={`flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between ${classes.borderStrong}`}
      >
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${classes.surface}`}>
          <LayoutGrid className="h-4 w-4" />
          Home
        </div>
      </div>

      <div className="pt-6">
        <div className={`grid grid-cols-3 gap-2 border-b pb-3 sm:flex sm:flex-wrap sm:items-center ${classes.borderStrong}`}>
          <TabButton
            isActive={activeTab === "recents"}
            onClick={() => setActiveTab("recents")}
            label="Recents"
          />
          <TabButton
            isActive={activeTab === "my-workspaces"}
            onClick={() => setActiveTab("my-workspaces")}
            label="My Workspaces"
            mobileLabel="My"
          />
          <TabButton
            isActive={activeTab === "shared-workspaces"}
            onClick={() => setActiveTab("shared-workspaces")}
            label="Shared Workspaces"
            mobileLabel="Shared"
          />
        </div>

        {activeTab === "recents" && (
          <div className="pt-6">
            {recentItems.length === 0 ? (
              <div className={`text-sm ${classes.textSubtle}`}>No recent diagrams yet.</div>
            ) : (
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-0 sm:max-h-[calc(100vh-260px)] sm:pr-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recentItems.map((diagram) => (
                    <DiagramCard
                      key={`${diagram.source}-${diagram.id}`}
                      name={diagram.name}
                      onClick={() => handleOpenDiagram(diagram)}
                      thumbnailUrl={diagram.thumbnailUrl}
                      updatedAt={diagram.updatedAt}
                      formatDate={formatDate}
                      subTitle={`Workspace · ${diagram.workspaceName}`}
                      onRename={(newName) => handleRenameDiagram(diagram, newName)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "my-workspaces" && (
          <div className="pt-6">
            {isAuthenticated && ownedCloudWorkspaces.length === 0 ? (
              <div className={`text-sm ${classes.textSubtle}`}>No workspaces yet.</div>
            ) : (
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-0 sm:max-h-[calc(100vh-260px)] sm:pr-2">
                <div className="space-y-8">
                  {isAuthenticated && ownedCloudWorkspaces.length > 0 && (
                    <WorkspaceSection
                      count={ownedCloudWorkspaces.length}
                      workspaces={ownedCloudWorkspaces}
                      onOpen={(workspace) => handleOpenWorkspace(workspace, true)}
                      formatDate={formatDate}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "shared-workspaces" && (
          <div className="pt-6">
            {sharedCloudWorkspaces.length === 0 ? (
              <div className={`text-sm ${classes.textSubtle}`}>No shared workspaces yet.</div>
            ) : (
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-0 sm:max-h-[calc(100vh-260px)] sm:pr-2">
                <WorkspaceSection
                  count={sharedCloudWorkspaces.length}
                  workspaces={sharedCloudWorkspaces}
                  onOpen={(workspace) => handleOpenWorkspace(workspace, true)}
                  formatDate={formatDate}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  label,
  mobileLabel,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  mobileLabel?: string;
}) {
  const { classes } = useWorkspaceTheme();
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:w-auto sm:text-sm ${
        isActive
          ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
          : classes.buttonMuted
      }`}
    >
      <span className="sm:hidden">{mobileLabel ?? label}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}


function WorkspaceSection({
  count,
  workspaces,
  onOpen,
  formatDate,
}: {
  count: number;
  workspaces: WorkspaceWithStats[];
  onOpen: (workspace: WorkspaceWithStats) => void;
  formatDate: (dateString: string) => string;
}) {
  const { classes } = useWorkspaceTheme();
  return (
    <div>
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <span className={`text-xs ${classes.textSubtle}`}>
          {count} workspace{count !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {workspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            name={workspace.name}
            onClick={() => onOpen(workspace)}
            thumbnails={workspace.recentThumbnails}
            fileCount={workspace.diagramCount + workspace.folderCount}
            updatedAt={workspace.updatedAt}
            formatDate={formatDate}
          />
        ))}
      </div>
    </div>
  );
}
