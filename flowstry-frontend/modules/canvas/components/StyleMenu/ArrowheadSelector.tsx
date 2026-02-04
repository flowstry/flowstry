'use client'
import { ArrowheadType, ConnectorDirection } from '@/src/shapes/connectors'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface ArrowheadSelectorProps {
  value: ArrowheadType
  isOpen: boolean
  onToggle: () => void
  onChange: (type: ArrowheadType) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  label: string // 'Start' or 'End'
  direction?: ConnectorDirection | null // Direction of the connector point
  isMobile?: boolean
}

// ... imports remain the same, adding createPortal
import { createPortal } from 'react-dom'

// Re-defining renderArrowheadIcon function is not needed if I only target the Component part, but replace_file_content replaces a block.
// I can just replace the definition block of ArrowheadSelector.

// Helper to render arrowhead icon with direction
const renderArrowheadIcon = (
  type: ArrowheadType,
  connectorDirection: ConnectorDirection | null,
  isStart: boolean,
  color: string = 'currentColor',
  size: number = 24
) => {
  const viewBox = '0 0 24 24'
  
  // Base transform logic
  let transform = ''

  if (connectorDirection) {
    // Absolute rotation based on edge
    switch (connectorDirection) {
      case 'top': transform = 'rotate(90 12 12)'; break; // Down
      case 'bottom': transform = 'rotate(-90 12 12)'; break; // Up
      case 'left': transform = 'rotate(0 12 12)'; break; // Right
      case 'right': transform = 'rotate(180 12 12)'; break; // Left
    }
  } else {
    // Default: End points Right, Start points Left
    transform = isStart ? 'scale(-1, 1) translate(-24, 0)' : 'none'
  }

  // Common props
  const props = {
    stroke: color,
    strokeWidth: "1.5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none"
  }

  // Paths are defined as "End" arrows (Line from Left -> Arrow on Right)
  // ViewBox 0 0 24 24. Center Y=12.

  const renderPath = () => {
    switch (type) {
      case 'none':
        return <path d="M2 12L22 12" {...props} />
      case 'open-arrow':
        return <path d="M2 12L22 12 M10 6L22 12L10 18" {...props} />
      case 'filled-triangle':
        return (
          <g>
            <path d="M2 12L8 12" {...props} />
            <path d="M8 5L22 12L8 19Z" {...props} fill={color} />
          </g>
        )
      case 'hollow-triangle':
        return (
          <g>
            <path d="M2 12L8 12" {...props} />
            <path d="M8 5L22 12L8 19Z" {...props} fill="none" />
          </g>
        )
      case 'filled-diamond':
        return (
          <g>
            <path d="M2 12L6 12" {...props} />
            <path d="M6 12L14 4L22 12L14 20Z" {...props} fill={color} />
          </g>
        )
      case 'hollow-diamond':
        return (
          <g>
            <path d="M2 12L6 12" {...props} />
            <path d="M6 12L14 4L22 12L14 20Z" {...props} fill="none" />
          </g>
        )
      case 'circle':
        return (
          <g>
            <path d="M2 12L10 12" {...props} />
            <circle cx="16" cy="12" r="6" {...props} fill="none" />
          </g>
        )
      case 'filled-circle':
        return (
          <g>
            <path d="M2 12L10 12" {...props} />
            <circle cx="16" cy="12" r="6" {...props} fill={color} />
          </g>
        )
      case 'bar':
        return <path d="M2 12L22 12 M22 6L22 18" {...props} />
      case 'half-arrow-top':
        return <path d="M2 12L22 12 M10 6L22 12" {...props} />
      case 'half-arrow-bottom':
        return <path d="M2 12L22 12 M10 18L22 12" {...props} />
      case 'crows-foot-one':
        return <path d="M2 12L22 12 M16 6L16 18 M10 6L10 18" {...props} />
      case 'crows-foot-many':
        return <path d="M2 12L22 12 M22 6L16 12L22 18" {...props} />
      case 'crows-foot-zero-one':
        return (
          <g>
            <path d="M2 12L7 12 M13 12L22 12 M18 6L18 18" {...props} />
            <circle cx="10" cy="12" r="3" {...props} fill="none" />
          </g>
        )
      case 'crows-foot-zero-many':
        return (
          <g>
            <path d="M2 12L5 12 M11 12L22 12 M22 6L16 12L22 18" {...props} />
            <circle cx="8" cy="12" r="3" {...props} fill="none" />
          </g>
        )
      case 'crows-foot-one-many':
        return <path d="M2 12L22 12 M8 6L8 18 M22 6L16 12L22 18" {...props} />
      default:
        return null
    }
  }

  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none">
      <g transform={transform}>
        {renderPath()}
      </g>
    </svg>
  )
}

const ARROWHEAD_OPTIONS: { value: ArrowheadType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'open-arrow', label: 'Open Arrow' },
  { value: 'filled-triangle', label: 'Filled Triangle' },
  { value: 'hollow-triangle', label: 'Hollow Triangle' },
  { value: 'filled-diamond', label: 'Filled Diamond' },
  { value: 'hollow-diamond', label: 'Hollow Diamond' },
  { value: 'circle', label: 'Circle' },
  { value: 'filled-circle', label: 'Filled Circle' },
  { value: 'bar', label: 'Bar' },
  { value: 'half-arrow-top', label: 'Half Arrow Top' },
  { value: 'half-arrow-bottom', label: 'Half Arrow Bottom' },
  { value: 'crows-foot-one', label: 'Mandatory One' },
  { value: 'crows-foot-many', label: 'Mandatory Many' },
  { value: 'crows-foot-zero-one', label: 'Optional One' },
  { value: 'crows-foot-zero-many', label: 'Optional Many' },
  { value: 'crows-foot-one-many', label: 'One or Many' },
]

export const ArrowheadSelector: React.FC<ArrowheadSelectorProps> = ({
  value,
  isOpen,
  onToggle,
  onChange,
  onClose,
  toolbarPlacement,
  canvasState: _canvasState,
  theme,
  label,
  direction,
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

  // Determine if this is for start or end
  const isStart = label.toLowerCase() === 'start'

  const currentOption = ARROWHEAD_OPTIONS.find(opt => opt.value === value) || ARROWHEAD_OPTIONS[0]
  const iconColor = theme === 'dark' ? '#d1d5db' : '#374151'
  const selectedIconColor = '#36C3AD'

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-xl'} shadow-2xl border overflow-hidden p-2 min-w-[200px] backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'}`}>
        <div className="grid grid-cols-3 gap-1">
          {ARROWHEAD_OPTIONS.map((option) => {
            const isSelected = value === option.value
            const optionIconColor = isSelected
              ? selectedIconColor
              : (theme === 'dark' ? '#9ca3af' : '#6b7280')

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  onClose()
                }}
                className={`h-10 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${isSelected
                  ? theme === 'dark' ? 'bg-gray-800 border border-[#36C3AD]' : 'bg-gray-100 border border-[#36C3AD]'
                  : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                aria-label={option.label}
                title={option.label}
              >
                <div className="flex items-center justify-center" style={{ width: '28px', height: '24px' }}>
                  {renderArrowheadIcon(option.value, direction || null, isStart, optionIconColor, 24)}
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
      {/* Arrowhead Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 px-2 rounded-lg flex items-center gap-1.5 transition-colors ${isOpen
          ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        aria-label={`Change ${label.toLowerCase()} arrowhead`}
        title={`${label} Arrowhead: ${currentOption.label}`}
      >
        <div className="flex items-center justify-center" style={{ width: '24px', height: '24px' }}>
          {renderArrowheadIcon(value, direction || null, isStart, iconColor, 24)}
        </div>
        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </span>
      </button>

      {/* Arrowhead Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}
