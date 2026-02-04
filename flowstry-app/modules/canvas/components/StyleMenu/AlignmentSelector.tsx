'use client'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart
} from 'lucide-react'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface AlignmentSelectorProps {
  isOpen: boolean
  onToggle: () => void
  onAlignLeft: () => void
  onAlignCenter: () => void
  onAlignRight: () => void
  onAlignTop: () => void
  onAlignMiddle: () => void
  onAlignBottom: () => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  isMobile?: boolean
}

import { createPortal } from 'react-dom'

export const AlignmentSelector: React.FC<AlignmentSelectorProps> = ({
  isOpen,
  onToggle,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onClose,
  toolbarPlacement,
  canvasState: _canvasState,
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

  const buttonClass = (isActive: boolean = false) => `h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
    isActive
      ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
      : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
  }`

  const iconClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600'

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-xl'} shadow-2xl border overflow-hidden p-2 backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'}`}>
        <div className="flex items-center gap-1">
          {/* Left */}
          <button
            type="button"
            onClick={() => { onAlignLeft(); onClose(); }}
            className={buttonClass()}
            title="Align left"
          >
            <AlignLeft size={18} strokeWidth={1.5} className={iconClass} />
          </button>

          {/* Center */}
          <button
            type="button"
            onClick={() => { onAlignCenter(); onClose(); }}
            className={buttonClass()}
            title="Align center (horizontal)"
          >
            <AlignCenter size={18} strokeWidth={1.5} className={iconClass} />
          </button>

          {/* Right */}
          <button
            type="button"
            onClick={() => { onAlignRight(); onClose(); }}
            className={buttonClass()}
            title="Align right"
          >
            <AlignRight size={18} strokeWidth={1.5} className={iconClass} />
          </button>

          {/* Top */}
          <button
            type="button"
            onClick={() => { onAlignTop(); onClose(); }}
            className={buttonClass()}
            title="Align top"
          >
            <AlignVerticalJustifyStart size={18} strokeWidth={1.5} className={iconClass} />
          </button>

          {/* Middle */}
          <button
            type="button"
            onClick={() => { onAlignMiddle(); onClose(); }}
            className={buttonClass()}
            title="Align middle (vertical)"
          >
            <AlignVerticalJustifyCenter size={18} strokeWidth={1.5} className={iconClass} />
          </button>

          {/* Bottom */}
          <button
            type="button"
            onClick={() => { onAlignBottom(); onClose(); }}
            className={buttonClass()}
            title="Align bottom"
          >
            <AlignVerticalJustifyEnd size={18} strokeWidth={1.5} className={iconClass} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Alignment Button - shows alignment icon */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen
          ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        aria-label="Align shapes"
        title="Align shapes"
      >
        <AlignLeft
          size={18}
          strokeWidth={1.5}
          color={isOpen ? '#36C3AD' : 'currentColor'}
        />
      </button>

      {/* Alignment Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}
