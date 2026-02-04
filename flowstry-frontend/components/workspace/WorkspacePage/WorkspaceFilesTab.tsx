"use client";

import type { DiagramItem, FolderItem } from "@/lib/workspace-store";
import { File, FilePlus2, FolderPlus, Search } from "lucide-react";
import { DiagramCard } from "../DiagramCard";
import { FolderCard } from "../FolderCard";
import { useWorkspaceTheme } from "../useWorkspaceTheme";

interface WorkspaceFilesTabProps {
  folderPath: FolderItem[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  handleCreateFolder: () => void;
  handleCreateDiagram: () => void;
  handleBreadcrumbNavigate: (targetFolderId?: string) => void;
  filteredFolders: FolderItem[];
  filteredDiagrams: DiagramItem[];
  handleFolderClick: (folder: FolderItem) => void;
  handleDiagramClick: (diagram: DiagramItem) => void;
  handleDiagramContextMenu: (event: React.MouseEvent, diagram: DiagramItem) => void;
  formatDate: (dateString: string) => string;
  onRenameDiagram?: (id: string, newName: string) => void;
  onDeleteDiagram?: (id: string, name: string) => void;
  onRenameFolder?: (id: string, newName: string) => void;
  onDeleteFolder?: (id: string, name: string) => void;
  canCreate?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
}

export default function WorkspaceFilesTab({
  folderPath,
  searchQuery,
  setSearchQuery,
  handleCreateFolder,
  handleCreateDiagram,
  handleBreadcrumbNavigate,
  filteredFolders,
  filteredDiagrams,
  handleFolderClick,
  handleDiagramClick,
  handleDiagramContextMenu,
  formatDate,
  onRenameDiagram,
  onDeleteDiagram,
  onRenameFolder,
  onDeleteFolder,
  canCreate = true,
  canRename = true,
  canDelete = true,
}: WorkspaceFilesTabProps) {
  const { classes, isDark } = useWorkspaceTheme();
  return (
    <div className="pt-4 sm:pt-6">
      <div className="pb-3 mb-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={`flex flex-wrap items-center gap-2 text-xs sm:text-sm ${classes.textMuted}`}>
              {folderPath.length > 0 && (
                <button
                  onClick={() => handleBreadcrumbNavigate()}
                  className={`px-3 py-1 cursor-pointer rounded-md ${
                    isDark ? "hover:bg-zinc-800/80 hover:text-white" : "hover:bg-zinc-100 hover:text-zinc-900"
                  } ${folderPath.length === 0 ? classes.text : ""}`}
                >
                  ..
                </button>
              )}
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center gap-2">
                  <span className={classes.textSubtle}>/</span>
                  <button
                    onClick={() => handleBreadcrumbNavigate(folder.id)}
                    className={`${
                      isDark ? "hover:text-white" : "hover:text-zinc-900"
                    } ${index === folderPath.length - 1 ? classes.text : ""}`}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <div className="relative flex-1 sm:w-60 sm:flex-none">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${classes.textSubtle}`} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className={`w-full rounded-md border pl-9 pr-3 py-2 text-sm ${classes.input}`}
                />
              </div>
            <div className={`hidden h-6 w-[2px] sm:block ${classes.divider}`} />
            {canCreate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateFolder}
                  aria-label="New folder"
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${classes.surface} ${isDark ? "text-zinc-200 hover:bg-zinc-900/80" : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                >
                  <FolderPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Folder</span>
                </button>
                <button
                  onClick={handleCreateDiagram}
                  aria-label="New diagram"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-(--primary) px-2.5 py-2 text-xs font-semibold text-zinc-900 hover:brightness-110 sm:px-3 sm:text-sm btn-glow"
                >
                  <FilePlus2 className="h-4 w-4" />
                  <span className="hidden sm:inline">New Diagram</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
        {filteredFolders.length === 0 && filteredDiagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[260px] text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              isDark ? "bg-zinc-900/60" : "bg-zinc-100"
            }`}>
              <File className={`w-8 h-8 ${classes.textSubtle}`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${classes.textMuted}`}>
              {searchQuery ? "No results found" : "Empty folder"}
            </h3>
            <p className={classes.textSubtle}>
              {searchQuery ? "Try a different search term" : "Create your first diagram to get started"}
            </p>
          </div>
        ) : (
          <>
            {filteredFolders.length > 0 && (
              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      name={folder.name}
                      updatedAt={folder.updatedAt}
                      onClick={() => handleFolderClick(folder)}
                      formatDate={formatDate}
                      onRename={canRename && onRenameFolder ? (newName) => onRenameFolder(folder.id, newName) : undefined}
                      onTrash={canDelete && onDeleteFolder ? () => onDeleteFolder(folder.id, folder.name) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredDiagrams.length > 0 && (
              <div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredDiagrams.map((diagram) => (
                    <DiagramCard
                      key={diagram.id}
                      name={diagram.name}
                      onClick={() => handleDiagramClick(diagram)}
                      thumbnailUrl={diagram.thumbnailUrl || diagram.thumbnail}
                      updatedAt={diagram.updatedAt}
                      formatDate={formatDate}
                      onRename={canRename && onRenameDiagram ? (newName) => onRenameDiagram(diagram.id, newName) : undefined}
                      onDelete={canDelete && onDeleteDiagram ? () => onDeleteDiagram(diagram.id, diagram.name) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
