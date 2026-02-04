"use client";

import FeedbackModal from "@/components/FeedbackModal";
import AuthModal from "@/components/modals/AuthModal";
import WelcomeModal from "@/components/modals/WelcomeModal";
import { useAuth } from "@/contexts/AuthContext";
import { CloudStoragePlugin } from "@/lib/CloudStoragePlugin";
import { workspaceApiClient } from "@/lib/workspace-client";
import { workspaceStore } from "@/lib/workspace-store";
import { WorkspaceStoragePlugin } from "@/lib/WorkspaceStoragePlugin";
import { FullPageLoader } from "@canvas";
import { ActiveUsers } from "@canvas/components/ActiveUsers";
import { DiagramNameEditor } from "@canvas/components/DiagramNameEditor";
import { CollaborationPlugin } from "@canvas/plugins/collaboration";
import type { UserPresence } from "@canvas/types/collaboration";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BsCloudCheck } from "react-icons/bs";

// Dynamically import Canvas to avoid SSR issues
const Canvas = dynamic(() => import("@canvas").then((mod) => mod.Canvas), {
  ssr: false,
});

// Import InteractionEngine only on client side
const getInteractionEngine = async () => {
  const { InteractionEngine } = await import("@canvas");
  return InteractionEngine;
};

interface CanvasPageContentProps {
  mode: "local" | "cloud";
}

export default function CanvasPageContent({ mode }: CanvasPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const workspaceId = searchParams.get("workspaceId");
  const diagramId = searchParams.get("diagramId");

  const { user, isAuthenticated, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [engine, setEngine] = useState<any>(null);
  const engineRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  // Initialize from URL params
  const initialAuthAction = searchParams.get('auth_action');
  const [showAuthModal, setShowAuthModal] = useState(initialAuthAction === 'signin' || initialAuthAction === 'signup');
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">((initialAuthAction === 'signin' || initialAuthAction === 'signup') ? initialAuthAction : "signin");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Sync state with URL if params change (optional, but good for back/forward nav)
  useEffect(() => {
    const authAction = searchParams.get('auth_action');
    if (authAction === 'signin' || authAction === 'signup') {
      setAuthModalTab(authAction);
      setShowAuthModal(true);
    }
  }, [searchParams]);

  // Handle modal close
  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    // Cleanup URL
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (newSearchParams.has('auth_action')) {
      newSearchParams.delete('auth_action');
      const newPath = `${pathname}?${newSearchParams.toString()}`;
      router.replace(newPath);
    }
  };

  // Collaboration state (member-only mode)
  const [collaborationPlugin, setCollaborationPlugin] = useState<CollaborationPlugin | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);

  // Context State
  const [workspaceName, setWorkspaceName] = useState(mode === "cloud" ? "Cloud Workspace" : "My Diagrams");
  const [userRole, setUserRole] = useState<"owner" | "admin" | "editor" | "viewer" | null>(null);
  const [folderPath, setFolderPath] = useState<string[]>([]);
  const [folderPathIds, setFolderPathIds] = useState<string[]>([]);
  const [diagramName, setDiagramName] = useState("Untitled");
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(workspaceId || "");
  const [currentDiagramId, setCurrentDiagramId] = useState(diagramId || "");
  
  const buildFolderPathFromCloud = useCallback(async (targetWorkspaceId: string, targetFolderId?: string) => {
    if (!targetFolderId) {
      return { names: [], ids: [] };
    }
    const folders = await workspaceApiClient.listFolders(targetWorkspaceId);
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    const names: string[] = [];
    const ids: string[] = [];
    let currentId: string | undefined = targetFolderId;
    let depth = 0;

    while (currentId && depth < 20) {
      const folder = folderMap.get(currentId);
      if (!folder) break;
      names.unshift(folder.name);
      ids.unshift(folder.id);
      currentId = folder.parent_folder_id;
      depth += 1;
    }

    return { names, ids };
  }, []);

  const buildFolderPathFromLocal = useCallback(async (targetFolderId?: string) => {
    if (!targetFolderId) {
      return { names: [], ids: [] };
    }
    const names: string[] = [];
    const ids: string[] = [];
    let currentId: string | undefined = targetFolderId;
    let depth = 0;

    while (currentId && depth < 20) {
      const folder = await workspaceStore.getFolder(currentId);
      if (!folder) break;
      names.unshift(folder.name);
      ids.unshift(folder.id);
      currentId = folder.parentFolderId;
      depth += 1;
    }

    return { names, ids };
  }, []);

  // Keep ref in sync
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  // Save last visited path (for both modes)
  useEffect(() => {
    if (!mounted) return;
    if (mode === "cloud" && currentWorkspaceId && currentDiagramId) {
      const fullPath = `${pathname}?workspaceId=${currentWorkspaceId}&diagramId=${currentDiagramId}`;
      localStorage.setItem("flowstry:last_visited", fullPath);
      return;
    }
    if (mode === "local") {
      localStorage.setItem("flowstry:last_visited", "/local");
    }
  }, [mounted, currentWorkspaceId, currentDiagramId, pathname, mode]);

  // Initialization Logic
  useEffect(() => {
    let isMounted = true;
    let newEngine: any = null;

    const init = async () => {
      try {
        // Reset state
        setIsLoading(true);

        const InteractionEngine = await getInteractionEngine();
        if (!isMounted) return;

        newEngine = new InteractionEngine();
        
        let targetWorkspaceId = workspaceId;
        let targetDiagramId = diagramId;
        
        if (mode === "cloud") {
            // --- CLOUD MODE ---
            if (!workspaceId || !diagramId) {
                console.warn("Missing workspaceId or diagramId in URL for cloud mode");
                setIsLoading(false);
                return;
            }

            // Fetch info
            const workspace = await workspaceApiClient.getWorkspace(workspaceId);
          if (workspace && isMounted) {
            setWorkspaceName(workspace.name);
            if (workspace.user_role) {
              setUserRole(workspace.user_role);
            }
          }

            const diagram = await workspaceApiClient.getDiagram(workspaceId, diagramId);
            if (!diagram) {
                console.error("Cloud diagram not found");
                if (isMounted) setIsLoading(false);
                return;
            }
            if (isMounted) {
              setDiagramName(diagram.name);
              setCurrentWorkspaceId(workspaceId);
              setCurrentDiagramId(diagramId);
            }
            const cloudFolderPath = await buildFolderPathFromCloud(workspaceId, diagram.folder_id);
            if (isMounted) {
              setFolderPath(cloudFolderPath.names);
              setFolderPathIds(cloudFolderPath.ids);
            }

            // Setup Storage
            const storageManager = newEngine.getStorageManager();
          const cloudPlugin = new CloudStoragePlugin(workspaceId, diagramId, async () => {
            // Get thumbnail from engine
            if (newEngine && (newEngine as any).getThumbnail) {
              console.log("CanvasPageContent: Generating thumbnail via engine...");
              try {
                const thumb = await (newEngine as any).getThumbnail();
                console.log("CanvasPageContent: Thumbnail generated, size:", thumb ? thumb.size : "null");
                return thumb;
              } catch (e) {
                console.error("CanvasPageContent: Error generating thumbnail", e);
                return null;
              }
            } else {
              console.warn("CanvasPageContent: Engine or getThumbnail not available", {
                hasEngine: !!newEngine,
                hasGetThumbnail: newEngine ? typeof (newEngine as any).getThumbnail : 'undefined'
              });
            }
            return null;
          });
            storageManager.registerPlugin(cloudPlugin);
            storageManager.setActivePlugin(cloudPlugin.name);

            // Load
            await storageManager.load();
        } else {
            // --- LOCAL MODE ---
          // Local users are efficient owners
          if (isMounted) setUserRole('owner');

            targetWorkspaceId = null;
            targetDiagramId = null;
            await workspaceStore.init();
            
            let workspace;
            let diagram;

            // 1. Try to load from URL keys
            if (targetWorkspaceId) {
                const workspaces = await workspaceStore.getWorkspaces();
                workspace = workspaces.find(w => w.id === targetWorkspaceId);
            }
            if (!workspace) {
                // Fallback to first
                const workspaces = await workspaceStore.getWorkspaces();
                workspace = workspaces[0];
            }

            if (targetDiagramId && workspace) {
                const diagrams = await workspaceStore.getDiagrams(workspace.id);
                diagram = diagrams.find(d => d.id === targetDiagramId);
            }
            
            if (!diagram && workspace) {
                // Fallback to first diagram
                const diagrams = await workspaceStore.getDiagrams(workspace.id);
                diagram = diagrams[0];

                if (!diagram) {
                    // Create initial
                    diagram = await workspaceStore.createDiagram({
                        id: crypto.randomUUID(),
                        workspaceId: workspace.id,
                        name: "Untitled Diagram"
                    });
                }
            }

            if (workspace && diagram) {
                targetWorkspaceId = workspace.id;
                targetDiagramId = diagram.id;

                if (isMounted) {
                    setWorkspaceName(workspace.name);
                    setDiagramName(diagram.name);
                    const localFolderPath = await buildFolderPathFromLocal(diagram.folderId);
                    setFolderPath(localFolderPath.names);
                    setFolderPathIds(localFolderPath.ids);
                    setCurrentWorkspaceId(workspace.id);
                    setCurrentDiagramId(diagram.id);
                }

                // Setup Storage
                const storageManager = newEngine.getStorageManager();
                const workspacePlugin = new WorkspaceStoragePlugin(workspace.id, diagram.id);
                storageManager.registerPlugin(workspacePlugin);
                storageManager.setActivePlugin(workspacePlugin.name);

                // Load
                await storageManager.load();
            }
        }

        if (isMounted) {
            setEngine(newEngine);
          setMounted(true);
          setIsLoading(false);
        }

      } catch (error) {
        console.error("Failed to initialize:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    // Cleanup old engine if exists
    if (engineRef.current) {
        engineRef.current.destroy();
        setEngine(null);
    }
    
    init();

    return () => {
        isMounted = false;
        if (newEngine) {
            newEngine.destroy();
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workspaceId, diagramId, router]);

  // Initialize Collaboration Plugin (member-only mode)
  useEffect(() => {
    let isActive = true;

    const initCollaboration = async () => {
      // Need workspace ID for auth token
      if (mode === 'cloud' && currentDiagramId && currentWorkspaceId && user && engine) {

        // Fetch session auth token
        let token: string | undefined;
        let wsUrl: string | undefined;

        try {
          console.log('[CanvasPageContent] Fetching collaboration session token...');
          const sessionInfo = await workspaceApiClient.getLiveCollabToken(currentWorkspaceId, currentDiagramId);
          token = sessionInfo.token;
          wsUrl = sessionInfo.ws_url;
          console.log('[CanvasPageContent] Token fetched successfully, using provided WS URL:', wsUrl);
        } catch (err) {
          console.error('[CanvasPageContent] Failed to fetch collaboration token:', err);
          return;
        }

        // Fallback or process URL if needed
        if (!wsUrl) {
          const baseUrl = process.env.NEXT_PUBLIC_LIVE_COLLAB_URL || 'http://localhost:3001';
          wsUrl = baseUrl;
        }

        // Robust URL construction
        if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace('http://', 'ws://');
        } else if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace('https://', 'wss://');
        }

        // Fix Mixed Content: Upgrade to wss:// if page is https but url is ws
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
          wsUrl = wsUrl.replace('ws://', 'wss://');
        }

        if (!wsUrl.endsWith('/ws')) {
          wsUrl = wsUrl.endsWith('/') ? `${wsUrl}ws` : `${wsUrl}/ws`;
        }

        if (!isActive) return;

        // Create plugin instance
        const plugin = new CollaborationPlugin({
          mode: 'member-only',
          wsUrl: wsUrl,
          diagramId: currentDiagramId,
          displayName: user.name?.split(' ')[0] || user.email?.split('@')[0] || 'Anonymous',
          avatarUrl: user.avatar_url,
          token: token,
        });

        // Subscribe to remote users updates
        plugin.onRemoteUsers((users) => {
          if (isActive) setRemoteUsers(users);
        });

        // Subscribe to remote actions
        plugin.onAction((snapshot) => {
          const historyManager = (engine as any).historyManager;
          if (historyManager) {
            historyManager.applyRemoteSnapshot(snapshot);
            engine.notifyStateChange();
            engine.notifyShapesChange();
          }
        });

        // Hook into recordHistory to broadcast actions
        const originalRecordHistory = (engine as any).historyManager.recordState.bind((engine as any).historyManager);
        (engine as any).historyManager.recordState = function (debounce: boolean = false) {
          originalRecordHistory(debounce);
          if (!this.isCurrentlyRestoring()) {
            const snapshot = this.captureSnapshot();
            if (snapshot) {
              plugin.sendAction(snapshot);
            }
          }
        };

        // Initialize the plugin
        plugin.initialize();

        if (isActive) setCollaborationPlugin(plugin);
      }
    };

    initCollaboration();

    // Cleanup
    return () => {
      isActive = false;
      setCollaborationPlugin((prev) => {
        if (prev) {
          prev.destroy();
        }
        return null;
      });
      setRemoteUsers([]);
    };
  }, [mode, currentDiagramId, currentWorkspaceId, user, engine]);

  // Sync user preferences (cloud) with SettingsManager
  useEffect(() => {
    if (engine && user?.preferences) {
        const settingsManager = engine.getSettingsManager();
        settingsManager.loadGlobalSettings(user.preferences);
    }
  }, [engine, user]);


  // Handlers
  const handleWorkspaceClick = () => {
    if (!currentWorkspaceId) return;
    router.push(`/workspace?workspaceId=${currentWorkspaceId}`);
  };
  const handleFolderClick = (index: number) => {
    const folderId = folderPathIds[index];
    if (!currentWorkspaceId || !folderId) return;
    router.push(`/workspace?workspaceId=${currentWorkspaceId}&folderId=${folderId}`);
  };
  const handleSignInClick = () => setShowAuthModal(true);
  const handleSignOut = async () => await signOut();
  const handleContinueLocally = () => {}; // Just close welcome modal

  const handleDiagramNameChange = useCallback(async (name: string) => {
    if (!currentWorkspaceId || !currentDiagramId) return;
    setDiagramName(name);
    
    if (mode === 'cloud') {
        await workspaceApiClient.updateDiagram(currentWorkspaceId, currentDiagramId, { name });
    } else {
        await workspaceStore.updateDiagram(currentDiagramId, { name });
    }
  }, [mode, currentWorkspaceId, currentDiagramId]);


  if (isLoading) return <FullPageLoader />;

  if (!mounted || !engine) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-950 text-zinc-400">
        <div className="text-center">
          <p>Diagram not found or not authenticated</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 rounded-lg bg-[#36C3AD] text-zinc-900 font-semibold"
          >
            Back to Canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        engine={engine}
        isReadOnly={userRole === 'viewer'}
        collaborationPlugin={collaborationPlugin || undefined}
        remoteUsers={remoteUsers}
        topMenuItems={mode === 'cloud' && isAuthenticated ? [
          {
            label: 'Back to Workspaces',
            onClick: () => router.push('/workspace'),
            disabled: false,
          }
        ] : undefined}
        bottomMenuItems={[
          {
            label: 'Report & Feedback',
            onClick: () => setShowFeedbackModal(true),
            disabled: false,
          }
        ]}
        renderBreadcrumb={mode === 'cloud' ? ({ theme }) => {
          const isDark = theme === 'dark';
          const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'editor';

          // TODO: Track save state from engine/storage manager
          const [isSaving, setIsSaving] = React.useState(false);

          return (
            <div className="flex items-center gap-2 text-sm">

              {/* Workspace button */}
              <button
                onClick={handleWorkspaceClick}
                className={`px-2 py-1 rounded-md transition-colors truncate max-w-[120px] ${isDark ? 'hover:bg-gray-700/50 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                title={workspaceName}
              >
                {workspaceName}
              </button>

              {/* Folder path */}
              {folderPath.map((folder, index) => (
                <React.Fragment key={index}>
                  <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
                  <button
                    onClick={() => handleFolderClick(index)}
                    className={`px-2 py-1 rounded-md transition-colors truncate max-w-[120px] ${isDark ? 'hover:bg-gray-700/50 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    title={folder}
                  >
                    {folder}
                  </button>
                </React.Fragment>
              ))}

              {/* Separator before diagram name */}
              {(workspaceName || folderPath.length > 0) && (
                <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>/</span>
              )}

              {/* Diagram Name (editable based on permissions) */}
              <DiagramNameEditor
                theme={theme}
                diagramName={diagramName}
                onDiagramNameChange={handleDiagramNameChange}
                isReadOnly={userRole === 'viewer'}
                canEdit={canEdit}
              />

              {/* Sync Status Indicator - appears after diagram name */}
              <div className="flex-shrink-0">
                <BsCloudCheck
                  className={`w-5 h-5 ${isSaving
                      ? 'text-blue-400 animate-spin'
                      : 'text-emerald-500'
                    }`}
                />
              </div>
            </div>
          );
        } : undefined}
        renderUserMenu={({ theme }) => {
          const isDark = theme === 'dark';

          if (!isAuthenticated) {
            // Show sign-in button when not authenticated
            return (
              <button
                onClick={handleSignInClick}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                  ? 'hover:bg-gray-700/50 text-gray-300 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                title="Sign In"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" x2="3" y1="12" y2="12" />
                </svg>
                <span>Sign In</span>
              </button>
            );
          }

          // Show user menu when authenticated
          return (
            <div className="flex items-center gap-3">
              <ActiveUsers
                users={remoteUsers}
                currentUserId={user?.id || null}
                currentUser={
                  user
                    ? {
                        id: user.id,
                        displayName: user.name || user.email || 'You',
                        avatarUrl: user.avatar_url || undefined,
                      }
                    : null
                }
                theme={theme}
              />
            </div>
          );
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        defaultTab={authModalTab}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      {mode === 'local' && (
        <WelcomeModal
            onContinueLocally={handleContinueLocally}
            onSignIn={handleSignInClick}
            isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
