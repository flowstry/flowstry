
import { RichTextManager } from '@/src/core/RichTextManager'
import { Code, Pen, Type } from 'lucide-react'
import React, { useRef } from 'react'
import { FONT_FAMILIES, HAND_DRAWN_FONT_FAMILY, MONOSPACE_FONT_FAMILY } from '../../consts/fonts'
import { usePanelPosition } from './usePanelPosition'

export interface FontFamilySelectorProps {
  value: string
  isOpen: boolean
  onToggle: () => void
  onChange: (fontFamily: string) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText: boolean
  theme: 'light' | 'dark'
  isMobile?: boolean
}

import { createPortal } from 'react-dom'

const getFontIcon = (fontFamily: string) => {
  if (fontFamily === HAND_DRAWN_FONT_FAMILY) {
    return <Pen size={18} />
  }
  if (fontFamily === MONOSPACE_FONT_FAMILY) {
    return <Code size={18} />
  }
  // Default / Sans
  return <Type size={18} />
}

export const FontFamilySelector: React.FC<FontFamilySelectorProps> = ({
  value,
  isOpen,
  onToggle,
  onChange,
  onClose,
  toolbarPlacement,
  canvasState: _canvasState,
  isEditingText,
  theme,
  isMobile = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { placement, xOffset, style: fixedStyle } = usePanelPosition(
    isOpen,
    containerRef,
    panelRef,
    toolbarPlacement,
    isMobile ? 'fixed' : 'absolute'
  )

  // Prevent focus loss when clicking buttons
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const activeIcon = getFontIcon(value)

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-xl'} shadow-xl border p-1.5 flex gap-1 backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'
        }`} data-theme={theme}>
        {FONT_FAMILIES.map((font) => (
          <button
            key={font.value}
            type="button"
            onClick={() => {
              onChange(font.value)
              if (isEditingText) {
                RichTextManager.setFontFamily(font.value)
              }
              onClose()
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${value === font.value
              ? 'bg-[#36C3AD] text-white shadow-sm'
              : theme === 'dark'
                ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            title={font.label}
          >
            {getFontIcon(font.value)}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Font Family Button */}
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={handleMouseDown}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isOpen
          ? 'bg-[#36C3AD] text-white'
          : theme === 'dark' ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
          }`}
        aria-label="Change font family"
        title="Font Family"
      >
        {activeIcon}
      </button>

      {/* Font Family Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

