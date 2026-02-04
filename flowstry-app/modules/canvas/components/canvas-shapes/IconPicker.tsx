'use client'

import techIcons from '@/src/utils/tech-icon-manifest.json'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TechIcon {
  name: string
  path: string
  provider: string
  category: string
  keywords: string[]
}

interface IconPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (iconPath: string, iconName: string) => void
  anchorRef: React.RefObject<HTMLElement | null>
  theme: 'light' | 'dark'
}

// Group icons by provider
const groupedIcons = (techIcons as TechIcon[]).reduce((acc, icon) => {
  if (!acc[icon.provider]) {
    acc[icon.provider] = []
  }
  acc[icon.provider].push(icon)
  return acc
}, {} as Record<string, TechIcon[]>)

// Provider display order
const providerOrder = ['Languages', 'Frameworks', 'Databases', 'Tools', 'Os']

export const IconPicker: React.FC<IconPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  anchorRef,
  theme
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Calculate position based on anchor
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }
  }, [isOpen, anchorRef])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Filter icons based on search
  const filteredIcons = searchQuery.trim()
    ? (techIcons as TechIcon[]).filter(icon => 
        icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        icon.keywords.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase())) ||
        icon.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  if (!isOpen) return null

  const bgColor = theme === 'dark' ? 'bg-[#1A1A1F]' : 'bg-white'
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const mutedColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const inputBg = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
  const hoverBg = theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'

  const renderIconButton = (icon: TechIcon) => (
    <button
      key={icon.path}
      type="button"
      onClick={() => {
        onSelect(icon.path, icon.name)
        onClose()
      }}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${hoverBg}`}
      title={icon.name}
    >
      <img 
        src={icon.path} 
        alt={icon.name}
        className="w-8 h-8 object-contain"
        loading="lazy"
      />
      <span className={`text-xs mt-1 truncate w-full text-center ${mutedColor}`}>
        {icon.name}
      </span>
    </button>
  )

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed z-[10000] rounded-2xl shadow-2xl border ${bgColor} ${borderColor} backdrop-blur-xl`}
      style={{ 
        top: position.top, 
        left: position.left,
        width: '320px',
        maxHeight: '400px'
      }}
      onWheel={(e) => e.stopPropagation()}
      data-ui-control
      data-icon-picker
    >
      {/* Search Input */}
      <div className="p-3 border-b border-inherit">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search icons..."
            className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500 ${inputBg} ${borderColor} ${textColor}`}
          />
          <svg
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${mutedColor}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Icons Grid */}
      <div className="p-2 overflow-y-auto max-h-[320px] custom-scrollbar" data-theme={theme}>
        {filteredIcons ? (
          // Search results
          <div className="grid grid-cols-4 gap-1">
            {filteredIcons.slice(0, 40).map(renderIconButton)}
          </div>
        ) : (
          // Grouped by provider
          providerOrder.map(provider => {
            const icons = groupedIcons[provider]
            if (!icons || icons.length === 0) return null
            
            return (
              <div key={provider} className="mb-4">
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 px-1 ${mutedColor}`}>
                  {provider}
                </h3>
                <div className="grid grid-cols-4 gap-1">
                  {icons.slice(0, 12).map(renderIconButton)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>,
    document.body
  )
}
