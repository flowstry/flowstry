"use client";

import { setCanvasTheme } from "@/app/(platform)/hooks/useCanvasTheme";
import { useAuth } from "@/contexts/AuthContext";
import { authClient } from "@/lib/auth-client";
import { workspaceApiClient, type WorkspaceInviteResponse, type WorkspaceRole } from "@/lib/workspace-client";
import { workspaceStore, type Workspace } from "@/lib/workspace-store";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Settings2,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceTheme } from "./useWorkspaceTheme";

export default function WorkspaceShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut, isAuthenticated, updateUserPreferences, refreshUserPreferences } = useAuth();
  const { theme: workspaceTheme, isDark, classes } = useWorkspaceTheme();
  const iconStrong = isDark ? "text-zinc-200" : "text-zinc-600";
  const UI_THEME_KEY = "flowstry_ui_theme";

  const handleThemeSelect = async (nextTheme: "light" | "dark") => {
    try {
      window.localStorage?.setItem(UI_THEME_KEY, nextTheme);
    } catch {
      // Ignore storage errors
    }
    try {
      await setCanvasTheme(nextTheme);
    } catch (error) {
      console.warn("Failed to update canvas theme:", error);
    }
    if (isAuthenticated) {
      try {
        await authClient.updatePreferences({ theme: nextTheme });
        updateUserPreferences({ theme: nextTheme });
      } catch (error) {
        console.warn("Failed to update user theme preference:", error);
      }
    }
    setThemeMenuOpen(false);
  };
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [userInvites, setUserInvites] = useState<WorkspaceInviteResponse[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceIsCloud, setWorkspaceIsCloud] = useState(false);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarDragX, setSidebarDragX] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileAccountRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const mobileNotificationsRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  const workspaceId = searchParams.get("workspaceId");
  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === "members" || tab === "settings" || tab === "trash") return tab;
    return "files";
  }, [searchParams]);

  const initials = useMemo(() => {
    const source = (user?.name || user?.email || "").trim();
    if (!source) return "U";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [user?.name, user?.email]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (!accountRef.current || !accountRef.current.contains(target)) &&
        (!mobileAccountRef.current || !mobileAccountRef.current.contains(target))
      ) {
        setAccountOpen(false);
        setThemeMenuOpen(false);
      }
      if (
        (!notificationsRef.current || !notificationsRef.current.contains(target)) &&
        (!mobileNotificationsRef.current || !mobileNotificationsRef.current.contains(target))
      ) {
        setNotificationsOpen(false);
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!accountOpen) {
      setThemeMenuOpen(false);
    }
  }, [accountOpen]);

  useEffect(() => {
    const loadWorkspaceContext = async () => {
      if (!workspaceId) {
        setWorkspaceName(null);
        setWorkspaceIsCloud(false);
        setWorkspaceList([]);
        return;
      }

      try {
        let isCloud = false;
        if (isAuthenticated) {
          try {
            const workspace = await workspaceApiClient.getWorkspace(workspaceId);
            setWorkspaceName(workspace.name);
            setWorkspaceRole(workspace.user_role ?? null);
            isCloud = true;
          } catch {
            isCloud = false;
            setWorkspaceRole(null);
          }
        }

        await workspaceStore.init();
        const localWorkspace = await workspaceStore.getWorkspace(workspaceId);
        if (localWorkspace && !isCloud) {
          setWorkspaceName(localWorkspace.name);
        }
        setWorkspaceIsCloud(isCloud);

        if (isAuthenticated) {
          const cloudList = await workspaceApiClient.listWorkspaces();
          setWorkspaceList(
            cloudList.map((ws) => ({
              id: ws.id,
              name: ws.name,
              createdAt: ws.created_at,
              updatedAt: ws.updated_at,
            }))
          );
        } else {
          setWorkspaceList([]);
        }
      } catch (error) {
        console.warn("Failed to load workspace sidebar context:", error);
      }
    };

    loadWorkspaceContext();
  }, [workspaceId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshUserPreferences();
  }, [isAuthenticated, refreshUserPreferences]);

  const loadUserInvites = async () => {
    if (!user) return;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const invites = await workspaceApiClient.listUserInvites();
      setUserInvites(invites);
    } catch (error) {
      console.warn("Failed to load notifications:", error);
      setUserInvites([]);
      setNotificationsError("Failed to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotificationsToggle = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (!prev) {
        loadUserInvites();
      }
      return next;
    });
  };

  const handleAcceptInvite = async (invite: WorkspaceInviteResponse) => {
    if (!invite.token) return;
    setAcceptingInviteId(invite.id);
    try {
      const result = await workspaceApiClient.acceptInvite(invite.token);
      setUserInvites((prev) => prev.filter((item) => item.id !== invite.id));
      setNotificationsOpen(false);
      router.push(`/workspace?workspaceId=${result.workspace_id}`);
    } catch (error) {
      console.warn("Failed to accept invite:", error);
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const handleNavigate = (tab: string) => {
    router.push(`/workspace?workspaceId=${workspaceId}&tab=${tab}`);
  };

  return (
    <div className={`h-screen w-full flex ${classes.page}`} data-theme={workspaceTheme}>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity sm:hidden ${
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r backdrop-blur transition-transform duration-200 sm:static sm:w-64 sm:translate-x-0 ${classes.sidebar} ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } ${isDraggingSidebar ? "transition-none" : ""}`}
        style={isDraggingSidebar ? { transform: `translateX(${sidebarDragX}px)` } : undefined}
        onTouchStart={(e) => {
          if (!mobileNavOpen) return;
          const touch = e.touches[0];
          swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
          setIsDraggingSidebar(false);
          setSidebarDragX(0);
        }}
        onTouchMove={(e) => {
          if (!mobileNavOpen || !swipeStartRef.current) return;
          const touch = e.touches[0];
          const dx = touch.clientX - swipeStartRef.current.x;
          const dy = touch.clientY - swipeStartRef.current.y;
          if (!isDraggingSidebar && Math.abs(dx) < Math.abs(dy)) return;
          setIsDraggingSidebar(true);
          const width = sidebarRef.current?.offsetWidth ?? 288;
          const nextX = Math.max(-width, Math.min(0, dx));
          setSidebarDragX(nextX);
        }}
        onTouchEnd={() => {
          const width = sidebarRef.current?.offsetWidth ?? 288;
          if (isDraggingSidebar) {
            setMobileNavOpen(sidebarDragX > -width * 0.35);
            setSidebarDragX(0);
            setIsDraggingSidebar(false);
          }
          swipeStartRef.current = null;
        }}
      >
        <div className="px-5 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Flowstry logo" className="h-6 w-6" />
          <span className={`text-lg font-semibold ${classes.text}`}>Flowstry</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(false)}
          className={`rounded-2xl p-2.5 sm:hidden ${classes.hoverBorder} ${classes.hoverBg}`}
          aria-label="Close navigation"
        >
          <X className={`h-5 w-5 ${iconStrong}`} />
        </button>
        {user && (
            <div ref={notificationsRef} className="relative hidden sm:block">
              <button
                onClick={handleNotificationsToggle}
                className={`relative rounded-2xl cursor-pointer p-2.5 ${classes.hoverBorder} ${classes.hoverBg}`}
                aria-label="Notifications"
              >
                <Bell className={`h-5 w-5 ${iconStrong}`} />
                {userInvites.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-(--primary)" />
                )}
              </button>

              {notificationsOpen && (
                <div className={`absolute left-0 mt-2 w-80 rounded-2xl border z-[100] ${classes.popoverMuted}`}>
                  <div className={`px-4 py-3 text-sm font-semibold border-b ${classes.text} ${classes.border}`}>
                    Notifications
                  </div>
                  <div className="max-h-72 overflow-y-auto p-3">
                    {notificationsError ? (
                      <div className="text-sm text-red-300">{notificationsError}</div>
                    ) : notificationsLoading ? (
                      <div className={`text-sm ${classes.textMuted}`}>Loading...</div>
                    ) : userInvites.length === 0 ? (
                      <div className={`text-sm ${classes.textMuted}`}>No new notifications.</div>
                    ) : (
                      <div className="space-y-3">
                        {userInvites.map((invite) => (
                          <div key={invite.id} className={`rounded-xl border px-3 py-3 ${classes.surface}`}>
                            <div className={`text-sm font-semibold truncate ${classes.text}`}>
                              Workspace invite: {invite.workspace_name || "Untitled"}
                            </div>
                            <div className={`text-xs truncate ${classes.textMuted}`}>
                              {invite.inviter_name ? `Invited by ${invite.inviter_name}` : "Invitation"} ·{" "}
                              {invite.role}
                            </div>
                            <button
                              onClick={() => handleAcceptInvite(invite)}
                              disabled={acceptingInviteId === invite.id}
                              className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${acceptingInviteId === invite.id
                                ? isDark
                                  ? "opacity-60 cursor-not-allowed bg-zinc-800 text-zinc-300"
                                  : "opacity-60 cursor-not-allowed bg-zinc-200 text-zinc-500"
                                : "bg-(--primary) text-zinc-900 hover:brightness-110"
                                }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept invite
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <nav className="px-3 space-y-1 flex-1">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === "/"
              ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
              : classes.buttonMuted
              }`}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>

          {workspaceId ? (
            <div className="mt-4 space-y-2">
              <div ref={workspaceMenuRef} className="relative">
                <button
                  onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${classes.surface} ${classes.text} ${classes.hoverBorder}`}
                >
                  <span className="truncate">{workspaceName || "Workspace"}</span>
                  {workspaceMenuOpen ? (
                    <ChevronUp className={`h-4 w-4 ${classes.iconMuted}`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 ${classes.iconMuted}`} />
                  )}
                </button>

                {workspaceMenuOpen && (
                  <div className={`absolute left-0 right-0 mt-2 rounded-xl border shadow-xl overflow-hidden ${classes.popover}`}>
                    <Link
                      href="/workspace"
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                    >
                      <LayoutGrid className={`h-4 w-4 ${classes.iconMuted}`} />
                      All workspaces
                    </Link>
                    <div className={`w-full h-px ${classes.divider}`} />
                    {workspaceList.length === 0 ? (
                      <div className={`px-4 py-2 text-xs ${classes.textSubtle}`}>No workspaces found.</div>
                    ) : (
                      workspaceList.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => {
                            setWorkspaceMenuOpen(false);
                            router.push(`/workspace?workspaceId=${workspace.id}&tab=${activeTab}`);
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${workspace.id === workspaceId
                            ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
                            : classes.menuItem
                            }`}
                        >
                          <span className="truncate">{workspace.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <Link
                href={`/workspace?workspaceId=${workspaceId}&tab=files`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "files"
                  ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
                  : classes.buttonMuted
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Diagrams
              </Link>
              <button
                type="button"
                disabled={!workspaceIsCloud}
                onClick={() => {
                  if (!workspaceIsCloud) return;
                  router.push(`/workspace?workspaceId=${workspaceId}&tab=members`);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!workspaceIsCloud
                  ? "opacity-50 cursor-not-allowed text-zinc-500"
                  : activeTab === "members"
                    ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
                    : classes.buttonMuted
                  }`}
              >
                <Users className="w-4 h-4" />
                Members
              </button>
              {(workspaceIsCloud && (workspaceRole === "owner" || workspaceRole === "admin")) && (
                <button
                  onClick={() => handleNavigate("trash")}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === "trash"
                    ? isDark
                      ? "bg-zinc-800 text-white"
                      : "bg-zinc-100 text-zinc-900"
                    : `${classes.textSubtle} hover:${isDark ? "bg-zinc-800/50 text-zinc-200" : "bg-zinc-50 text-zinc-900"}`
                    }`}
                >
                  <Trash2 className="h-4 w-4" />
                  Trash
                </button>
              )}
              {(workspaceIsCloud && (workspaceRole === "owner" || workspaceRole === "admin")) && <Link
                href={`/workspace?workspaceId=${workspaceId}&tab=settings`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "settings"
                  ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
                  : classes.buttonMuted
                  }`}
              >
                <Settings2 className="w-4 h-4" />
                Settings
              </Link>}
            </div>
          ) : (
            <div className="mt-4">
              <Link
                href="/workspace"
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${classes.surface} ${
                  pathname === "/workspace"
                    ? "text-(--primary) border-[color-mix(in_srgb,var(--primary)_40%,transparent)]"
                    : `${classes.text} ${classes.hoverBorder}`
                }`}
              >
                <LayoutGrid className={`h-4 w-4 ${classes.iconMuted}`} />
                All workspaces
              </Link>
            </div>
          )}
        </nav>
        {user && (
          <div className="hidden sm:block px-4 pb-4 pt-2 mt-auto">
            <div ref={accountRef} className="relative">
                <button
                  onClick={() => setAccountOpen((prev) => !prev)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 ${classes.surface} ${classes.hoverBorder} ${classes.hoverBg}`}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) flex items-center justify-center text-sm font-semibold">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 text-left flex-1">
                    <div className={`text-sm font-semibold truncate ${classes.text}`}>{user.name}</div>
                  </div>
                 {accountOpen ? (
                  <ChevronDown className={`h-4 w-4 ${classes.iconMuted}`} />
                 ) : (
                  <ChevronUp className={`h-4 w-4 ${classes.iconMuted}`} />
                 )}
                </button>

                {accountOpen && (
                <div className={`absolute left-0 right-0 bottom-full mb-2 w-56 rounded-xl border shadow-xl overflow-visible ${classes.popover}`}>
                    <div className="flex justify-center flex-col items-center py-4 px-1">
                      <div className="py-2">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) flex items-center justify-center text-lg font-semibold">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className={`text-sm font-semibold truncate ${classes.text}`}>{user.name}</div>
                      <div className={`text-xs truncate ${classes.textMuted}`}>{user.email}</div>
                    </div>

                    <div className={`w-full h-px ${classes.divider}`} />

                    <div className="relative">
                      <button
                        onClick={() => setThemeMenuOpen((prev) => !prev)}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                      >
                        <Sun className={`h-4 w-4 ${classes.iconMuted}`} />
                        Theme
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 ${classes.iconMuted}`} />
                      </button>
                      {themeMenuOpen && (
                        <div
                          className={`absolute left-full top-0 ml-2 w-40 rounded-xl border shadow-xl overflow-hidden ${classes.popover}`}
                        >
                          <button
                            onClick={() => handleThemeSelect("light")}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${classes.menuItem}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                workspaceTheme === "light" ? "bg-(--primary)" : "bg-transparent"
                              }`}
                            />
                            Light
                            {workspaceTheme === "light" && (
                              <Check className={`ml-auto h-4 w-4 ${classes.iconMuted}`} />
                            )}
                          </button>
                          <button
                            onClick={() => handleThemeSelect("dark")}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${classes.menuItem}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                workspaceTheme === "dark" ? "bg-(--primary)" : "bg-transparent"
                              }`}
                            />
                            Dark
                            {workspaceTheme === "dark" && (
                              <Check className={`ml-auto h-4 w-4 ${classes.iconMuted}`} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/settings"
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                    >
                      <Settings className={`h-4 w-4 ${classes.iconMuted}`} />
                      Settings
                    </Link>
                    <button
                      onClick={signOut}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                    >
                      <LogOut className={`h-4 w-4 ${classes.iconMuted}`} />
                      Log out
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 h-full overflow-hidden">
        <div className={`sticky top-0 z-40 flex items-center gap-2 border-b px-3 py-3 sm:hidden ${classes.surface} ${classes.borderStrong}`}>
          <button
            onClick={() => setMobileNavOpen(true)}
            className={`rounded-xl p-2 ${classes.hoverBorder} ${classes.hoverBg}`}
            aria-label="Open navigation"
          >
            <Menu className={`h-5 w-5 ${iconStrong}`} />
          </button>
          <span className={`text-sm font-semibold ${classes.text}`}>
            {pathname === "/" ? "Home" : pathname === "/workspace" ? "Workspaces" : "Workspace"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {user && (
              <div ref={mobileNotificationsRef} className="relative">
                <button
                  onClick={handleNotificationsToggle}
                  className={`relative rounded-xl p-2 ${classes.hoverBorder} ${classes.hoverBg}`}
                  aria-label="Notifications"
                >
                  <Bell className={`h-5 w-5 ${iconStrong}`} />
                  {userInvites.length > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-(--primary)" />
                  )}
                </button>
                {notificationsOpen && (
                  <div className={`absolute right-0 mt-2 w-72 rounded-2xl border z-[100] ${classes.popoverMuted}`}>
                    <div className={`px-4 py-3 text-sm font-semibold border-b ${classes.text} ${classes.border}`}>
                      Notifications
                    </div>
                    <div className="max-h-72 overflow-y-auto p-3">
                      {notificationsError ? (
                        <div className="text-sm text-red-300">{notificationsError}</div>
                      ) : notificationsLoading ? (
                        <div className={`text-sm ${classes.textMuted}`}>Loading...</div>
                      ) : userInvites.length === 0 ? (
                        <div className={`text-sm ${classes.textMuted}`}>No new notifications.</div>
                      ) : (
                        <div className="space-y-3">
                          {userInvites.map((invite) => (
                            <div key={invite.id} className={`rounded-xl border px-3 py-3 ${classes.surface}`}>
                              <div className={`text-sm font-semibold truncate ${classes.text}`}>
                                Workspace invite: {invite.workspace_name || "Untitled"}
                              </div>
                              <div className={`text-xs truncate ${classes.textMuted}`}>
                                {invite.inviter_name ? `Invited by ${invite.inviter_name}` : "Invitation"} ·{" "}
                                {invite.role}
                              </div>
                              <button
                                onClick={() => handleAcceptInvite(invite)}
                                disabled={acceptingInviteId === invite.id}
                                className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${acceptingInviteId === invite.id
                                  ? isDark
                                    ? "opacity-60 cursor-not-allowed bg-zinc-800 text-zinc-300"
                                    : "opacity-60 cursor-not-allowed bg-zinc-200 text-zinc-500"
                                  : "bg-(--primary) text-zinc-900 hover:brightness-110"
                                  }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Accept invite
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {user && (
              <div ref={mobileAccountRef} className="relative">
                <button
                  onClick={() => setAccountOpen((prev) => !prev)}
                  className={`flex items-center justify-center rounded-xl p-1.5 ${classes.hoverBorder} ${classes.hoverBg}`}
                  aria-label="Account menu"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) flex items-center justify-center text-sm font-semibold">
                      {initials}
                    </div>
                  )}
                </button>
                {accountOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-xl overflow-visible ${classes.popover}`}>
                    <div className="flex justify-center flex-col items-center py-4 px-1">
                      <div className="py-2">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) flex items-center justify-center text-lg font-semibold">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className={`text-sm font-semibold truncate ${classes.text}`}>{user.name}</div>
                      <div className={`text-xs truncate ${classes.textMuted}`}>{user.email}</div>
                    </div>

                    <div className={`w-full h-px ${classes.divider}`} />

                    <div className="relative">
                      <button
                        onClick={() => setThemeMenuOpen((prev) => !prev)}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                      >
                        <Sun className={`h-4 w-4 ${classes.iconMuted}`} />
                        Theme
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 ${classes.iconMuted}`} />
                      </button>
                      {themeMenuOpen && (
                        <div
                          className={`absolute right-full top-0 mr-2 w-40 rounded-xl border shadow-xl overflow-hidden ${classes.popover}`}
                        >
                          <button
                            onClick={() => handleThemeSelect("light")}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${classes.menuItem}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                workspaceTheme === "light" ? "bg-(--primary)" : "bg-transparent"
                              }`}
                            />
                            Light
                            {workspaceTheme === "light" && (
                              <Check className={`ml-auto h-4 w-4 ${classes.iconMuted}`} />
                            )}
                          </button>
                          <button
                            onClick={() => handleThemeSelect("dark")}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${classes.menuItem}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                workspaceTheme === "dark" ? "bg-(--primary)" : "bg-transparent"
                              }`}
                            />
                            Dark
                            {workspaceTheme === "dark" && (
                              <Check className={`ml-auto h-4 w-4 ${classes.iconMuted}`} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/settings"
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                    >
                      <Settings className={`h-4 w-4 ${classes.iconMuted}`} />
                      Settings
                    </Link>
                    <button
                      onClick={signOut}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm ${classes.menuItem}`}
                    >
                      <LogOut className={`h-4 w-4 ${classes.iconMuted}`} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
