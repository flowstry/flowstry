'use client'
import { ShapeName } from '@/src/shapes/base'
import {
  Circle,
  Diamond,
  Hexagon,
  Octagon,
  Pentagon,
  Search,
  Square,
  Triangle
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface ShapeTypeSelectorProps {
  value: ShapeName
  isOpen: boolean
  onToggle: () => void
  onChange: (shapeType: ShapeName) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const SHAPE_TYPES: { value: ShapeName; icon: React.ReactNode }[] = [
  {
    value: 'rectangle',
    icon: <Square size={28} />
  },
  {
    value: 'ellipse',
    icon: <Circle size={28} />
  },
  {
    value: 'diamond',
    icon: <Diamond size={28} /> 
  },
  {
    value: 'triangle',
    icon: <Triangle size={28} />
  },
  {
    value: 'triangle-down',
    icon: <Triangle size={28} className="rotate-180" />
  },
  {
    value: 'triangle-right',
    icon: <Triangle size={28} className="rotate-90" />
  },
  {
    value: 'triangle-left',
    icon: <Triangle size={28} className="-rotate-90" />
  },
  {
    value: 'hexagon',
    icon: <Hexagon size={28} />
  },
  {
    value: 'pentagon',
    icon: <Pentagon size={28} />
  },
  {
    value: 'octagon',
    icon: <Octagon size={28} />
  }
]

import { createPortal } from 'react-dom'

export const ShapeTypeSelector: React.FC<ShapeTypeSelectorProps> = ({
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { placement, xOffset, style: fixedStyle } = usePanelPosition(
    isOpen,
    containerRef,
    panelRef,
    toolbarPlacement,
    isMobile ? 'fixed' : 'absolute'
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    } else {
      setSearchQuery('')
    }
  }, [isOpen])


  // Filter shapes based on search query
  const filteredShapes = SHAPE_TYPES.filter(shape =>
    shape.value.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const currentShape = SHAPE_TYPES.find(s => s.value === value)

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div
        className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-2xl'} shadow-2xl border p-2 min-w-[280px] backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'
          }`}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="mb-3 relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shapes..."
            className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[#36C3AD] ${theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
          />
          <div
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
          >
            <Search size={16} />
          </div>
        </div>

        {/* Shape Grid */}
        <div className="grid grid-cols-3 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar" data-theme={theme}>
          {filteredShapes.map((shape) => (
            <button
              key={shape.value}
              type="button"
              onClick={() => {
                onChange(shape.value)
                onClose()
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all aspect-square ${value === shape.value
                ? 'bg-[#36C3AD] text-white'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              title={shape.value.charAt(0).toUpperCase() + shape.value.slice(1)}
            >
              {shape.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Shape Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
          }`}
        aria-label="Change shape"
      >
        <div className="text-white">
          {currentShape ? React.cloneElement(currentShape.icon as React.ReactElement<{ size?: number }>, { size: 20 }) : <Square size={20} />}
        </div>
      </button>

      {/* Shape Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

