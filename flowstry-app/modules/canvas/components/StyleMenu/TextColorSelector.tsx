'use client'
import { RichTextManager } from '@/src/core/RichTextManager'
import { Baseline } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { ColorPicker } from './ColorPicker'
import { usePanelPosition } from './usePanelPosition'

export interface TextColorSelectorProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onTextColorChange: (color: string) => void
  onRecordHistory: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText: boolean
  value?: string
  theme: 'light' | 'dark'
  isMobile?: boolean
}

import { createPortal } from 'react-dom'

export const TextColorSelector: React.FC<TextColorSelectorProps> = ({
  isOpen,
  onToggle,
  onClose: _onClose,
  onTextColorChange,
  onRecordHistory,
  toolbarPlacement,
  canvasState: _canvasState,
  isEditingText,
  value = '#000000',
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
  const [textColor, setTextColor] = useState(value)

  // Update local state when value prop changes
  useEffect(() => {
    setTextColor(value)
  }, [value])

  // Prevent focus loss when clicking buttons
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handleColorChange = (color: string) => {
    setTextColor(color)

    if (isEditingText) {
      RichTextManager.setTextColor(color)
      onRecordHistory()
    } else {
      onTextColorChange(color)
    }
  }

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-2xl'} shadow-2xl border p-4 min-w-[240px] backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'
        }`}>
        <ColorPicker value={textColor} onChange={handleColorChange} label="Text color" theme={theme} isMobile={isMobile} />
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Text Color Button */}
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
        }`}
        aria-label="Text color"
        title="Text color"
      >
        <div className="relative flex items-center justify-center w-4 h-4">
          <Baseline size={16} className="text-white" />
          <div 
            className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
            style={{ backgroundColor: textColor }}
          />
        </div>
      </button>

      {/* Text Color Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}
