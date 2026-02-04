'use client'
import { RichTextManager } from '@/src/core/RichTextManager'
import React, { useEffect, useRef, useState } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface FontSizeSelectorProps {
  value: number
  isOpen: boolean
  onToggle: () => void
  onChange: (fontSize: number) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText?: boolean
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const FONT_SIZES: { value: number; label: string }[] = [
  { value: 12, label: 'Small' },
  { value: 16, label: 'Medium' },
  { value: 20, label: 'Large' },
  { value: 24, label: 'Extra large' },
  { value: 32, label: 'Huge' }
]

// Get label for a font size (or return null if custom)
const getSizeLabel = (size: number): string | null => {
  const sizeObj = FONT_SIZES.find(s => s.value === size)
  return sizeObj ? sizeObj.label : null
}

import { createPortal } from 'react-dom'

export const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({
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
  const inputRef = useRef<HTMLInputElement>(null)
  const { placement, xOffset, style: fixedStyle } = usePanelPosition(
    isOpen,
    containerRef,
    panelRef,
    toolbarPlacement,
    isMobile ? 'fixed' : 'absolute'
  )
  const [customValue, setCustomValue] = useState<string>(String(value))

  // Update custom value when value prop changes
  useEffect(() => {
    setCustomValue(String(value))
  }, [value])

  const currentLabel = getSizeLabel(value) || 'Small'

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setCustomValue(inputValue)
    
    // Only update if it's a valid number
    const numValue = parseInt(inputValue, 10)
    if (!isNaN(numValue) && numValue > 0 && numValue <= 200) {
      if (isEditingText) {
        RichTextManager.setFontSize(numValue)
      } else {
        onChange(numValue)
      }
    }
  }

  const handleCustomInputBlur = () => {
    // Validate and set a default if invalid
    const numValue = parseInt(customValue, 10)
    if (isNaN(numValue) || numValue <= 0) {
      setCustomValue(String(value))
    } else if (numValue > 200) {
      setCustomValue('200')
      if (isEditingText) {
        RichTextManager.setFontSize(200)
      } else {
        onChange(200)
      }
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
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-xl'} shadow-2xl border overflow-hidden w-[200px] backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'}`}>
        <div className="py-1">
          {FONT_SIZES.map((size) => {
            const isSelected = value === size.value
            return (
              <button
                key={size.value}
                type="button"
                onClick={() => {
                  if (isEditingText) {
                    RichTextManager.setFontSize(size.value)
                  } else {
                    onChange(size.value)
                  }
                  onClose()
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${isSelected
                  ? theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  : theme === 'dark' ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <span>{size.label}</span>
                {isSelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={theme === 'dark' ? 'text-white' : 'text-gray-900'}
                  >
                    <path
                      d="M13.3333 4L6 11.3333L2.66667 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
        {/* Custom input field */}
        <div className={`border-t p-2 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max="200"
            value={customValue}
            onChange={handleCustomInputChange}
            onBlur={handleCustomInputBlur}
            className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none ${theme === 'dark'
              ? 'bg-gray-800 text-white border-gray-600 focus:border-[#36C3AD]'
              : 'bg-white text-gray-900 border-gray-300 focus:border-[#36C3AD]'
              }`}
            placeholder="Font size"
          />
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Font Size Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 px-3 rounded-lg flex items-center gap-2 transition-colors ${isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        aria-label="Change font size"
      >
        <span className="text-white text-sm font-medium">{currentLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-gray-400"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Font Size Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

