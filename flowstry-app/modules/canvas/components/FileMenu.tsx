'use client'
import React, { useEffect, useRef } from 'react'

export interface FileMenuOption {
  label: string
  shortcut?: string
  onClick: () => void
  icon?: React.ReactNode
}

interface FileMenuProps {
  isOpen: boolean
  onClose: () => void
  options: FileMenuOption[]
  anchorElement: HTMLElement | null
  theme: 'light' | 'dark'
}

export const FileMenu: React.FC<FileMenuProps> = ({
  isOpen,
  onClose,
  options,
  anchorElement,
  theme
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorElement &&
        !anchorElement.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorElement])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !anchorElement || !mounted) return null

  // Render directly in the DOM hierarchy with absolute positioning
  // This ensures the menu moves with the button and is robust against layout changes
  // The parent container in Canvas.tsx is 'relative', so this works perfectly.
  return (
    <div
      ref={menuRef}
      data-ui-control
      className={`absolute top-full left-0 mt-2 z-[60] min-w-[200px] rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${theme === 'dark'
        ? 'bg-[#1A1A1F]/90 border-gray-700'
        : 'bg-white/90 border-gray-200'
        }`}
    >
      <div className="py-1">
        {options.map((option, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              option.onClick()
              onClose()
            }}
            className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-4 transition-colors ${theme === 'dark'
              ? 'text-gray-300 hover:bg-[#3C82FF]/10 hover:text-[#3C82FF] active:bg-[#3C82FF]/20'
              : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
              }`}
          >
            <div className="flex items-center gap-3">
              {option.icon && (
                <span className={`flex-shrink-0 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </div>
            {option.shortcut && (
              <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {option.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

