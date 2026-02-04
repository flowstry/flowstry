"use client";

import { useWorkspaceTheme } from "../useWorkspaceTheme";

interface WorkspaceSettingsTabProps {
  workspaceNameInput: string;
  setWorkspaceNameInput: (value: string) => void;
  renameSubmitting: boolean;
  handleRenameWorkspace: () => void;
  selectedWorkspaceName: string;
}

export default function WorkspaceSettingsTab({
  workspaceNameInput,
  setWorkspaceNameInput,
  renameSubmitting,
  handleRenameWorkspace,
  selectedWorkspaceName,
}: WorkspaceSettingsTabProps) {
  const { classes, isDark } = useWorkspaceTheme();
  return (
    <div className="pt-6 space-y-6 max-w-xl">

      <div className={`rounded-xl border p-5 ${classes.surfaceMuted}`}>
        <h3 className={`text-sm font-semibold mb-3 ${classes.text}`}>Workspace name</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={workspaceNameInput}
            onChange={(e) => setWorkspaceNameInput(e.target.value)}
            placeholder="Workspace name"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${classes.input}`}
          />
          <button
            onClick={handleRenameWorkspace}
            disabled={
              renameSubmitting ||
              !workspaceNameInput.trim() ||
              workspaceNameInput.trim() === selectedWorkspaceName
            }
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              renameSubmitting ||
              !workspaceNameInput.trim() ||
              workspaceNameInput.trim() === selectedWorkspaceName
                ? isDark
                  ? "opacity-60 cursor-not-allowed bg-zinc-800 text-zinc-300"
                  : "opacity-60 cursor-not-allowed bg-zinc-200 text-zinc-500"
                : "bg-(--primary) text-zinc-900 hover:brightness-110 btn-glow"
            }`}
          >
            {renameSubmitting ? "Renaming..." : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
