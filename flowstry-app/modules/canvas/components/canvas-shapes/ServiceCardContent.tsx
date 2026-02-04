'use client'

import type { ReactShapeContentProps } from '@/src/shapes/react/ReactShape'
import React, { useEffect, useRef, useState } from 'react'
import { IconPicker } from './IconPicker'

// Sizing constants
const ICON_SIZE = 32
const PADDING_X = 12 // px-3 = 12px
const GAP = 12 // gap-3 = 12px
const PADDING_Y = 8
const CHAR_WIDTH = 8 // approximate character width

/**
 * ServiceCardContent - React component for the ServiceCard shape
 * Fills its container and handles all service-specific logic
 */
export const ServiceCardContent: React.FC<ReactShapeContentProps> = ({
  theme,
  isSelected,
  data,
  onDataChange,
  onMinDimensionsChange,
  onSelect
}) => {
  const iconPath = (data.iconPath as string) || null
  const serviceName = (data.serviceName as string) || 'New Service'
  
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [localName, setLocalName] = useState(serviceName)
  const iconButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Store dismiss handler ref so it can be called externally
  const dismissHandlerRef = useRef<() => void>(() => { })

  // Update dismiss handler when state changes
  dismissHandlerRef.current = () => {
    // Close icon picker
    setIsIconPickerOpen(false)
    // End name editing and blur input
    if (isEditingName) {
      setIsEditingName(false)
      if (localName !== serviceName) {
        onDataChange({ serviceName: localName })
      }
    }
    // Blur any focused input
    inputRef.current?.blur()
  }

  const bgColor = theme === 'dark' ? 'bg-[#1E1E24]' : 'bg-white'
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const mutedColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200'

  // Close popover and blur input when shape is deselected
  useEffect(() => {
    if (!isSelected) {
      dismissHandlerRef.current()
    }
  }, [isSelected])

  // Listen for global dismiss event (fired when clicking outside shapes on canvas)
  useEffect(() => {
    const handleGlobalDismiss = () => {
      dismissHandlerRef.current()
    }
    window.addEventListener('reactshape-dismiss', handleGlobalDismiss)
    return () => {
      window.removeEventListener('reactshape-dismiss', handleGlobalDismiss)
    }
  }, [])

  // Calculate and report min dimensions when service name changes
  useEffect(() => {
    const textWidth = Math.max(60, serviceName.length * CHAR_WIDTH)
    const minWidth = PADDING_X * 2 + ICON_SIZE + GAP + textWidth
    const minHeight = PADDING_Y * 2 + ICON_SIZE
    onMinDimensionsChange(minWidth, minHeight)
  }, [serviceName, onMinDimensionsChange])

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect() // Select the shape when clicking to edit name
    setIsEditingName(true)
  }

  const handleNameBlur = () => {
    setIsEditingName(false)
    if (localName !== serviceName) {
      onDataChange({ serviceName: localName })
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setLocalName(serviceName)
      setIsEditingName(false)
    }
  }

  const handleIconChange = (newIconPath: string, iconName: string) => {
    const updates: Record<string, unknown> = { iconPath: newIconPath }
    // Only set the name if it's still the default
    if (serviceName === 'New Service' || serviceName === '') {
      updates.serviceName = iconName
    }
    onDataChange(updates)
  }

  // Sync local name with prop
  useEffect(() => {
    if (!isEditingName) {
      setLocalName(serviceName)
    }
  }, [serviceName, isEditingName])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingName])

  return (
    <div
      className={`w-full h-full flex flex-row items-center gap-3 px-3 rounded-xl ${bgColor}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Icon Button */}
      <button
        ref={iconButtonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onSelect() // Select the shape when clicking icon button
          setIsIconPickerOpen(!isIconPickerOpen)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-700/20 transition-colors"
        style={{ width: 32, height: 32 }}
      >
        {iconPath ? (
          <img 
            src={iconPath} 
            alt={serviceName}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`flex items-center justify-center w-full h-full rounded-lg border-2 border-dashed ${borderColor}`}>
            <svg className={`w-4 h-4 ${mutedColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        )}
      </button>

      {/* Service Name */}
      <div className="flex-1 min-w-0 flex items-center">
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            className={`w-full text-sm font-medium bg-transparent border-b border-purple-500 outline-none ${textColor}`}
          />
        ) : (
          <div
            onClick={handleNameClick}
              onPointerDown={(e) => e.stopPropagation()}
            className={`text-sm font-medium truncate cursor-text hover:underline ${textColor}`}
          >
            {serviceName || 'Untitled'}
          </div>
        )}
      </div>

      {/* Icon Picker */}
      <IconPicker
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        onSelect={handleIconChange}
        anchorRef={iconButtonRef}
        theme={theme}
      />
    </div>
  )
}

