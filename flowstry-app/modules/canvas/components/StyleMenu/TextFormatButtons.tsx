'use client'
import { RichTextManager } from '@/src/core/RichTextManager'
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react'
import React from 'react'

export interface TextFormatButtonsProps {
  fontWeight: 'normal' | 'bold' | string
  fontStyle: 'normal' | 'italic' | string
  textDecoration: string
  onFontWeightToggle: () => void
  onFontStyleToggle: () => void
  onTextDecorationChange: (format: 'underline' | 'line-through') => void
  onRecordHistory: () => void
  isEditingText: boolean
  theme: 'light' | 'dark'
}

export const TextFormatButtons: React.FC<TextFormatButtonsProps> = ({
  fontWeight,
  fontStyle,
  textDecoration,
  onFontWeightToggle,
  onFontStyleToggle,
  onTextDecorationChange,
  onRecordHistory,
  isEditingText,
  theme
}) => {
  const handleBoldClick = () => {
    if (isEditingText) {
      RichTextManager.toggleFormat('bold')
      // Record history after inline formatting change
      onRecordHistory()
    } else {
      onFontWeightToggle()
    }
  }

  const handleStrikethroughClick = () => {
    if (isEditingText) {
      RichTextManager.toggleFormat('line-through')
      // Record history after inline formatting change
      onRecordHistory()
    } else {
      onTextDecorationChange('line-through')
    }
  }

  // Prevent focus loss when clicking buttons
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const isUnderline = textDecoration.includes('underline')
  const isLineThrough = textDecoration.includes('line-through')

  return (
    <>
      {/* Bold Button */}
      <button
        type="button"
        onClick={handleBoldClick}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
          fontWeight === 'bold'
          ? 'bg-[#36C3AD] text-white'
            : theme === 'dark'
              ? 'hover:bg-gray-800 text-white'
              : 'hover:bg-gray-100 text-gray-900'
        }`}
        aria-label="Bold"
        title="Bold"
      >
        <Bold
          size={18}
          className={fontWeight === 'bold' ? 'text-white' : theme === 'dark' ? 'text-white' : 'text-gray-900'}
        />
      </button>

      <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

      {/* Italic Button */}
      <button
        type="button"
        onClick={() => {
          if (isEditingText) {
            RichTextManager.toggleFormat('italic')
            // Record history after inline formatting change
            onRecordHistory()
          } else {
            onFontStyleToggle()
          }
        }}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${fontStyle === 'italic'
          ? 'bg-[#36C3AD] text-white'
          : theme === 'dark'
            ? 'hover:bg-gray-800 text-white'
            : 'hover:bg-gray-100 text-gray-900'
          }`}
        aria-label="Italic"
        title="Italic"
      >
        <Italic
          size={18}
          className={fontStyle === 'italic' ? 'text-white' : theme === 'dark' ? 'text-white' : 'text-gray-900'}
        />
      </button>

      <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

      {/* Strikethrough Button */}
      <button
        type="button"
        onClick={handleStrikethroughClick}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
          isLineThrough
          ? 'bg-[#36C3AD] text-white'
            : theme === 'dark'
              ? 'hover:bg-gray-800 text-white'
              : 'hover:bg-gray-100 text-gray-900'
          }`}
        aria-label="Strikethrough"
        title="Strikethrough"
      >
        <Strikethrough
          size={18}
          className={isLineThrough ? 'text-white' : theme === 'dark' ? 'text-white' : 'text-gray-900'}
        />
      </button>

      <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

      {/* Underline Button */}
      <button
        type="button"
        onClick={() => {
          if (isEditingText) {
            RichTextManager.toggleFormat('underline')
            // Record history after inline formatting change
            onRecordHistory()
          } else {
            onTextDecorationChange('underline')
          }
        }}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isUnderline
          ? 'bg-[#36C3AD] text-white'
          : theme === 'dark'
            ? 'hover:bg-gray-800 text-white'
            : 'hover:bg-gray-100 text-gray-900'
          }`}
        aria-label="Underline"
        title="Underline"
      >
        <Underline
          size={18}
          className={isUnderline ? 'text-white' : theme === 'dark' ? 'text-white' : 'text-gray-900'}
        />
      </button>
    </>
  )
}
