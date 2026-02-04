"use client";

import { useAuth } from "@/contexts/AuthContext";
import { syncManager } from "@/lib/SyncManager";
import { workspaceApiClient } from "@/lib/workspace-client";

import {
  DEFAULT_WORKSPACE_ID,
  workspaceStore,
  type DiagramItem,
  type FolderItem,
  type Workspace,
} from "@/lib/workspace-store";

import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  CloudUpload,
  Copy,
  File,
  Folder,
  FolderPlus,
  Laptop,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface WorkspacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspaceId?: string;
  currentDiagramId?: string;
  theme?: "light" | "dark";
  variant?: "modal" | "page";
  initialView?: "workspaces" | "contents";
}

interface WorkspaceWithStats extends Workspace {
  diagramCount: number;
  folderCount: number;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: "folder" | "diagram" | "workspace" | null;
  item: FolderItem | DiagramItem | Workspace | null;
}

export default function WorkspacesModal({
  isOpen,
  onClose,
  currentWorkspaceId,
  currentDiagramId,
  theme = "dark",
  variant = "modal",
  initialView = "contents",
}: WorkspacesModalProps) {
  const router = useRouter();
  const { isAuthenticated, isNewSignup, clearNewSignupFlag } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = theme === "dark";
  const isPage = variant === "page";

  // Navigation state - separate cloud and local workspaces
  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [cloudWorkspaces, setCloudWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspaceIsCloud, setSelectedWorkspaceIsCloud] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [folderPath, setFolderPath] = useState<FolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWorkspacesList, setShowWorkspacesList] = useState(initialView === "workspaces");
  const [moveSourceWorkspace, setMoveSourceWorkspace] = useState<Workspace | null>(null);
  const [moveTargetWorkspaceId, setMoveTargetWorkspaceId] = useState<string>("");


  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    type: null,
    item: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Rename state
  const [renameItem, setRenameItem] = useState<{ type: "folder" | "diagram" | "workspace"; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Mount for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Load default workspace when modal opens
  useEffect(() => {
    if (isPage || isOpen) {
      setSearchQuery("");
      loadWorkspacesAndOpen();
    }
  }, [isOpen, isPage]);

  // Close on escape
  useEffect(() => {
    if (!isOpen || isPage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu.isOpen) {
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        } else if (renameItem) {
          setRenameItem(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPage, onClose, contextMenu.isOpen, renameItem]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu.isOpen]);

  // Focus rename input
  useEffect(() => {
    if (renameItem && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameItem]);

  const loadWorkspacesAndOpen = async () => {
    setIsLoading(true);
    try {
      await workspaceStore.init();

      // 1. Load local workspaces from IndexedDB (Always treat as Local)
      const allLocalWorkspaces = await workspaceStore.getWorkspaces();
      const localWithStats = await Promise.all(
        allLocalWorkspaces.map(async (ws) => {
          const stats = await workspaceStore.getWorkspaceStats(ws.id);
          return { ...ws, diagramCount: stats.diagramCount, folderCount: stats.folderCount };
        })
      );

      const emptyLocal = localWithStats.filter((ws) => ws.diagramCount === 0);
      if (emptyLocal.length > 0) {
        await Promise.all(emptyLocal.map((ws) => workspaceStore.deleteWorkspace(ws.id)));
      }
      const nonEmptyLocal = localWithStats.filter((ws) => ws.diagramCount > 0);

      // Update local workspaces state
      setLocalWorkspaces(nonEmptyLocal);

      // 2. Load cloud workspaces from API
      let apiWorkspaces: WorkspaceWithStats[] = [];
      if (isAuthenticated) {
        try {
          const cloudList = await workspaceApiClient.listWorkspaces();
          // Map API response to UI model using included stats
          apiWorkspaces = cloudList.map(w => ({
            id: w.id,
            name: w.name,
            createdAt: w.created_at,
            updatedAt: w.updated_at,
            diagramCount: w.diagram_count || 0,
            folderCount: w.folder_count || 0,
          }));
          setCloudWorkspaces(apiWorkspaces);
        } catch (err) {
          console.warn("Failed to fetch cloud workspaces:", err);
        }

        // First-time signup migration
        if (isNewSignup && nonEmptyLocal.length > 0) {
          const workspaceToMigrate = nonEmptyLocal[0];
          try {
            if (apiWorkspaces.length > 0) {
              const targetWorkspaceId = apiWorkspaces[0].id;
              const result = await syncManager.moveWorkspaceToExistingCloud(
                workspaceToMigrate.id,
                targetWorkspaceId
              );
              if (result.success) {
                const refreshed = await workspaceApiClient.listWorkspaces();
                setCloudWorkspaces(refreshed.map(w => ({
                  id: w.id,
                  name: w.name,
                  createdAt: w.created_at,
                  updatedAt: w.updated_at,
                  diagramCount: w.diagram_count || 0,
                  folderCount: w.folder_count || 0,
                })));
                setLocalWorkspaces(prev => prev.filter(w => w.id !== workspaceToMigrate.id));
              }
            } else {
              const result = await syncManager.moveWorkspaceToCloud(workspaceToMigrate.id);
              if (result.success) {
                const newCloudWs: WorkspaceWithStats = {
                  id: result.cloudId!,
                  name: workspaceToMigrate.name,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  diagramCount: workspaceToMigrate.diagramCount,
                  folderCount: workspaceToMigrate.folderCount,
                };
                setCloudWorkspaces(prev => [...prev, newCloudWs]);
                setLocalWorkspaces(prev => prev.filter(w => w.id !== workspaceToMigrate.id));
              }
            }
          } catch (err) {
            console.error("Failed to migrate workspace on signup:", err);
          }
          clearNewSignupFlag();
        }
      } else {
        setCloudWorkspaces([]);
      }

      // Open default or current workspace
      const targetId = currentWorkspaceId || DEFAULT_WORKSPACE_ID;
      // Check in API list first
      const cloudTarget = apiWorkspaces.find(w => w.id === targetId);
      const localTarget = localWithStats.find(w => w.id === targetId);

      const targetWorkspace = cloudTarget || localTarget || apiWorkspaces[0] || localWithStats[0];
      
      if (targetWorkspace) {
        // Explicitly pass whether it's cloud to avoid race condition with state setCloudWorkspaces
        const isCloudTarget = !!cloudTarget || (isAuthenticated && apiWorkspaces.length > 0 && !localTarget && targetWorkspace === apiWorkspaces[0]);
        await loadWorkspaceContents(targetWorkspace, undefined, isCloudTarget);
      }
      setShowWorkspacesList(initialView === "workspaces");
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    } finally {
      setIsLoading(false);
    }
  };



  const loadWorkspaceContents = useCallback(
    async (workspace: Workspace, folderId?: string, isCloudOverride?: boolean) => {
      setIsLoading(true);
      try {
        setSelectedWorkspace(workspace);
        // Check if it's a cloud workspace
        const isCloud = isCloudOverride ?? cloudWorkspaces.some(w => w.id === workspace.id);
        setSelectedWorkspaceIsCloud(isCloud);

        if (isCloud) {
          // Cloud: Fetch from API
          const files = await workspaceApiClient.listFiles(workspace.id);

          // Map to internal types
          const mappedFolders: FolderItem[] = files.folders.map(f => ({
            id: f.id,
            workspaceId: f.workspace_id,
            parentFolderId: f.parent_folder_id,
            name: f.name,
            createdAt: f.created_at,
            updatedAt: f.updated_at
          }));

          const mappedDiagrams: DiagramItem[] = files.diagrams.map(d => ({
            id: d.id,
            workspaceId: d.workspace_id,
            folderId: d.folder_id,
            name: d.name,
            fileUrl: d.file_url,
            thumbnail: d.thumbnail,
            thumbnailUrl: d.thumbnail_url,
            createdAt: d.created_at,
            updatedAt: d.updated_at
          }));

          // Handle folder path navigation
          if (folderId) {
            const path: FolderItem[] = [];
            let currentId: string | undefined = folderId;
            let depth = 0;
            while (currentId && depth < 20) {
               
              const folder = mappedFolders.find(f => f.id === currentId);
              if (folder) {
                path.unshift(folder);
                currentId = folder.parentFolderId;
                depth++;
              } else {
                break;
              }
            }
            setFolderPath(path);
            const current = mappedFolders.find(f => f.id === folderId);
            setCurrentFolder(current || null);
          } else {
            setFolderPath([]);
            setCurrentFolder(null);
          }

          // Filter for current view
          const currentFolders = mappedFolders.filter(f =>
            folderId ? f.parentFolderId === folderId : !f.parentFolderId
          );
          const currentDiagrams = mappedDiagrams.filter(d =>
            folderId ? d.folderId === folderId : !d.folderId
          );

          setFolders(currentFolders);
          setDiagrams(currentDiagrams);

        } else {
        // Local: Fetch from IndexedDB
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

        setShowWorkspacesList(false);
      } catch (error) {
        console.error("Failed to load workspace contents:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [cloudWorkspaces]
  );

  const handleWorkspaceClick = (workspace: Workspace) => {
    loadWorkspaceContents(workspace);
  };

  const handleFolderClick = (folder: FolderItem) => {
    if (selectedWorkspace) {
      loadWorkspaceContents(selectedWorkspace, folder.id);
    }
  };

  const handleDiagramClick = (diagram: DiagramItem) => {
    onClose();
    if (selectedWorkspaceIsCloud) {
      // Cloud workspace: /workspace?workspaceId=...&diagramId=...
      router.push(`/workspace?workspaceId=${selectedWorkspace?.id}&diagramId=${diagram.id}`);
    } else {
      // Local workspace: /local?workspaceId=...&diagramId=...
      router.push(`/local?workspaceId=${selectedWorkspace?.id}&diagramId=${diagram.id}`);
    }
  };

  const handleBack = () => {
    if (currentFolder && folderPath.length > 1) {
      const parentFolder = folderPath[folderPath.length - 2];
      if (selectedWorkspace) {
        loadWorkspaceContents(selectedWorkspace, parentFolder.id);
      }
    } else if (currentFolder && selectedWorkspace) {
      loadWorkspaceContents(selectedWorkspace);
    } else {
      setShowWorkspacesList(true);
    }
  };

  const handleCreateDiagram = async () => {
    if (!selectedWorkspace) return;
    try {
      let diagramId: string;

      if (selectedWorkspaceIsCloud) {
        // Create in cloud
        const res = await workspaceApiClient.createDiagram(selectedWorkspace.id, {
          name: "Untitled Diagram",
          folder_id: currentFolder?.id
        });
        diagramId = res.id;

        onClose();
        router.push(`/workspace?workspaceId=${selectedWorkspace.id}&diagramId=${diagramId}`);
      } else {
      // Create locally
        const diagram = await workspaceStore.createDiagram({
          id: crypto.randomUUID(),
          workspaceId: selectedWorkspace.id,
          folderId: currentFolder?.id,
          name: "Untitled Diagram",
        });
        diagramId = diagram.id;

        onClose();
        router.push(`/local?workspaceId=${selectedWorkspace.id}&diagramId=${diagramId}`);
      }
    } catch (error) {
      console.error("Failed to create diagram:", error);
    }
  };

  const handleCreateFolder = async () => {
    if (!selectedWorkspace) return;
    try {
      if (selectedWorkspaceIsCloud) {
        // Create in cloud
        await workspaceApiClient.createFolder(selectedWorkspace.id, {
          name: "New Folder",
          parent_folder_id: currentFolder?.id
        });
        // Reload to show new folder
        loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
      } else {
      // Create locally
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

  const handleCreateWorkspace = async () => {
    try {
      if (isAuthenticated) {
        // Create cloud workspace via API
        const cloudWs = await workspaceApiClient.createWorkspace({
          name: "New Workspace",
        });

        const newWs: WorkspaceWithStats = {
          id: cloudWs.id,
          name: cloudWs.name,
          createdAt: cloudWs.created_at,
          updatedAt: cloudWs.updated_at,
          diagramCount: 0,
          folderCount: 0,
        };
        setCloudWorkspaces((prev) => [...prev, newWs]);
        loadWorkspaceContents(newWs, undefined, true);
      } else {
        // Create local workspace
        const now = new Date().toISOString();
        const newWorkspace = await workspaceStore.createWorkspace({
          id: crypto.randomUUID(),
          name: "New Workspace",
          createdAt: now,
          updatedAt: now,
        });

        const newWsWithStats: WorkspaceWithStats = {
          ...newWorkspace,
          diagramCount: 0,
          folderCount: 0,
        };
        setLocalWorkspaces((prev) => [...prev, newWsWithStats]);
        loadWorkspaceContents(newWorkspace, undefined, false);
      }
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  };


  // Context menu handlers
  const handleContextMenu = (
    e: React.MouseEvent,
    type: "folder" | "diagram" | "workspace",
    item: FolderItem | DiagramItem | Workspace
  ) => {
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
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleRename = () => {
    if (!contextMenu.item || !contextMenu.type) return;
    setRenameItem({ type: contextMenu.type, id: contextMenu.item.id });
    setRenameValue(contextMenu.item.name);
    closeContextMenu();
  };

  const handleRenameSubmit = async () => {
    if (!renameItem || !renameValue.trim()) {
      setRenameItem(null);
      return;
    }

    try {
      const isCloud = cloudWorkspaces.some(w => w.id === renameItem.id) || selectedWorkspaceIsCloud;

      if (isCloud && isAuthenticated) {
        // Cloud Rename
        if (renameItem.type === "folder" && selectedWorkspace) {
          await workspaceApiClient.updateFolder(selectedWorkspace.id, renameItem.id, { name: renameValue.trim() });
          loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
        } else if (renameItem.type === "diagram" && selectedWorkspace) {
          await workspaceApiClient.updateDiagram(selectedWorkspace.id, renameItem.id, { name: renameValue.trim() });
          loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
        } else if (renameItem.type === "workspace") {
          await workspaceApiClient.updateWorkspace(renameItem.id, { name: renameValue.trim() });
          // Reload workspace list
          const list = await workspaceApiClient.listWorkspaces();
          const updatedList: WorkspaceWithStats[] = list.map(w => ({
            id: w.id,
            name: w.name,
            isDefault: false,
            createdAt: w.created_at,
            updatedAt: w.updated_at,
            diagramCount: 0,
            folderCount: 0
          }));
          setCloudWorkspaces(updatedList);
        }
      } else {
      // Local Rename
        if (renameItem.type === "folder") {
          await workspaceStore.updateFolder(renameItem.id, { name: renameValue.trim() });
          setFolders(prev => prev.map(f => f.id === renameItem.id ? { ...f, name: renameValue.trim() } : f));
        } else if (renameItem.type === "diagram") {
          await workspaceStore.updateDiagram(renameItem.id, { name: renameValue.trim() });
          setDiagrams(prev => prev.map(d => d.id === renameItem.id ? { ...d, name: renameValue.trim() } : d));
        } else if (renameItem.type === "workspace") {
          await workspaceStore.updateWorkspace(renameItem.id, { name: renameValue.trim() });
          setLocalWorkspaces(prev => prev.map(w => w.id === renameItem.id ? { ...w, name: renameValue.trim() } : w));
          if (selectedWorkspace?.id === renameItem.id) {
            setSelectedWorkspace(prev => prev ? { ...prev, name: renameValue.trim() } : null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to rename:", error);
    }
    setRenameItem(null);
  };

  const handleDelete = async () => {
    if (!contextMenu.item || !contextMenu.type) return;
    const item = contextMenu.item;
    const type = contextMenu.type;
    closeContextMenu();

    try {
      const isCloud = cloudWorkspaces.some(w => w.id === item.id) || selectedWorkspaceIsCloud;

      if (isCloud && isAuthenticated) {
        // Cloud Delete
        if (type === "folder" && selectedWorkspace) {
          await workspaceApiClient.deleteFolder(selectedWorkspace.id, item.id);
          loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
        } else if (type === "diagram" && selectedWorkspace) {
          await workspaceApiClient.deleteDiagram(selectedWorkspace.id, item.id); // Assuming method exists
          loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
        } else if (type === "workspace") {
          const ws = item as Workspace;
          await workspaceApiClient.deleteWorkspace(ws.id);
          setCloudWorkspaces(prev => prev.filter(w => w.id !== item.id));
          if (selectedWorkspace?.id === item.id) {
            setShowWorkspacesList(true);
            setSelectedWorkspace(null); // Clear selection
          }
        }
      } else {
      // Local Delete
        if (type === "folder") {
          await workspaceStore.deleteFolder(item.id);
          setFolders(prev => prev.filter(f => f.id !== item.id));
        } else if (type === "diagram") {
          await workspaceStore.deleteDiagram(item.id);
          setDiagrams(prev => prev.filter(d => d.id !== item.id));
        } else if (type === "workspace") {
          const ws = item as Workspace;
          await workspaceStore.deleteWorkspace(item.id);
          setLocalWorkspaces(prev => prev.filter(w => w.id !== item.id));
          if (selectedWorkspace?.id === item.id) {
            setShowWorkspacesList(true);
            setSelectedWorkspace(null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleDuplicate = async () => {
    if (!contextMenu.item || !contextMenu.type) return;
    const item = contextMenu.item;
    const type = contextMenu.type;
    closeContextMenu();

    try {
      if (selectedWorkspaceIsCloud && isAuthenticated) {
        // Cloud Duplicate
        if (type === "diagram" && selectedWorkspace) {
          const diagram = item as DiagramItem;
          // Download content
          const blob = await workspaceApiClient.downloadDiagram(selectedWorkspace.id, diagram.id);
          // Create new diagram with content
          await workspaceApiClient.createDiagram(selectedWorkspace.id, {
            name: `${diagram.name} (Copy)`,
            folder_id: diagram.folderId
          }, blob);
          loadWorkspaceContents(selectedWorkspace, currentFolder?.id);
        }
        // Folder duplication not fully supported in cloud yet (needs recursive copy).
      } else {
      // Local Duplicate
        if (type === "diagram" && selectedWorkspace) {
          const diagram = item as DiagramItem;
          const duplicated = await workspaceStore.createDiagram({
            id: crypto.randomUUID(),
            workspaceId: selectedWorkspace.id,
            folderId: diagram.folderId,
            name: `${diagram.name} (Copy)`,
            data: diagram.data,
          });
          setDiagrams(prev => [...prev, duplicated]);
        } else if (type === "folder" && selectedWorkspace) {
          const folder = item as FolderItem;
          const duplicated = await workspaceStore.createFolder(
            selectedWorkspace.id,
            `${folder.name} (Copy)`,
            folder.parentFolderId
          );
          setFolders(prev => [...prev, duplicated]);
        }
      }
    } catch (error) {
      console.error("Failed to duplicate:", error);
    }
  };

  const handleOpenMoveModal = (workspace: Workspace) => {
    if (!cloudWorkspaces.length) return;
    setMoveSourceWorkspace(workspace);
    setMoveTargetWorkspaceId(cloudWorkspaces[0].id);
  };

  const handleMoveToCloud = async () => {
    if (!moveSourceWorkspace || !moveTargetWorkspaceId) return;
    try {
      const result = await syncManager.moveWorkspaceToExistingCloud(
        moveSourceWorkspace.id,
        moveTargetWorkspaceId
      );
      if (result.success) {
        setLocalWorkspaces(prev => prev.filter(w => w.id !== moveSourceWorkspace.id));
        if (isAuthenticated) {
          const cloudList = await workspaceApiClient.listWorkspaces();
          setCloudWorkspaces(cloudList.map(w => ({
            id: w.id,
            name: w.name,
            createdAt: w.created_at,
            updatedAt: w.updated_at,
            diagramCount: w.diagram_count || 0,
            folderCount: w.folder_count || 0,
          })));
        }
      } else if (result.error) {
        console.error("Failed to move workspace to cloud:", result.error);
      }
    } catch (error) {
      console.error("Failed to move workspace to cloud:", error);
    } finally {
      setMoveSourceWorkspace(null);
    }
  };

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

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiagrams = diagrams.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isPage && (!isOpen || !mounted)) return null;

  const content = (
    <div
      className={
        isPage
          ? "relative w-full min-h-screen p-6"
          : "fixed inset-0 z-[9999] flex items-center justify-center p-4"
      }
    >
      {/* Backdrop */}
      {!isPage && (
        <div
          className={`absolute inset-0 backdrop-blur-md ${isDark ? "bg-black/70" : "bg-black/40"}`}
          onClick={onClose}
        />
      )}

      {/* Modal */}
      <div
        className={`relative overflow-hidden flex flex-col ${
          isPage
            ? "w-full min-h-[calc(100vh-3rem)]"
            : "rounded-2xl border shadow-2xl w-[900px] max-w-[95vw] h-[600px] max-h-[85vh]"
        } ${
          isDark
            ? isPage
              ? "bg-zinc-950"
              : "bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-700/50"
            : isPage
              ? "bg-white"
              : "bg-gradient-to-b from-white to-gray-50 border-gray-200"
        }`}
      >
        {/* Decorative gradient */}
        {!isPage && (
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#36C3AD]/5 to-transparent pointer-events-none" />
        )}
        
        {/* Header */}
        <div className={`relative flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-zinc-800/50" : "border-gray-200"}`}>
          <div className="flex items-center gap-4">
            {/* Back / Workspaces toggle */}
            {!showWorkspacesList && selectedWorkspace && (
              <button
                onClick={handleBack}
                className={`p-2 -ml-2 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWorkspacesList(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  showWorkspacesList 
                  ? isDark ? "bg-zinc-800 text-white" : "bg-gray-200 text-gray-900"
                  : isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="font-medium">Workspaces</span>
              </button>

              {selectedWorkspace && !showWorkspacesList && (
                <>
                  <ChevronRight className={`w-4 h-4 ${isDark ? "text-zinc-600" : "text-gray-400"}`} />
                  <button
                    onClick={() => loadWorkspaceContents(selectedWorkspace)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                      !currentFolder
                      ? isDark ? "bg-zinc-800 text-white" : "bg-gray-200 text-gray-900"
                      : isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <span className="font-medium">{selectedWorkspace.name}</span>
                  </button>
                </>
              )}

              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 ${isDark ? "text-zinc-600" : "text-gray-400"}`} />
                  <button
                    onClick={() => {
                      if (selectedWorkspace) {
                        loadWorkspaceContents(selectedWorkspace, folder.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                      index === folderPath.length - 1
                      ? isDark ? "bg-zinc-800 text-white" : "bg-gray-200 text-gray-900"
                      : isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span className="font-medium">{folder.name}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Create Workspace button (always visible) */}
            {showWorkspacesList && (
              <button
                onClick={handleCreateWorkspace}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-[#36C3AD]/20"
              >
                <Plus className="w-4 h-4" />
                New Workspace
              </button>
            )}

            {/* Back to workspaces (authenticated only) */}
            {isAuthenticated && (
              <button
                onClick={() => router.push("/workspace")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Back to workspaces
              </button>
            )}

            {!isPage && (
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Bar (for workspace/folder view) */}
        {!showWorkspacesList && selectedWorkspace && (
          <div className={`flex items-center justify-between px-6 py-3 border-b ${isDark ? "border-zinc-800/30 bg-zinc-900/50" : "border-gray-200 bg-gray-50/50"}`}>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateFolder}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white" : "border-gray-300 hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
              <button
                onClick={handleCreateDiagram}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 text-sm font-semibold transition-all hover:shadow-lg hover:shadow-[#36C3AD]/20"
              >
                <Sparkles className="w-4 h-4" />
                New Diagram
              </button>
            </div>

            <div className="relative w-64">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-zinc-500" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:border-[#36C3AD]/50 transition-all text-sm ${isDark ? "bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 focus:bg-zinc-800" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:bg-white"}`}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className={`flex items-center gap-3 ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                <div className="w-5 h-5 border-2 border-[#36C3AD]/30 border-t-[#36C3AD] rounded-full animate-spin" />
                Loading...
              </div>
            </div>
          ) : showWorkspacesList ? (
              // Workspaces Grid - Split by Cloud and Local
              <div className="space-y-8">
                {/* Cloud Workspaces Section (when authenticated) */}
                {isAuthenticated && cloudWorkspaces.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        <Cloud className="w-3.5 h-3.5 inline mr-1.5" />
                        Your Workspaces
                      </h2>
                      <span className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        {cloudWorkspaces.length} workspace{cloudWorkspaces.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                      {cloudWorkspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => handleWorkspaceClick(workspace)}
                          onContextMenu={(e) => handleContextMenu(e, "workspace", workspace)}
                          className={`group text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 ${workspace.id === selectedWorkspace?.id
                            ? "bg-[#36C3AD]/10 border-[#36C3AD]/50"
                            : isDark
                              ? "bg-zinc-800/30 border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/50"
                              : "bg-white border-gray-200 hover:border-[#36C3AD]/50 hover:bg-gray-50"
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400">
                              <Cloud className="w-3 h-3" />
                              Cloud
                            </span>
                          </div>

                          {renameItem?.type === "workspace" && renameItem.id === workspace.id ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={handleRenameSubmit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit();
                                if (e.key === "Escape") setRenameItem(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-lg font-semibold bg-transparent border border-[#36C3AD]/50 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[#36C3AD]/30 w-full mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                            />
                          ) : (
                            <h3 className={`text-base sm:text-lg font-semibold group-hover:text-[#36C3AD] transition-colors mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                              {workspace.name}
                            </h3>
                          )}

                          <div className={`flex items-center justify-between text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                            <span>{workspace.diagramCount} diagram{workspace.diagramCount !== 1 ? "s" : ""}</span>
                            <span>{formatDate(workspace.updatedAt)}</span>
                          </div>
                        </button>
                      ))}

                      {/* New Workspace Card (creates cloud workspace when authenticated) */}
                      <button
                        onClick={handleCreateWorkspace}
                        className={`group flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border-2 border-dashed transition-all duration-200 min-h-[120px] sm:min-h-[140px] ${isDark ? "border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/30" : "border-gray-300 hover:border-[#36C3AD]/50 hover:bg-gray-50"}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${isDark ? "bg-zinc-800 group-hover:bg-[#36C3AD]/10" : "bg-gray-100 group-hover:bg-[#36C3AD]/10"}`}>
                          <Plus className={`w-6 h-6 group-hover:text-[#36C3AD] transition-colors ${isDark ? "text-zinc-500" : "text-gray-400"}`} />
                        </div>
                        <span className={`text-sm font-medium transition-colors ${isDark ? "text-zinc-400 group-hover:text-zinc-200" : "text-gray-500 group-hover:text-gray-700"}`}>
                          New Workspace
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Local Workspaces Section */}
                {localWorkspaces.length > 0 && (
                  <div>
                    {/* Divider when showing both sections */}
                    {isAuthenticated && cloudWorkspaces.length > 0 && (
                      <div className={`border-t pt-6 mb-4 ${isDark ? "border-zinc-700/50" : "border-gray-200"}`} />
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        <Laptop className="w-3.5 h-3.5 inline mr-1.5" />
                        Local Workspaces
                      </h2>
                      <span className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        {localWorkspaces.length} workspace{localWorkspaces.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                      {localWorkspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => handleWorkspaceClick(workspace)}
                          onContextMenu={(e) => handleContextMenu(e, "workspace", workspace)}
                          className={`group text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 ${workspace.id === selectedWorkspace?.id
                            ? "bg-[#36C3AD]/10 border-[#36C3AD]/50"
                            : isDark
                              ? "bg-zinc-800/30 border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/50"
                              : "bg-white border-gray-200 hover:border-[#36C3AD]/50 hover:bg-gray-50"
                        }`}
                      >
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${isDark ? "bg-zinc-700/50 text-zinc-400" : "bg-gray-100 text-gray-500"}`}>
                            <Laptop className="w-3 h-3" />
                              Local
                            </span>
                          </div>

                          {renameItem?.type === "workspace" && renameItem.id === workspace.id ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={handleRenameSubmit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit();
                                if (e.key === "Escape") setRenameItem(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-lg font-semibold bg-transparent border border-[#36C3AD]/50 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[#36C3AD]/30 w-full mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                            />
                          ) : (
                            <h3 className={`text-lg font-semibold group-hover:text-[#36C3AD] transition-colors mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                              {workspace.name}
                            </h3>
                          )}

                          <div className={`flex items-center justify-between text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                            <span>{workspace.diagramCount} diagram{workspace.diagramCount !== 1 ? "s" : ""}</span>
                            <span>{formatDate(workspace.updatedAt)}</span>
                          </div>
                        </button>
                      ))}

                      {/* New Workspace Card (when not authenticated) */}
                      {!isAuthenticated && (
                        <button
                          onClick={handleCreateWorkspace}
                          className={`group flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed transition-all duration-200 min-h-[140px] ${isDark ? "border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/30" : "border-gray-300 hover:border-[#36C3AD]/50 hover:bg-gray-50"}`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${isDark ? "bg-zinc-800 group-hover:bg-[#36C3AD]/10" : "bg-gray-100 group-hover:bg-[#36C3AD]/10"}`}>
                            <Plus className={`w-6 h-6 group-hover:text-[#36C3AD] transition-colors ${isDark ? "text-zinc-500" : "text-gray-400"}`} />
                          </div>
                          <span className={`text-sm font-medium transition-colors ${isDark ? "text-zinc-400 group-hover:text-zinc-200" : "text-gray-500 group-hover:text-gray-700"}`}>
                            New Workspace
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state when no workspaces at all */}
                {cloudWorkspaces.length === 0 && localWorkspaces.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-zinc-800/50" : "bg-gray-100"}`}>
                      <LayoutGrid className={`w-8 h-8 ${isDark ? "text-zinc-600" : "text-gray-400"}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                      No workspaces yet
                    </h3>
                    <p className={`mb-6 max-w-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                      Create your first workspace to get started
                    </p>
                    <button
                      onClick={handleCreateWorkspace}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 font-semibold transition-all hover:shadow-lg hover:shadow-[#36C3AD]/20"
                    >
                      <Plus className="w-5 h-5" />
                      Create Workspace
                    </button>
                  </div>
                )}
            </div>

          ) : (
            // Workspace Contents
            <div className="space-y-6">
              {filteredFolders.length === 0 && filteredDiagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-zinc-800/50" : "bg-gray-100"}`}>
                        <File className={`w-8 h-8 ${isDark ? "text-zinc-600" : "text-gray-400"}`} />
                  </div>
                      <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                    {searchQuery ? "No results found" : "Empty folder"}
                  </h3>
                      <p className={`mb-6 max-w-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                    {searchQuery ? "Try a different search term" : "Create your first diagram to get started"}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={handleCreateDiagram}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 font-semibold transition-all hover:shadow-lg hover:shadow-[#36C3AD]/20"
                    >
                      <Sparkles className="w-5 h-5" />
                      Create Diagram
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Folders */}
                  {filteredFolders.length > 0 && (
                    <div>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        Folders
                      </h3>
                      <div className="grid grid-cols-4 gap-3">
                        {filteredFolders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => handleFolderClick(folder)}
                            onContextMenu={(e) => handleContextMenu(e, "folder", folder)}
                            className={`group flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${isDark ? "bg-zinc-800/30 border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/50" : "bg-white border-gray-200 hover:border-[#36C3AD]/50 hover:bg-gray-50"}`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:bg-[#36C3AD]/10 transition-colors ${isDark ? "bg-zinc-700/50" : "bg-gray-100"}`}>
                              <Folder className={`w-5 h-5 group-hover:text-[#36C3AD] transition-colors ${isDark ? "text-zinc-400" : "text-gray-500"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {renameItem?.type === "folder" && renameItem.id === folder.id ? (
                                <input
                                  ref={renameInputRef}
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={handleRenameSubmit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameSubmit();
                                    if (e.key === "Escape") setRenameItem(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`font-medium bg-transparent border border-[#36C3AD]/50 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-[#36C3AD]/30 w-full ${isDark ? "text-white" : "text-gray-900"}`}
                                />
                              ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-medium truncate group-hover:text-[#36C3AD] transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>
                                      {folder.name}
                                    </span>
                                  </div>
                              )}
                              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-500"}`}>{formatDate(folder.updatedAt)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagrams */}
                  {filteredDiagrams.length > 0 && (
                    <div>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                        Diagrams
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                        {filteredDiagrams.map((diagram) => (
                          <button
                            key={diagram.id}
                            onClick={() => handleDiagramClick(diagram)}
                            onContextMenu={(e) => handleContextMenu(e, "diagram", diagram)}
                            className={`group relative text-left rounded-xl border transition-all duration-200 overflow-hidden ${
                              currentDiagramId === diagram.id
                                ? "bg-[#36C3AD]/10 border-[#36C3AD]/50 ring-2 ring-[#36C3AD]/20"
                              : isDark
                                ? "bg-zinc-800/30 border-zinc-700/50 hover:border-[#36C3AD]/50 hover:bg-zinc-800/50"
                                : "bg-white border-gray-200 hover:border-[#36C3AD]/50 hover:bg-gray-50"
                            }`}
                          >
                            {/* Thumbnail */}
                            <div className={`aspect-[16/10] flex items-center justify-center border-b overflow-hidden ${isDark ? "bg-zinc-900 border-zinc-700/30" : "bg-gray-50 border-gray-200"}`}>
                              {diagram.thumbnailUrl ? (
                                <img
                                  src={diagram.thumbnailUrl}
                                  alt={diagram.name}
                                  className="w-full h-full object-cover"
                                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                                />
                              ) : (
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
                                  <File className={`w-6 h-6 ${isDark ? "text-zinc-600" : "text-gray-400"}`} />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-4">
                              {renameItem?.type === "diagram" && renameItem.id === diagram.id ? (
                                <input
                                  ref={renameInputRef}
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={handleRenameSubmit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRenameSubmit();
                                    if (e.key === "Escape") setRenameItem(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`font-medium bg-transparent border border-[#36C3AD]/50 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-[#36C3AD]/30 w-full ${isDark ? "text-white" : "text-gray-900"}`}
                                />
                              ) : (
                                  <div className="flex items-center gap-1.5">
                                  <h4 className={`font-medium truncate group-hover:text-[#36C3AD] transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>
                                      {diagram.name}
                                    </h4>
                                  </div>
                              )}
                              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                                {formatDate(diagram.updatedAt)}
                              </p>
                            </div>

                            {/* Current indicator */}
                            {currentDiagramId === diagram.id && (
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#36C3AD] text-zinc-900 text-xs font-semibold">
                                Current
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {moveSourceWorkspace && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${isDark ? "bg-zinc-950 border-zinc-800/80" : "bg-white border-gray-200"}`}>
            <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              Move local diagrams
            </h3>
            <p className={`mt-2 text-sm ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
              Choose a workspace to move “{moveSourceWorkspace.name}”.
            </p>
            <div className="mt-4">
              <label className={`text-xs uppercase tracking-wide ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                Target workspace
              </label>
              <select
                value={moveTargetWorkspaceId}
                onChange={(e) => setMoveTargetWorkspaceId(e.target.value)}
                className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-gray-300 bg-white text-gray-900"}`}
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
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${isDark ? "border-zinc-800 text-zinc-300 hover:bg-zinc-900" : "border-gray-200 text-gray-600 hover:bg-gray-100"}`}
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

      {contextMenu.isOpen && (
        <div
          ref={contextMenuRef}
          className={`fixed z-[10000] min-w-[160px] py-1 rounded-lg border shadow-2xl ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"}`}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={handleRename}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${isDark ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          {(contextMenu.type === "folder" || contextMenu.type === "diagram") && (
            <button
              onClick={handleDuplicate}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${isDark ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
          )}
          {/* Move to Cloud - only for local workspaces */}
          {contextMenu.type === "workspace" &&
            isAuthenticated &&
            cloudWorkspaces.length > 0 &&
            !cloudWorkspaces.some(w => w.id === contextMenu.item?.id) && (
            <button
              onClick={() => {
                if (!contextMenu.item) return;
                const ws = contextMenu.item as Workspace;
                closeContextMenu();
                handleOpenMoveModal(ws);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${isDark ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
            >
              <CloudUpload className="w-4 h-4" />
              Move to Cloud
            </button>
          )}

          <div className={`h-px my-1 ${isDark ? "bg-zinc-700" : "bg-gray-200"}`} />
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );

  if (isPage) return content;

  return createPortal(content, document.body);
}
