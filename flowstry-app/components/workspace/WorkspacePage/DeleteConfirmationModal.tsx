"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceTheme } from "../useWorkspaceTheme";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  itemType: "folder" | "diagram";
  itemName: string;
  contents?: { folders: number; diagrams: number } | null;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemType,
  itemName,
  contents,
}: DeleteConfirmationModalProps) {
  const { classes, isDark } = useWorkspaceTheme();
  const [inputValue, setInputValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setIsDeleting(false);
      // Focus input after a short delay to allow animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = inputValue === itemName;

  const handleConfirm = async () => {
    if (!isMatch || isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Failed to delete item:", error);
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isMatch) {
      handleConfirm();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-md transform overflow-hidden rounded-2xl border p-6 shadow-2xl transition-all ${classes.surface} ${classes.border}`}
        role="dialog"
        aria-modal="true"
      >
        <button 
          onClick={onClose}
          className={`absolute right-4 top-4 p-1 rounded-lg transition-colors ${classes.buttonMuted}`}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-red-500">
            <div className="rounded-full bg-red-500/10 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className={`text-lg font-bold ${classes.text}`}>Delete {itemType}?</h3>
          </div>

          <div className="space-y-3">
            <p className={`text-sm ${classes.textMuted}`}>
              This action cannot be undone. This will permanently delete the 
              <span className="font-semibold text-red-500"> {itemName} </span>
              {itemType}.
            </p>

            {contents && (contents.folders > 0 || contents.diagrams > 0) && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${
                isDark ? "bg-red-950/20 border-red-900/30 text-red-200" : "bg-red-50 border-red-100 text-red-700"
              }`}>
                <p className="font-semibold mb-1">This will also delete:</p>
                <ul className="list-disc list-inside opacity-90 space-y-0.5">
                  {contents.folders > 0 && <li>{contents.folders} folder{contents.folders !== 1 ? "s" : ""}</li>}
                  {contents.diagrams > 0 && <li>{contents.diagrams} diagram{contents.diagrams !== 1 ? "s" : ""}</li>}
                </ul>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <label className={`text-xs font-medium ${classes.textSubtle}`}>
                Type <span className="font-mono select-none">{itemName}</span> to confirm
              </label>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={itemName}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all ${classes.input} focus:ring-2 focus:ring-red-500/20 focus:border-red-500`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${classes.buttonMuted} hover:bg-zinc-100 dark:hover:bg-zinc-800`}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isMatch || isDeleting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all ${
                isMatch 
                  ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20" 
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {isDeleting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeleting ? "Deleting..." : "Delete forever"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
