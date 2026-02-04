'use client'
import React, { useEffect, useRef } from 'react'

export interface ZoomMenuProps {
  isOpen: boolean
  onClose: () => void
  currentZoom: number
  onZoomChange: (zoom: number) => void
  anchorElement: HTMLElement | null
  theme: 'light' | 'dark'
}

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '70%', value: 0.7 },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
]

export const ZoomMenu: React.FC<ZoomMenuProps> = ({
  isOpen,
  onClose,
  currentZoom,
  onZoomChange,
  anchorElement,
  theme
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorElement &&
        !anchorElement.contains(event.target as Node)
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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !anchorElement || !mounted) return null

  // Use absolute positioning relative to parent container
  return (
    <div
      ref={menuRef}
      className={`absolute bottom-full left-0 mb-3 z-[60] min-w-[220px] rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${theme === 'dark'
        ? 'bg-[#1A1A1F]/95 border-gray-700'
        : 'bg-white/95 border-gray-200'
        }`}
    >
      <div className="py-1">
        {/* Zoom Presets */}
        {ZOOM_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              onZoomChange(preset.value)
              onClose()
            }}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${theme === 'dark'
              ? 'text-gray-300 hover:bg-[#3C82FF]/10 hover:text-[#3C82FF]'
              : 'text-gray-700 hover:bg-gray-100 hover:text-[#3C82FF]'
              }`}
          >
            <span>{preset.label}</span>
            {Math.abs(currentZoom - preset.value) < 0.01 && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#3C82FF]">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}

      </div>
    </div>
  )
}

