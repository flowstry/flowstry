'use client'
import React, { useEffect, useRef, useState } from 'react'
import { ShapeName } from '../shapes/base'

export interface DrawingToolButtonProps {
  active: boolean
  selectedShapeType: ShapeName
  onClick: () => void
  onShapeTypeChange: (shapeType: ShapeName) => void
  onOpenPanel?: () => void
  theme: 'light' | 'dark'
}

const ShapeIcon: React.FC<{ shapeType: ShapeName; size?: number }> = ({ shapeType, size = 20 }) => {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  }

  switch (shapeType) {
    // Basic
    case 'rectangle':
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
        </svg>
      )
    case 'ellipse':
      return (
        <svg {...commonProps}>
          <ellipse cx="12" cy="12" rx="8" ry="6" />
        </svg>
      )
    case 'diamond':
      return (
        <svg {...commonProps}>
          <path d="M12 4L20 12L12 20L4 12Z" />
        </svg>
      )

    // Geometric
    case 'triangle':
      return (
        <svg {...commonProps}>
          <path d="M12 4L20 20H4L12 4Z" />
        </svg>
      )
    case 'triangle-down':
      return (
        <svg {...commonProps}>
          <path d="M12 20L4 4H20L12 20Z" />
        </svg>
      )
    case 'triangle-left':
      return (
        <svg {...commonProps}>
          <path d="M4 12L20 4V20L4 12Z" />
        </svg>
      )
    case 'triangle-right':
      return (
        <svg {...commonProps}>
          <path d="M20 12L4 20V4L20 12Z" />
        </svg>
      )
    case 'hexagon':
      return (
        <svg {...commonProps}>
          <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
        </svg>
      )
    case 'pentagon':
      return (
        <svg {...commonProps}>
          <path d="M12 2L22 9L18 21H6L2 9L12 2Z" />
        </svg>
      )
    case 'octagon':
      return (
        <svg {...commonProps}>
          <path d="M7.8 2H16.2L22 7.8V16.2L16.2 22H7.8L2 16.2V7.8L7.8 2Z" />
        </svg>
      )
    default:
      return null
  }
}

export const DrawingToolButton: React.FC<DrawingToolButtonProps> = ({
  active,
  selectedShapeType,
  onClick,
  onShapeTypeChange,
  onOpenPanel,
  theme
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const buttonRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showDropdown && searchInputRef.current) {
      searchInputRef.current.focus()
    } else {
      setSearchQuery('')
    }
  }, [showDropdown])

  const handleMainClick = () => {
    onClick()
    // Always open shapes panel when draw tool is clicked
    if (onOpenPanel) {
      onOpenPanel()
    }
  }

  const handleShapeSelect = (shapeType: ShapeName) => {
    onShapeTypeChange(shapeType)
    setShowDropdown(false)
    if (!active) {
      onClick()
    }
  }

  type ShapeCategory = 'Basic' | 'Geometric' | 'System'

  interface ShapeOption {
    type: ShapeName
    label: string
    category: ShapeCategory
  }

  const shapes: ShapeOption[] = [
    // Basic
    { type: 'rectangle', label: 'Rectangle', category: 'Basic' },
    { type: 'ellipse', label: 'Ellipse', category: 'Basic' },
    { type: 'diamond', label: 'Diamond', category: 'Basic' },
    { type: 'triangle', label: 'Triangle', category: 'Basic' },
    { type: 'triangle-down', label: 'Triangle Down', category: 'Basic' },
    { type: 'triangle-right', label: 'Triangle Right', category: 'Basic' },
    { type: 'triangle-left', label: 'Triangle Left', category: 'Basic' },
    { type: 'hexagon', label: 'Hexagon', category: 'Basic' },
    { type: 'pentagon', label: 'Pentagon', category: 'Basic' },
    { type: 'octagon', label: 'Octagon', category: 'Basic' },
  ]

  const filteredShapes = shapes.filter(shape =>
    shape.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group shapes by category
  const groupedShapes = filteredShapes.reduce((acc, shape) => {
    if (!acc[shape.category]) {
      acc[shape.category] = []
    }
    acc[shape.category].push(shape)
    return acc
  }, {} as Record<ShapeCategory, ShapeOption[]>)

  const categories: ShapeCategory[] = ['Basic', 'Geometric', 'System']

  return (
    <div ref={buttonRef} className="relative" data-draw-tool-button>
      <button
        type="button"
        onClick={handleMainClick}
        className={`
          h-10 w-10 rounded-md transition-all duration-150
          flex items-center justify-center
          ${active
            ? 'bg-blue-500 text-white shadow-md'
            : theme === 'dark'
              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
          }
        `}
        aria-label="Draw shape"
        title={`Draw ${selectedShapeType} (R)`}
      >
        <ShapeIcon shapeType={selectedShapeType} size={20} />
      </button>

      {showDropdown && (
        <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 z-50">
          <div className={`rounded-2xl shadow-2xl border p-2 min-w-[320px] ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
            {/* Search Input */}
            <div className="mb-3 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shapes..."
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
              />
              <svg
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Shape Grid */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar" data-theme={theme}>
              {categories.map(category => {
                const categoryShapes = groupedShapes[category]
                if (!categoryShapes || categoryShapes.length === 0) return null

                return (
                  <div key={category} className="mb-3 last:mb-0">
                    <div className={`text-xs font-semibold mb-2 px-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {category}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {categoryShapes.map((shape) => (
                        <button
                          key={shape.type}
                          type="button"
                          onClick={() => handleShapeSelect(shape.type)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all aspect-square ${selectedShapeType === shape.type
                            ? 'bg-purple-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          title={shape.label}
                        >
                          <ShapeIcon shapeType={shape.type} size={24} />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {Object.keys(groupedShapes).length === 0 && (
                <div className={`text-center py-4 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  No shapes found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

