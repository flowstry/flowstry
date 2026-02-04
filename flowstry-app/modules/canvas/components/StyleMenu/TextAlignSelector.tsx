'use client'
import { RichTextManager } from '@/src/core/RichTextManager'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface TextAlignSelectorProps {
  value: 'left' | 'center' | 'right'
  isOpen: boolean
  onToggle: () => void
  onChange: (align: 'left' | 'center' | 'right') => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText?: boolean
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const ALIGN_OPTIONS: { value: 'left' | 'center' | 'right'; label: string; icon: React.ReactNode }[] = [
  {
    value: 'left',
    label: 'Left',
    icon: <AlignLeft size={16} />
  },
  {
    value: 'center',
    label: 'Center',
    icon: <AlignCenter size={16} />
  },
  {
    value: 'right',
    label: 'Right',
    icon: <AlignRight size={16} />
  }
]

import { createPortal } from 'react-dom'

export const TextAlignSelector: React.FC<TextAlignSelectorProps> = ({
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

  const currentOption = ALIGN_OPTIONS.find(opt => opt.value === value) || ALIGN_OPTIONS[0]

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
          {ALIGN_OPTIONS.map((option) => {
            const isSelected = value === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (isEditingText) {
                    RichTextManager.setTextAlign(option.value)
                  } else {
                    onChange(option.value)
                  }
                  onClose()
                }}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isSelected
                  ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                aria-label={option.label}
              >
                <div className={isSelected ? 'text-[#36C3AD]' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  {option.icon}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Text Align Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        aria-label="Change text alignment"
      >
        <div className="text-[#36C3AD]">
          {currentOption.icon}
        </div>
      </button>

      {/* Text Align Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

