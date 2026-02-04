"use client";

import { ChevronRight, Cloud, Laptop, LogIn } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface BreadcrumbHeaderProps {
  theme: "light" | "dark";
  workspaceName?: string;
  workspaceIsCloud?: boolean;
  folderPath?: string[];
  diagramName?: string;
  isAuthenticated?: boolean;
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  onWorkspaceClick?: () => void;
  onFolderClick?: (index: number) => void;
  onDiagramNameChange?: (name: string) => void;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
  // RBAC
  isReadOnly?: boolean;
  isViewerModeToggleEnabled?: boolean;
  onToggleViewerMode?: () => void;
}

export const BreadcrumbHeader: React.FC<BreadcrumbHeaderProps> = ({
  theme,
  workspaceName = "My Diagrams",
  workspaceIsCloud = false,
  folderPath = [],
  diagramName = "Untitled",
  isAuthenticated = false,
  user,
  onWorkspaceClick,
  onFolderClick,
  onDiagramNameChange,
  onSignInClick,
  onSignOutClick,
  isReadOnly,
  isViewerModeToggleEnabled,
  onToggleViewerMode,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(diagramName);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update edit value when diagram name changes
  useEffect(() => {
    setEditValue(diagramName);
  }, [diagramName]);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== diagramName) {
      onDiagramNameChange?.(editValue.trim());
    } else {
      setEditValue(diagramName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(diagramName);
      setIsEditing(false);
    }
  };

  const isDark = theme === "dark";
  const textColor = isDark ? "text-white" : "text-gray-900";
  const mutedColor = isDark ? "text-gray-400" : "text-gray-500";
  const hoverBg = isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-100";

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`px-2 py-0.5 rounded-md text-sm font-medium ${textColor} bg-transparent border ${isDark ? "border-[#36C3AD]/50" : "border-[#36C3AD]"} focus:outline-none focus:ring-1 focus:ring-[#36C3AD]/30 min-w-[80px] max-w-[150px]`}
          />
        ) : (
          <button
            onDoubleClick={handleDoubleClick}
            title="Double-click to rename"
            className={`px-2 py-1 rounded-md text-sm font-medium ${textColor} ${hoverBg} transition-colors max-w-[180px] truncate cursor-text`}
          >
            {diagramName}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Workspace */}
      <button
        onClick={onWorkspaceClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${mutedColor} ${hoverBg} transition-colors`}
      >
        {workspaceIsCloud ? (
          <Cloud className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        ) : (
          <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="max-w-[100px] truncate">{workspaceName}</span>
      </button>

      {/* Folder path */}
      {folderPath.map((folder, index) => (
        <React.Fragment key={index}>
          <ChevronRight className={`w-3.5 h-3.5 ${mutedColor} flex-shrink-0`} />
          <button
            onClick={() => onFolderClick?.(index)}
            className={`px-2 py-1 rounded-md text-sm ${mutedColor} ${hoverBg} transition-colors max-w-[80px] truncate`}
          >
            {folder}
          </button>
        </React.Fragment>
      ))}

      {/* Separator before diagram */}
      <ChevronRight className={`w-3.5 h-3.5 ${mutedColor} flex-shrink-0`} />

      {/* Diagram name - editable */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`px-2 py-0.5 rounded-md text-sm font-medium ${textColor} bg-transparent border ${isDark ? "border-[#36C3AD]/50" : "border-[#36C3AD]"} focus:outline-none focus:ring-1 focus:ring-[#36C3AD]/30 min-w-[80px] max-w-[150px]`}
        />
      ) : (
        <button
          onDoubleClick={handleDoubleClick}
          title="Double-click to rename"
          className={`px-2 py-1 rounded-md text-sm font-medium ${textColor} ${hoverBg} transition-colors max-w-[150px] truncate cursor-text`}
        >
          {diagramName}
        </button>
      )}

      {/* Separator before tools/user */}
      <div className={`w-px h-4 mx-1 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />

      {/* Viewer Mode Toggle */}
      {isViewerModeToggleEnabled && (
        <button
          onClick={onToggleViewerMode}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isReadOnly
            ? "bg-[#36C3AD]/10 text-[#36C3AD]"
            : mutedColor + " " + hoverBg
            }`}
          title={isReadOnly ? "Switch to Edit Mode" : "Preview Viewer Mode"}
        >
          {isReadOnly ? (
            <>
              {/* Eye Icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Viewing
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
              Editing
            </>
          )}
        </button>
      )}

      {/* Separator before user (only if toggle is present) */}
      {isViewerModeToggleEnabled && <div className={`w-px h-4 mx-1 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />}

      {/* User */}
      {isAuthenticated && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center justify-center w-7 h-7 rounded-full overflow-hidden border-2 transition-colors ${
              isDark ? "border-gray-600 hover:border-[#36C3AD]" : "border-gray-300 hover:border-[#36C3AD]"
            } ${isDropdownOpen ? "border-[#36C3AD]" : ""}`}
            title={user.name || user.email || "Account"}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#36C3AD] text-zinc-900 text-xs font-semibold">
                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div
              className={`absolute top-full right-0 mt-2 w-48 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden z-[100] ${
                isDark ? "bg-zinc-900/95 border-zinc-700" : "bg-white/95 border-gray-200"
              }`}
            >
              <div className={`px-3 py-2 border-b ${isDark ? "border-zinc-700" : "border-gray-200"}`}>
                <p className={`text-sm font-medium truncate ${textColor}`}>
                  {user.name || "User"}
                </p>
                <p className={`text-xs truncate ${mutedColor}`}>{user.email}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onSignInClick}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 text-xs font-semibold transition-colors"
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign In
        </button>
      )}
    </div>
  );
};
