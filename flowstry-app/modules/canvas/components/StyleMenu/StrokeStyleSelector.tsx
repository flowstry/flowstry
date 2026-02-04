'use client'
import { Ban, Minus } from 'lucide-react'
import React, { useRef } from 'react'
import { ColorPicker } from './ColorPicker'
import { usePanelPosition } from './usePanelPosition'

export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'none'

export interface StrokeStyleSelectorProps {
  strokeStyle: StrokeStyle
  strokeColor: string
  strokeWidth: number
  strokeOpacity: number
  strokeDrawStyle: 'standard' | 'handdrawn'
  isOpen: boolean
  onToggle: () => void
  onStyleChange: (style: StrokeStyle) => void
  onDrawStyleChange: (style: 'standard' | 'handdrawn') => void
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onOpacityChange: (opacity: number) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  minWidth?: number
  maxWidth?: number
  hideStyleTabs?: boolean
  isMobile?: boolean
}

const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  {
    value: 'solid',
    label: 'Solid'
  },
  {
    value: 'dashed',
    label: 'Dashed'
  },
  {
    value: 'dotted',
    label: 'Dotted'
  },
  {
    value: 'none',
    label: 'None'
  }
]

import { createPortal } from 'react-dom'

export const StrokeStyleSelector: React.FC<StrokeStyleSelectorProps> = ({
  strokeStyle,
  strokeColor,
  strokeDrawStyle,
  strokeWidth,
  strokeOpacity,
  isOpen,
  onToggle,
  onStyleChange,
  onDrawStyleChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onClose: _onClose,
  toolbarPlacement,
  canvasState: _canvasState,
  theme,
  minWidth = 1,
  maxWidth = 20,
  hideStyleTabs = false,
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
          {/* Draw Style (Clean vs Handdrawn) */}
          {!hideStyleTabs && (
            <div className={`flex p-1 rounded-lg mb-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <button
                type="button"
                onClick={() => onDrawStyleChange('standard')}
                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-sm font-medium transition-all ${strokeDrawStyle === 'standard'
                  ? theme === 'dark'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Clean
              </button>
              <button
                type="button"
                onClick={() => onDrawStyleChange('handdrawn')}
                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-sm font-medium transition-all ${strokeDrawStyle === 'handdrawn'
                  ? theme === 'dark'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Handdrawn
              </button>
            </div>
          )}

          {/* Style Tabs - can be hidden for freehand shapes */}
          {!hideStyleTabs && (
            <div className="flex items-center gap-2">
              {STROKE_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => onStyleChange(style.value)}
                  title={style.label}
                  className={`flex-1 h-9 flex items-center justify-center rounded-lg transition-all ${strokeStyle === style.value
                    ? 'bg-[#36C3AD] text-white'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  aria-label={style.label}
                >
                  {style.value === 'solid' && (
                    <Minus size={24} strokeWidth={2} />
                  )}
                  {style.value === 'dashed' && (
                    <Minus size={24} strokeWidth={2} strokeDasharray="8 4" />
                  )}
                  {style.value === 'dotted' && (
                    <Minus size={24} strokeWidth={2} strokeLinecap="round" strokeDasharray="0.5 3" />
                  )}
                  {style.value === 'none' && (
                    <Ban size={20} className="opacity-60" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Color Picker */}
          {strokeStyle !== 'none' && (
            <>
              <div className="pt-2">
                <ColorPicker value={strokeColor} onChange={onColorChange} label="Stroke color" theme={theme} isMobile={isMobile} />
              </div>

              {/* Thickness Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Thickness</label>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min={minWidth}
                  max={maxWidth}
                  value={strokeWidth}
                  onChange={(e) => onWidthChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#36C3AD]"
                  style={{
                    background: `linear-gradient(to right, #36C3AD 0%, #36C3AD ${(strokeWidth - minWidth) / (maxWidth - minWidth) * 100}%, #374151 ${(strokeWidth - minWidth) / (maxWidth - minWidth) * 100}%, #374151 100%)`
                  }}
                />
              </div>

              {/* Opacity Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Opacity</label>
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{Math.round(strokeOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={strokeOpacity}
                  onChange={(e) => onOpacityChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#36C3AD]"
                  style={{
                    background: `linear-gradient(to right, #36C3AD 0%, #36C3AD ${strokeOpacity * 100}%, #374151 ${strokeOpacity * 100}%, #374151 100%)`
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
      {/* Stroke Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        aria-label="Change stroke"
      >
        {strokeStyle === 'none' ? (
          // Show a slashed circle when stroke is none
          <Ban size={20} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
        ) : (
          <div
            className="w-5 h-5 rounded-full border-2"
            style={{
              borderColor: strokeColor,
              borderStyle: strokeStyle === 'dashed' ? 'dashed' : strokeStyle === 'dotted' ? 'dotted' : 'solid'
            }}
          />
        )}
      </button>

      {/* Stroke Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

