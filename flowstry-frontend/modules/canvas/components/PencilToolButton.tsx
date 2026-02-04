'use client'
import React, { useEffect, useRef, useState } from 'react'
import { FreehandMarkerType, MARKER_CONFIGS } from '../shapes/freehand'

export interface PencilToolButtonProps {
  active: boolean
  selectedMarkerType: FreehandMarkerType
  onClick: () => void
  onMarkerTypeChange: (markerType: FreehandMarkerType) => void
  onOpenPanel?: () => void
  theme: 'light' | 'dark'
}

const MarkerTypeIcon: React.FC<{ markerType: FreehandMarkerType; size?: number }> = ({ markerType, size = 20 }) => {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  }

  switch (markerType) {
    case 'brush':
      return (
        <svg {...commonProps} strokeWidth={2.5}>
          {/* Brush stroke icon - thick wavy line */}
          <path d="M4 17C6 14 8 12 12 12C16 12 18 14 20 17" />
          <path d="M4 12L8 8" />
        </svg>
      )
    case 'pen':
      return (
        <svg {...commonProps} strokeWidth={2}>
          {/* Pen icon */}
          <path d="M12 19L19 12L22 15L15 22L12 19Z" />
          <path d="M18 13L11 6L2 15V21H8L18 13Z" />
        </svg>
      )
    case 'pencil':
      return (
        <svg {...commonProps} strokeWidth={1.5}>
          {/* Pencil icon */}
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      )
    case 'highlighter':
      return (
        <svg {...commonProps} strokeWidth={2}>
          {/* Highlighter icon - thick marker */}
          <path d="M9 11L19 21" strokeWidth={4} opacity={0.5} />
          <path d="M17.5 1.5L22.5 6.5L11 18H6V13L17.5 1.5Z" />
        </svg>
      )
    default:
      return null
  }
}

const MARKER_TYPES: FreehandMarkerType[] = ['brush', 'pen', 'pencil', 'highlighter']

export const PencilToolButton: React.FC<PencilToolButtonProps> = ({
  active,
  selectedMarkerType,
  onClick,
  onMarkerTypeChange,
  onOpenPanel: _onOpenPanel,
  theme
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showDropdown])

  const handleMainClick = () => {
    onClick()
  }

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(!showDropdown)
  }

  const handleMarkerTypeSelect = (markerType: FreehandMarkerType) => {
    onMarkerTypeChange(markerType)
    setShowDropdown(false)
    if (!active) {
      onClick()
    }
  }

  return (
    <div ref={buttonRef} className="relative" data-pencil-tool-button>
      <div className="flex items-center">
        {/* Main button */}
        <button
          type="button"
          onClick={handleMainClick}
          className={`
            h-10 w-10 rounded-l-md transition-all duration-150
            flex items-center justify-center
            ${active
              ? 'bg-blue-500 text-white shadow-md'
              : theme === 'dark'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
            }
          `}
          aria-label="Pencil tool"
          title={`Draw with ${MARKER_CONFIGS[selectedMarkerType].label} (P)`}
        >
          <MarkerTypeIcon markerType={selectedMarkerType} size={20} />
        </button>

        {/* Dropdown toggle */}
        <button
          type="button"
          onClick={handleDropdownToggle}
          className={`
            h-10 w-5 rounded-r-md transition-all duration-150
            flex items-center justify-center border-l
            ${active
              ? 'bg-blue-500 text-white shadow-md border-blue-400'
              : theme === 'dark'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700'
                : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
            }
          `}
          aria-label="Select marker type"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`rounded-xl shadow-2xl border p-2 ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-1">
              {MARKER_TYPES.map((markerType) => {
                const isSelected = selectedMarkerType === markerType
                const config = MARKER_CONFIGS[markerType]
                return (
                  <button
                    key={markerType}
                    type="button"
                    onClick={() => handleMarkerTypeSelect(markerType)}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      isSelected
                        ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                        : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    }`}
                    title={config.label}
                    aria-label={config.label}
                  >
                    <div className={isSelected ? (theme === 'dark' ? 'text-purple-400' : 'text-purple-600') : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      <MarkerTypeIcon markerType={markerType} size={16} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
