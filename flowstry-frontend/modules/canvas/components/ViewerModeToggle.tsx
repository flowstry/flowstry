'use client'

import { Eye, Pen } from 'lucide-react'
import React from 'react'

interface ViewerModeToggleProps {
  theme: 'light' | 'dark'
  isReadOnly: boolean
  onToggle?: () => void
  showLabel?: boolean
}

export const ViewerModeToggle: React.FC<ViewerModeToggleProps> = ({
  theme,
  isReadOnly,
  onToggle,
  showLabel = true
}) => {
  const isDark = theme === 'dark'
  const isCompact = !showLabel

  return (
    <button
      onClick={onToggle}
      disabled={!onToggle}
      className={`flex items-center rounded-lg text-xs font-medium transition-all ${
        isCompact ? 'p-2' : 'gap-1.5 px-2.5 py-1.5'
      } ${
        isReadOnly
          ? isDark
            ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          : isDark
            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
      } ${!onToggle && 'opacity-50 cursor-not-allowed'}`}
      title={isReadOnly ? 'Viewing Mode - Click to edit' : 'Editing Mode - Click to preview as viewer'}
    >
      {isReadOnly ? (
        <>
          <Eye size={14} />
          {showLabel && <span>Viewing</span>}
        </>
      ) : (
        <>
          <Pen size={14} />
          {showLabel && <span>Editing</span>}
        </>
      )}
    </button>
  )
}
