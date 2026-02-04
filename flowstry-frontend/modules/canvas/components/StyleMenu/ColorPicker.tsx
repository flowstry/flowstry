'use client'
import React, { useRef } from 'react'

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  theme?: 'light' | 'dark'
  isMobile?: boolean
}

const PRESET_COLORS = [
  '#000000', // Black
  '#575757', // Dark gray
  '#E03131', // Red
  '#F76707', // Orange
  '#FCC419', // Yellow
  '#51CF66', // Green
  '#22B8CF', // Cyan
  '#3B82F6', // Blue
  '#7C3AED', // Purple
  '#E64980', // Pink
  '#FFFFFF', // White
  '#868E96', // Gray
  '#FFA8A8', // Light red
  '#FFC078', // Light orange
  '#FFE066', // Light yellow
  '#B2F2BB', // Light green
  '#99E9F2', // Light cyan
  '#A5D8FF', // Light blue
  '#D0BFFF', // Light purple
]

const MOBILE_PRESET_COLORS = [
  '#000000', // Black
  '#E03131', // Red
  '#F76707', // Orange
  '#FCC419', // Yellow
  '#51CF66', // Green
  '#22B8CF', // Cyan
  '#3B82F6', // Blue

  // Row 2
  '#FFFFFF', // White
  '#7C3AED', // Purple
  '#E64980', // Pink
  '#868E96', // Gray
  '#B2F2BB', // Light green
  '#A5D8FF', // Light blue
]

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label, theme = 'dark', isMobile = false }) => {
  const customInputRef = useRef<HTMLInputElement>(null)
  const isWhite = (color: string) => color.toLowerCase() === '#ffffff'

  const handleColorSelect = (color: string) => {
    onChange(color)
  }

  const handleCustomColorClick = () => {
    customInputRef.current?.click()
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    onChange(newColor)
  }

  // Determine split for rows
  const colors = isMobile ? MOBILE_PRESET_COLORS : PRESET_COLORS
  const rowSize = isMobile ? 7 : 10

  const firstRow = colors.slice(0, rowSize)
  const secondRow = colors.slice(rowSize)

  return (
    <div className="flex flex-col gap-3" data-ui-control>
      {/* First Row */}
      <div className={`flex ${isMobile ? 'justify-between' : 'gap-3'}`}>
        {firstRow.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorSelect(color)}
            className={`h-7 w-7 rounded-full transition-all shrink-0 ${
              value === color
              ? `ring-2 ${theme === 'dark' ? 'ring-white ring-offset-gray-900' : 'ring-gray-900 ring-offset-gray-50'} ring-offset-2`
                : 'hover:scale-110'
            } ${theme === 'light' && isWhite(color) ? 'border border-gray-200' : ''}`}
            style={{ backgroundColor: color }}
            aria-label={`${label || 'Color'}: ${color}`}
          />
        ))}
      </div>

      {/* Second Row */}
      <div className={`flex ${isMobile ? 'justify-between' : 'gap-3'}`}>
        {secondRow.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleColorSelect(color)}
            className={`h-7 w-7 rounded-full transition-all shrink-0 ${
              value === color
              ? `ring-2 ${theme === 'dark' ? 'ring-white ring-offset-gray-900' : 'ring-gray-900 ring-offset-gray-50'} ring-offset-2`
                : 'hover:scale-110'
            } ${theme === 'light' && isWhite(color) ? 'border border-gray-200' : ''}`}
            style={{ backgroundColor: color }}
            aria-label={`${label || 'Color'}: ${color}`}
          />
        ))}
        {/* Custom color picker button - always visible */}
        <button
          type="button"
          onClick={handleCustomColorClick}
          className={`h-7 w-7 rounded-full transition-all overflow-hidden relative shrink-0 ${
            !colors.includes(value)
            ? `ring-2 ${theme === 'dark' ? 'ring-white ring-offset-gray-900' : 'ring-gray-900 ring-offset-gray-50'} ring-offset-2`
              : 'hover:scale-110'
          }`}
          style={{
            background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
          }}
          aria-label="Custom color"
        >
          <input
            ref={customInputRef}
            type="color"
            value={value}
            onChange={handleCustomColorChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Pick custom color"
          />
        </button>
      </div>
    </div>
  )
}

