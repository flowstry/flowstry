"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export type WorkspaceTheme = "light" | "dark";

export function useWorkspaceTheme() {
  const { user } = useAuth();
  const theme: WorkspaceTheme =
    user?.preferences?.theme === "light" || user?.preferences?.theme === "dark"
      ? user.preferences.theme
      : "dark";
  const isDark = theme === "dark";

  const classes = useMemo(
    () => ({
      page: isDark ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900",
      sidebar: isDark
        ? "bg-zinc-950/80 border-zinc-800/60"
        : "bg-white/90 border-zinc-200",
      surface: isDark
        ? "bg-zinc-900/70 border-zinc-800/70"
        : "bg-white border-zinc-200",
      surfaceMuted: isDark
        ? "bg-zinc-900/40 border-zinc-800/70"
        : "bg-zinc-50 border-zinc-200",
      surfaceStrong: isDark
        ? "bg-zinc-950 border-zinc-800/80"
        : "bg-white border-zinc-200",
      popover: isDark
        ? "bg-zinc-950 border-zinc-800/70"
        : "bg-white border-zinc-200",
      popoverMuted: isDark
        ? "bg-zinc-900 shadow-xl border-zinc-800/70"
        : "bg-white shadow-xl border-zinc-200",
      text: isDark ? "text-white" : "text-zinc-900",
      textMuted: isDark ? "text-zinc-400" : "text-zinc-600",
      textSubtle: isDark ? "text-zinc-500" : "text-zinc-500",
      iconMuted: isDark ? "text-zinc-400" : "text-zinc-500",
      border: isDark ? "border-zinc-800/70" : "border-zinc-200",
      borderStrong: isDark ? "border-zinc-800/80" : "border-zinc-200",
      hoverBg: isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-100",
      hoverBgStrong: isDark ? "hover:bg-zinc-900/80" : "hover:bg-zinc-100",
      hoverBorder: isDark ? "hover:border-zinc-700" : "hover:border-zinc-300",
      buttonMuted: isDark
        ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
      input: isDark
        ? "bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
        : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400",
      menuItem: isDark
        ? "text-zinc-200 hover:bg-zinc-900"
        : "text-zinc-700 hover:bg-zinc-100",
      divider: isDark ? "bg-zinc-800/60" : "bg-zinc-200",
    }),
    [isDark]
  );

  return { theme, isDark, classes };
}
