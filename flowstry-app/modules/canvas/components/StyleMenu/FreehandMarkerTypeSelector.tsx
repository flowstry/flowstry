'use client'
import { FreehandMarkerType, MARKER_CONFIGS } from '@/src/shapes/freehand'
import { Brush, Highlighter, Pen, Pencil } from 'lucide-react'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface FreehandMarkerTypeSelectorProps {
  value: FreehandMarkerType
  isOpen: boolean
  onToggle: () => void
  onChange: (type: FreehandMarkerType) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const MARKER_TYPE_OPTIONS: FreehandMarkerType[] = ['brush', 'pen', 'pencil', 'highlighter']

const MarkerTypeIcon: React.FC<{ markerType: FreehandMarkerType }> = ({ markerType }) => {
  const size = 20
  const props = { size, strokeWidth: 1.5 }

  switch (markerType) {
    case 'brush':
      return <Brush {...props} />
    case 'pen':
      return <Pen {...props} />
    case 'pencil':
      return <Pencil {...props} />
    case 'highlighter':
      return <Highlighter {...props} />
    default:
      return null
  }
}

import { createPortal } from 'react-dom'

export const FreehandMarkerTypeSelector: React.FC<FreehandMarkerTypeSelectorProps> = ({
  value,
  isOpen,
  onToggle,
  onChange,
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

  const currentConfig = MARKER_CONFIGS[value]

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
          {MARKER_TYPE_OPTIONS.map((markerType) => {
            const isSelected = value === markerType
            const config = MARKER_CONFIGS[markerType]
            return (
              <button
                key={markerType}
                type="button"
                onClick={() => {
                  onChange(markerType)
                  onClose()
                }}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isSelected
                  ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                aria-label={config.label}
                title={config.label}
              >
                <div className={isSelected ? 'text-[#36C3AD]' : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  <MarkerTypeIcon markerType={markerType} />
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
      {/* Marker Type Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen
          ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        aria-label="Change marker type"
        title={currentConfig.label}
      >
        <div className="text-[#36C3AD]">
          <MarkerTypeIcon markerType={value} />
        </div>
      </button>

      {/* Marker Type Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}
