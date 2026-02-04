"use client";

import { useWorkspaceTheme } from "./useWorkspaceTheme";

interface WorkspaceCardProps {
  name: string;
  thumbnails: string[];
  fileCount: number;
  updatedAt: string;
  onClick: () => void;
  formatDate: (dateString: string) => string;
}

export function WorkspaceCard({
  name,
  thumbnails,
  fileCount,
  updatedAt,
  onClick,
  formatDate,
}: WorkspaceCardProps) {
  const { classes, isDark } = useWorkspaceTheme();

  return (
    <button
      onClick={onClick}
      className={`group text-left p-3 sm:p-5 rounded-xl border transition-all ${classes.surfaceMuted} hover:border-[#36C3AD]/60 ${
        isDark ? "hover:bg-zinc-900/70" : "hover:bg-zinc-100"
      }`}
    >
      <div className="mb-3 sm:mb-4 rounded-lg">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const thumbnail = thumbnails[index];
            return (
              <div
                key={`thumb-${index}`}
                className={`aspect-[4/3] sm:aspect-16/8 overflow-hidden rounded-md border ${classes.border} ${
                  isDark ? "bg-zinc-900/80" : "bg-zinc-100"
                }`}
              >
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={`${name} preview ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className={`h-full w-full ${isDark ? "bg-zinc-900/80" : "bg-zinc-100"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <h3 className={`text-base sm:text-lg font-semibold ${classes.text} group-hover:text-[#36C3AD] mb-2`}>
        {name}
      </h3>
      <div
        className={`flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm ${classes.textSubtle}`}
      >
        <span>
          {fileCount} file{fileCount !== 1 ? "s" : ""}
        </span>
        <span>{formatDate(updatedAt)}</span>
      </div>
    </button>
  );
}
