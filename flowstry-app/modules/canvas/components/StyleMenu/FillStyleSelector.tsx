'use client'
import { Ban } from 'lucide-react'
import React, { useRef } from 'react'
import { ColorPicker } from './ColorPicker'
import { usePanelPosition } from './usePanelPosition'

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'none'

export interface FillStyleSelectorProps {
  fillStyle: FillStyle
  fillColor: string
  fillOpacity: number
  isOpen: boolean
  onToggle: () => void
  onStyleChange: (style: FillStyle) => void
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const FILL_STYLES: { value: FillStyle; label: string }[] = [
  {
    value: 'solid',
    label: 'Solid'
  },
  {
    value: 'cross-hatch',
    label: 'Cross-hatch'
  },
  {
    value: 'hachure',
    label: 'Hachure'
  },
  {
    value: 'none',
    label: 'No fill'
  }
]

import { createPortal } from 'react-dom'

export const FillStyleSelector: React.FC<FillStyleSelectorProps> = ({
  fillStyle,
  fillColor,
  fillOpacity,
  isOpen,
  onToggle,
  onStyleChange,
  onColorChange,
  onOpacityChange,
  onClose: _onClose,
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

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-2xl'} shadow-2xl border p-4 min-w-[340px] backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'
        }`}>
        <div className="space-y-4">
          {/* Style Tabs */}
          <div className="flex items-center gap-2">
            {FILL_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => onStyleChange(style.value)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${fillStyle === style.value
                  ? 'bg-[#36C3AD]/10 border-[#36C3AD] text-[#36C3AD]'
                  : theme === 'dark'
                    ? 'border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                  }`}
                title={style.label}
              >
                {style.value === 'none' && (
                  <Ban size={20} className="opacity-60" />
                )}
                {style.value === 'solid' && (
                  <div className="w-5 h-5 rounded bg-current" />
                )}
                {style.value === 'hachure' && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="4" strokeWidth="1.5" />
                    <line x1="6" y1="16" x2="16" y2="6" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="3" y1="11" x2="11" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="9" y1="17" x2="17" y2="9" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {style.value === 'cross-hatch' && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="4" strokeWidth="1.5" />
                    <defs>
                      <clipPath id="cross-hatch-clip">
                        <rect x="2.5" y="2.5" width="15" height="15" rx="4" />
                      </clipPath>
                    </defs>
                    <g clipPath="url(#cross-hatch-clip)">
                      <path d="M4 16L16 4M4 10L10 4M10 16L16 10" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M4 4L16 16M4 10L10 16M10 4L16 10" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Color Picker */}
          {(fillStyle === 'solid' || fillStyle === 'hachure' || fillStyle === 'cross-hatch') && (
            <>
              <div className="pt-2">
                <ColorPicker value={fillColor} onChange={onColorChange} label="Fill color" theme={theme} isMobile={isMobile} />
              </div>

              {/* Opacity Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Opacity</label>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{Math.round(fillOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={fillOpacity}
                  onChange={(e) => onOpacityChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#36C3AD]"
                  style={{
                    background: `linear-gradient(to right, #36C3AD 0%, #36C3AD ${fillOpacity * 100}%, #374151 ${fillOpacity * 100}%, #374151 100%)`
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Fill Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        aria-label="Change fill"
      >
        {fillStyle === 'none' ? (
          <Ban size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
        ) : (
          <div className="flex items-center justify-center text-gray-200" style={{ color: fillColor }}>
            {fillStyle === 'solid' && (
              <div className="w-5 h-5 rounded bg-current" style={{ opacity: fillOpacity }} />
            )}
            {fillStyle === 'hachure' && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style={{ opacity: fillOpacity }}>
                <rect x="2.5" y="2.5" width="15" height="15" rx="4" strokeWidth="1.5" />
                <line x1="6" y1="16" x2="16" y2="6" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="11" x2="11" y2="3" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="17" x2="17" y2="9" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {fillStyle === 'cross-hatch' && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" style={{ opacity: fillOpacity }}>
                <rect x="2.5" y="2.5" width="15" height="15" rx="4" strokeWidth="1.5" />
                <defs>
                  <clipPath id="cross-hatch-clip-trigger">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="4" />
                  </clipPath>
                </defs>
                <g clipPath="url(#cross-hatch-clip-trigger)">
                  <path d="M4 16L16 4M4 10L10 4M10 16L16 10" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M4 4L16 16M4 10L10 16M10 4L16 10" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              </svg>
            )}
          </div>
        )}
      </button>

      {/* Fill Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

