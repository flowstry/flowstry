"use client";

import { Folder, Pencil, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceTheme } from "./useWorkspaceTheme";

interface FolderCardProps {
  name: string;
  updatedAt: string;
  onClick: () => void;
  formatDate: (dateString: string) => string;
  
  // Actions
  onRename?: (newName: string) => Promise<void> | void;
  onTrash?: () => Promise<void> | void;
}

export function FolderCard({
  name,
  updatedAt,
  onClick,
  formatDate,
  onRename,
  onTrash,
}: FolderCardProps) {
  const { classes, isDark } = useWorkspaceTheme();
  
  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Context Menu state
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(name);
    }
  }, [name, isRenaming]);

  // Handle outside click to close context menu
  useEffect(() => {
    if (!menuPosition) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuPosition]);

  const handleRenameSubmit = async (save: boolean) => {
    if (save && onRename && renameValue.trim() !== "" && renameValue !== name) {
      await onRename(renameValue);
    } else {
      setRenameValue(name);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleRenameSubmit(true);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleRenameSubmit(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // If no actions available, don't show menu
    if (!onRename && !onTrash) return;

    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <button
        onClick={(e) => {
          if (isRenaming) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClick();
        }}
        onContextMenu={handleContextMenu}
        className={`group relative text-left flex items-center gap-3 p-4 rounded-xl border transition-all overflow-hidden ${classes.surfaceMuted} hover:border-(--primary) ${
          isDark ? "hover:bg-zinc-900/70" : "hover:bg-zinc-100"
        }`}
      >
        <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          isDark ? "bg-zinc-800/60" : "bg-zinc-200"
        }`}>
          <Folder className={`w-5 h-5 ${classes.iconMuted} group-hover:text-(--primary)`} />
        </div>
        
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => handleRenameSubmit(true)}
              onKeyDown={handleKeyDown}
              className={`w-full text-sm bg-none border-0 ${isDark ? "group-hover:bg-zinc-900/70" : "group-hover:bg-zinc-100"} font-semibold outline-none ${classes.surfaceMuted} ${classes.input}`}
            />
          ) : (
            <div className={`text-sm py-[2px] font-semibold truncate ${classes.text}`}>
              {name}
            </div>
          )}
          
          <div className={`text-xs mt-0.5 ${classes.textSubtle}`}>
              {formatDate(updatedAt)}
          </div>
        </div>
      </button>

      {/* Internal Context Menu */}
      {menuPosition && createPortal(
        <div
          ref={menuRef}
          className={`fixed z-50 min-w-[160px] rounded-lg border p-1 text-sm shadow-xl ${
            isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
          }`}
          style={{ top: menuPosition.y, left: menuPosition.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {onRename && (
            <button
              onClick={() => {
                setIsRenaming(true);
                setMenuPosition(null);
              }}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-(--primary)/10 hover:text-(--primary) transition-colors`}
            >
              <Pencil className="w-4 h-4" />
              Rename
            </button>
          )}
          {onTrash && (
            <button
              onClick={() => {
                onTrash();
                setMenuPosition(null);
              }}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-red-500/10 hover:text-red-500 transition-colors`}
            >
              <Trash2 className="w-4 h-4" />
              Trash
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
