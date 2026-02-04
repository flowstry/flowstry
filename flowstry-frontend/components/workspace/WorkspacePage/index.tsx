"use client";

import { useAuth } from "@/contexts/AuthContext";
import { workspaceApiClient, type WorkspaceInviteResponse, type WorkspaceMemberResponse, type WorkspaceRole } from "@/lib/workspace-client";
import { workspaceStore, type DiagramItem, type FolderItem, type Workspace } from "@/lib/workspace-store";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceTheme } from "../useWorkspaceTheme";
import WorkspaceFilesTab from "./WorkspaceFilesTab";
import WorkspaceMembersTab from "./WorkspaceMembersTab";
import WorkspaceSettingsTab from "./WorkspaceSettingsTab";
import WorkspaceTrashTab from "./WorkspaceTrashTab";

export default function WorkspaceInnerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { classes, isDark } = useWorkspaceTheme();

  const workspaceId = searchParams.get("workspaceId");
  const folderId = searchParams.get("folderId");

  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspaceIsCloud, setSelectedWorkspaceIsCloud] = useState(false);
  const [selectedWorkspaceRole, setSelectedWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [folderPath, setFolderPath] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === "members" || tab === "settings" || tab === "trash") return tab;
    return "files";
  }, [searchParams]);

  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberResponse[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInviteResponse[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("viewer");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [workspaceNameInput, setWorkspaceNameInput] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: "folder" | "diagram" | null;
    item: FolderItem | DiagramItem | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: null,
    item: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [renameItem, setRenameItem] = useState<{ type: "folder" | "diagram"; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete State
  const [deleteItem, setDeleteItem] = useState<{ type: "folder" | "diagram"; id: string; name: string } | null>(null);
  const [deleteContents, setDeleteContents] = useState<{ folders: number; diagrams: number } | null>(null);

  const canManageMembers =
    selectedWorkspaceIsCloud && (selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin");
  const canManageWorkspace = canManageMembers;

  const canCreate = !selectedWorkspaceIsCloud || (selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin" || selectedWorkspaceRole === "editor");
  const canRename = !selectedWorkspaceIsCloud || (selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin" || selectedWorkspaceRole === "editor");
  const canDelete = !selectedWorkspaceIsCloud || (selectedWorkspaceRole === "owner" || selectedWorkspaceRole === "admin");

  const filteredFolders = useMemo(
    () => folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [folders, searchQuery]
  );
  const filteredDiagrams = useMemo(
    () => diagrams.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [diagrams, searchQuery]
  );

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

  const getInitials = (name?: string, email?: string) => {
    const source = (name || email || "").trim();
    if (!source) return "U";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const formatRoleLabel = (role: WorkspaceRole) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  const loadWorkspaceById = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      await workspaceStore.init();
      let targetWorkspace: Workspace | null = null;
      let isCloud = false;
      let userRole: WorkspaceRole | null = null;

      if (isAuthenticated) {
        try {
          const cloudWorkspace = await workspaceApiClient.getWorkspace(workspaceId);
          targetWorkspace = {
            id: cloudWorkspace.id,
            name: cloudWorkspace.name,
            createdAt: cloudWorkspace.created_at,
            updatedAt: cloudWorkspace.updated_at,
          };
          isCloud = true;
          userRole = cloudWorkspace.user_role ?? null;
        } catch (error) {
          console.warn("Workspace not found in cloud:", error);
        }
      }

      if (!targetWorkspace) {
        targetWorkspace = await workspaceStore.getWorkspace(workspaceId);
      }

      if (!targetWorkspace) {
        router.push("/workspace");
        return;
      }

      setSelectedWorkspaceIsCloud(isCloud);
      setSelectedWorkspaceRole(userRole);
      await loadWorkspaceContents(targetWorkspace, folderId ?? undefined, isCloud, false);
    } catch (error) {
      console.error("Failed to load workspace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceById();
  }, [workspaceId, folderId, isAuthenticated]);

  const loadWorkspaceContents = useCallback(
    async (workspace: Workspace, folderId?: string, isCloudOverride?: boolean, shouldSetLoading = true) => {
      if (shouldSetLoading) {
        setIsLoading(true);
      }
      try {
        setSelectedWorkspace(workspace);
        setWorkspaceNameInput(workspace.name);
        setMembers([]);
        setWorkspaceInvites([]);
        setMembersError(null);

        const isCloud = isCloudOverride ?? selectedWorkspaceIsCloud;
        setSelectedWorkspaceIsCloud(isCloud);
        if (!isCloud) {
          setSelectedWorkspaceRole(null);
        }

        if (isCloud) {
          const files = await workspaceApiClient.listFiles(workspace.id);
          const mappedFolders: FolderItem[] = files.folders.map((f) => ({
            id: f.id,
            workspaceId: f.workspace_id,
            parentFolderId: f.parent_folder_id,
            name: f.name,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
          }));
          const mappedDiagrams: DiagramItem[] = files.diagrams.map((d) => ({
            id: d.id,
            workspaceId: d.workspace_id,
            folderId: d.folder_id,
            name: d.name,
            fileUrl: d.file_url,
            thumbnail: d.thumbnail,
            thumbnailUrl: d.thumbnail_url,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));

          if (folderId) {
            const path: FolderItem[] = [];
            let currentId: string | undefined = folderId;
            let depth = 0;
            while (currentId && depth < 20) {
              const folder = mappedFolders.find((f) => f.id === currentId);
              if (folder) {
                path.unshift(folder);
                currentId = folder.parentFolderId;
                depth++;
              } else {
                break;
              }
            }
            setFolderPath(path);
            setCurrentFolder(mappedFolders.find((f) => f.id === folderId) || null);
          } else {
            setFolderPath([]);
            setCurrentFolder(null);
          }

          setFolders(mappedFolders.filter((f) => (folderId ? f.parentFolderId === folderId : !f.parentFolderId)));
          setDiagrams(mappedDiagrams.filter((d) => (folderId ? d.folderId === folderId : !d.folderId)));
        } else {
          if (folderId) {
            const folder = await workspaceStore.getFolder(folderId);
            setCurrentFolder(folder);
            const path: FolderItem[] = [];
            let f = folder;
            while (f) {
              path.unshift(f);
              if (f.parentFolderId) {
                f = await workspaceStore.getFolder(f.parentFolderId);
              } else {
                break;
              }
            }
            setFolderPath(path);
          } else {
            setCurrentFolder(null);
            setFolderPath([]);
          }
          const [foldersData, diagramsData] = await Promise.all([
            workspaceStore.getFolders(workspace.id, folderId),
            workspaceStore.getDiagrams(workspace.id, folderId),
          ]);
          setFolders(foldersData);
          setDiagrams(diagramsData);
        }
      } finally {
        if (shouldSetLoading) {
          setIsLoading(false);
        }
      }
    },
    [selectedWorkspaceIsCloud]
  );

  const buildWorkspaceUrl = (targetFolderId?: string, targetTab?: "files" | "members" | "settings") => {
    const params = new URLSearchParams(searchParams);
    params.set("workspaceId", workspaceId ?? "");
    params.delete("diagramId");
    params.set("tab", targetTab ?? activeTab);
    if (targetFolderId) {
      params.set("folderId", targetFolderId);
    } else {
      params.delete("folderId");
    }
    return `/workspace?${params.toString()}`;
  };

  const handleFolderClick = (folder: FolderItem) => {
    if (renameItem?.type === "folder" && renameItem.id === folder.id) {
      return;
    }
    if (!selectedWorkspace) return;
    router.push(buildWorkspaceUrl(folder.id));
  };

  const handleDiagramClick = (diagram: DiagramItem) => {
    if (renameItem?.type === "diagram" && renameItem.id === diagram.id) {
      return;
    }
    if (!selectedWorkspace) return;
    if (selectedWorkspaceIsCloud) {
      router.push(`/workspace?workspaceId=${selectedWorkspace.id}&diagramId=${diagram.id}`);
    } else {
      router.push(`/local?workspaceId=${selectedWorkspace.id}&diagramId=${diagram.id}`);
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "folder" | "diagram",
    item: FolderItem | DiagramItem
  ) => {
    // Basic check: if you can neither rename nor delete, don't show menu
    if (!canRename && !canDelete) return;

    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type,
      item,
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleRenameStart = () => {
    if (!canRename) return;
    if (!contextMenu.item || !contextMenu.type) return;
    setRenameItem({ type: contextMenu.type, id: contextMenu.item.id });
    setRenameValue(contextMenu.item.name);
    closeContextMenu();
  };

  const handleRenameSubmit = async (commit: boolean) => {
    if (!renameItem || !selectedWorkspace) {
      setRenameItem(null);
      return;
    }
    if (!commit) {
      setRenameItem(null);
      return;
    }
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      setRenameItem(null);
      return;
    }
    try {
      if (selectedWorkspaceIsCloud) {
        if (renameItem.type === "folder") {
          await workspaceApiClient.updateFolder(selectedWorkspace.id, renameItem.id, { name: trimmedName });
        } else {
          await workspaceApiClient.updateDiagram(selectedWorkspace.id, renameItem.id, { name: trimmedName });
        }
        await loadWorkspaceContents(selectedWorkspace, currentFolder?.id, true);
      } else {
        if (renameItem.type === "folder") {
          await workspaceStore.updateFolder(renameItem.id, { name: trimmedName });
          setFolders((prev) => prev.map((f) => (f.id === renameItem.id ? { ...f, name: trimmedName } : f)));
        } else {
          await workspaceStore.updateDiagram(renameItem.id, { name: trimmedName });
          setDiagrams((prev) => prev.map((d) => (d.id === renameItem.id ? { ...d, name: trimmedName } : d)));
        }
      }
    } catch (error) {
      console.error("Failed to rename item:", error);
    } finally {
      setRenameItem(null);
    }
  };

  /* 
   * Folder Rename Handler 
   * Wrapped to match (id, newName) signature for FolderCard
   */
  const handleRenameFolder = async (id: string, newName: string) => {
    // Set rename item so existing handleRenameSubmit logic can be reused or refactored
    // Actually handleRenameSubmit uses state `renameItem` and `renameValue`.
    // The new FolderCard handles input state internally. It just calls onRename(newName).
    // So I need a direct rename function similar to handleRenameDiagram.

    if (!selectedWorkspace || !canRename) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    try {
      if (selectedWorkspaceIsCloud) {
        await workspaceApiClient.updateFolder(selectedWorkspace.id, id, { name: trimmedName });
        // Reload to refresh list
        await loadWorkspaceContents(selectedWorkspace, currentFolder?.id, true);
      } else {
        await workspaceStore.updateFolder(id, { name: trimmedName });
        setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmedName } : f)));
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
    }
  };

  const handleRenameDiagram = async (diagramId: string, newName: string) => {
    if (!selectedWorkspace || !canRename) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    try {
      if (selectedWorkspaceIsCloud) {
        await workspaceApiClient.updateDiagram(selectedWorkspace.id, diagramId, { name: trimmedName });
        setDiagrams((prev) => prev.map((d) => (d.id === diagramId ? { ...d, name: trimmedName } : d)));
      } else {
        await workspaceStore.updateDiagram(diagramId, { name: trimmedName });
        setDiagrams((prev) => prev.map((d) => (d.id === diagramId ? { ...d, name: trimmedName } : d)));
      }
    } catch (error) {
      console.error("Failed to rename diagram:", error);
    }
  };

  useEffect(() => {
    if (!contextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu.isOpen]);

  useEffect(() => {
    if (renameItem && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameItem]);

  const handleRenameWorkspace = async () => {
    if (!selectedWorkspace) return;
    const trimmedName = workspaceNameInput.trim();
    if (!trimmedName || trimmedName === selectedWorkspace.name) return;
    try {
      setRenameSubmitting(true);
      if (selectedWorkspaceIsCloud) {
        const updated = await workspaceApiClient.updateWorkspace(selectedWorkspace.id, {
          name: trimmedName,
        });
        setSelectedWorkspace((prev) =>
          prev
            ? {
              ...prev,
              name: updated.name,
              updatedAt: updated.updated_at,
            }
            : prev
        );
      } else {
        const updated = await workspaceStore.updateWorkspace(selectedWorkspace.id, {
          name: trimmedName,
        });
        setSelectedWorkspace(updated);
      }
    } catch (error) {
      console.error("Failed to rename workspace:", error);
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleCreateDiagram = async () => {
    if (!selectedWorkspace || !canCreate) return;
    try {
      if (selectedWorkspaceIsCloud) {
        await workspaceApiClient.createDiagram(selectedWorkspace.id, {
          name: "Untitled Diagram",
          folder_id: currentFolder?.id,
        });
        await loadWorkspaceContents(selectedWorkspace, currentFolder?.id, true);
      } else {
        await workspaceStore.createDiagram({
          id: crypto.randomUUID(),
          workspaceId: selectedWorkspace.id,
          folderId: currentFolder?.id,
          name: "Untitled Diagram",
        });
        await loadWorkspaceContents(selectedWorkspace, currentFolder?.id, false);
      }
    } catch (error) {
      console.error("Failed to create diagram:", error);
    }
  };

  /* 
   * Handle Delete Request
   * Soft delete now bypasses the confirmation modal for standard deletion.
   * It moves items to trash immediately.
   */
  const handleDeleteRequest = async (type: "folder" | "diagram", item: FolderItem | DiagramItem) => {
    if (!canDelete || !selectedWorkspace) return;

    // Immediately soft delete
    try {
      if (type === "folder") {
        if (selectedWorkspaceIsCloud) {
          await workspaceApiClient.deleteFolder(selectedWorkspace.id, item.id);
        } else {
          await workspaceStore.deleteFolder(item.id);
        }
        setFolders(prev => prev.filter(f => f.id !== item.id));
      } else {
        if (selectedWorkspaceIsCloud) {
          await workspaceApiClient.deleteDiagram(selectedWorkspace.id, item.id);
        } else {
          await workspaceStore.deleteDiagram(item.id);
        }
        setDiagrams(prev => prev.filter(d => d.id !== item.id));
      }
      // TODO: Show toast "Moved to trash"
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item");
    }
  };

  // Deprecated modal confirm handler - leaving if we need hard delete modal later, but unused for now
  const handleDeleteConfirm = async () => { };

  const handleCreateFolder = async () => {
    if (!selectedWorkspace || !canCreate) return;
    try {
      if (selectedWorkspaceIsCloud) {
        await workspaceApiClient.createFolder(selectedWorkspace.id, {
          name: "New Folder",
          parent_folder_id: currentFolder?.id,
        });
        await loadWorkspaceContents(selectedWorkspace, currentFolder?.id, true);
      } else {
        const folder = await workspaceStore.createFolder(
          selectedWorkspace.id,
          "New Folder",
          currentFolder?.id
        );
        setFolders((prev) => [...prev, folder]);
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const loadMembers = useCallback(async () => {
    if (!selectedWorkspace || !selectedWorkspaceIsCloud) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const [membersData, invitesData] = await Promise.all([
        workspaceApiClient.listMembers(selectedWorkspace.id),
        canManageMembers ? workspaceApiClient.listWorkspaceInvites(selectedWorkspace.id) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setWorkspaceInvites(invitesData);
    } catch (error) {
      console.error("Failed to load members:", error);
      setMembersError("Failed to load workspace members.");
    } finally {
      setMembersLoading(false);
    }
  }, [selectedWorkspace, selectedWorkspaceIsCloud, canManageMembers]);

  useEffect(() => {
    if (activeTab !== "members") return;
    loadMembers();
  }, [activeTab, loadMembers]);

  const handleInviteSubmit = async () => {
    if (!selectedWorkspace || !inviteEmail.trim()) return;
    setInviteSubmitting(true);
    try {
      const invite = await workspaceApiClient.createInvite(selectedWorkspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setWorkspaceInvites((prev) => [invite, ...prev]);
      setInviteEmail("");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleMemberRoleChange = async (memberId: string, role: WorkspaceRole) => {
    if (!selectedWorkspace) return;
    setMemberActionId(memberId);
    try {
      await workspaceApiClient.updateMemberRole(selectedWorkspace.id, memberId, role);
      setMembers((prev) => prev.map((member) => (member.user_id === memberId ? { ...member, role } : member)));
    } finally {
      setMemberActionId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedWorkspace) return;
    setMemberActionId(memberId);
    try {
      await workspaceApiClient.removeMember(selectedWorkspace.id, memberId);
      setMembers((prev) => prev.filter((member) => member.user_id !== memberId));
    } finally {
      setMemberActionId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedWorkspace) return;
    setInviteActionId(inviteId);
    try {
      await workspaceApiClient.revokeInvite(selectedWorkspace.id, inviteId);
      setWorkspaceInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } finally {
      setInviteActionId(null);
    }
  };

  if (isLoading && !selectedWorkspace) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${classes.textMuted}`}>
        Loading workspaces...
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full px-4 py-4 sm:px-8 sm:py-6 ${classes.text}`}>
      <div className={`sticky top-0 z-20 -mx-4 px-4 py-3 sm:mx-0 sm:px-0 ${classes.borderStrong} ${isDark ? "bg-zinc-950/80" : "bg-white/80"} backdrop-blur`}>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-end gap-2">
            <div className={`border-r pr-2 ${classes.border}`}>
              <div className={`text-xl font-black ${classes.text}`}>
                {selectedWorkspace?.name}
              </div>
            </div>
            <div className="text-xl">
              {activeTab == 'files' ? "Diagrams" : activeTab == 'members' ? "Members" : activeTab == 'trash' ? "Trash" : "Settings"}
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="relative" aria-busy={isLoading}>
        {activeTab === "members" ? (
          <WorkspaceMembersTab
            membersError={membersError}
            canManageMembers={canManageMembers}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            inviteSubmitting={inviteSubmitting}
            handleInviteSubmit={handleInviteSubmit}
            members={members}
            membersLoading={membersLoading}
            memberActionId={memberActionId}
            handleMemberRoleChange={handleMemberRoleChange}
            handleRemoveMember={handleRemoveMember}
            workspaceInvites={workspaceInvites}
            inviteActionId={inviteActionId}
            handleRevokeInvite={handleRevokeInvite}
            formatRoleLabel={formatRoleLabel}
            formatDate={formatDate}
            getInitials={getInitials}
          />
        ) : activeTab === "settings" && canManageWorkspace ? (
          <WorkspaceSettingsTab
            workspaceNameInput={workspaceNameInput}
            setWorkspaceNameInput={setWorkspaceNameInput}
            renameSubmitting={renameSubmitting}
            handleRenameWorkspace={handleRenameWorkspace}
            selectedWorkspaceName={selectedWorkspace?.name ?? ""}
          />

          ) : activeTab === "trash" && canManageWorkspace ? (
            <WorkspaceTrashTab
              selectedWorkspace={selectedWorkspace}
              canManageWorkspace={canManageWorkspace}
              formatDate={formatDate}
              onRefresh={() => selectedWorkspace && loadWorkspaceContents(selectedWorkspace, currentFolder?.id, true)}
            />
        ) : (
          <WorkspaceFilesTab
            folderPath={folderPath}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleCreateFolder={handleCreateFolder}
            handleCreateDiagram={handleCreateDiagram}
            handleBreadcrumbNavigate={(targetFolderId) => router.push(buildWorkspaceUrl(targetFolderId))}
            filteredFolders={filteredFolders}
                  filteredDiagrams={filteredDiagrams}
                  handleFolderClick={handleFolderClick}
            handleDiagramClick={handleDiagramClick}
            handleDiagramContextMenu={(e, diagram) => handleContextMenu(e, "diagram", diagram)}
            formatDate={formatDate}
                  onRenameDiagram={canRename ? handleRenameDiagram : undefined}
                  onDeleteDiagram={canDelete ? (id, name) => handleDeleteRequest("diagram", { id, name } as any) : undefined}
                  onRenameFolder={canRename ? handleRenameFolder : undefined}
                  onDeleteFolder={canDelete ? (id, name) => handleDeleteRequest("folder", { id, name } as any) : undefined}
                  canCreate={canCreate}
                  canRename={canRename}
                  canDelete={canDelete}
          />
        )}
        {isLoading && (
          <div
            className={`absolute inset-0 z-10 flex items-start justify-center pt-16 backdrop-blur-[1px] ${
              isDark ? "bg-zinc-950/40" : "bg-white/70"
            }`}
          >
            <div className={`rounded-full border px-4 py-2 text-sm shadow ${classes.surface} ${classes.text}`}>
              Loading...
            </div>
          </div>
        )}
      </div>

      <div />
    </div>
  );
}
