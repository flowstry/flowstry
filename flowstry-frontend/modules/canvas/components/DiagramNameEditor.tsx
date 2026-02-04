'use client'

import React, { useEffect, useRef, useState } from 'react'

interface DiagramNameEditorProps {
  theme: 'light' | 'dark'
  diagramName: string
  onDiagramNameChange: (name: string) => void
  isReadOnly?: boolean
  canEdit?: boolean // Permission-based editing (separate from viewer mode)
}

export const DiagramNameEditor: React.FC<DiagramNameEditorProps> = ({
  theme,
  diagramName,
  onDiagramNameChange,
  isReadOnly = false,
  canEdit = true, // Default to allowing edits
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(diagramName)
  const inputRef = useRef<HTMLInputElement>(null)

  // Effective read-only: either in viewer mode OR lacks edit permission
  const effectiveReadOnly = isReadOnly || !canEdit

  useEffect(() => {
    setEditValue(diagramName)
  }, [diagramName])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = () => {
    if (!effectiveReadOnly) {
      setIsEditing(true)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (editValue.trim() && editValue !== diagramName) {
      onDiagramNameChange(editValue.trim())
    } else {
      setEditValue(diagramName)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditValue(diagramName)
      setIsEditing(false)
    }
  }

  const isDark = theme === 'dark'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const hoverBg = isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`px-2 py-0.5 rounded-md text-sm font-medium ${textColor} bg-transparent border ${isDark ? 'border-[#36C3AD]/50' : 'border-[#36C3AD]'} focus:outline-none focus:ring-1 focus:ring-[#36C3AD]/30 min-w-[80px] max-w-[200px]`}
      />
    )
  }

  return (
    <button
      onDoubleClick={handleDoubleClick}
      title={effectiveReadOnly ? diagramName : 'Double-click to rename'}
      className={`px-2 py-1 rounded-md text-sm font-medium ${textColor} ${!effectiveReadOnly && hoverBg} transition-colors max-w-[200px] truncate ${!effectiveReadOnly && 'cursor-text'}`}
      disabled={effectiveReadOnly}
    >
      {diagramName}
    </button>
  )
}
