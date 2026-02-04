'use client'
import { List, ListOrdered } from 'lucide-react'
import { default as React } from 'react'
import { RichTextManager } from '../../core/RichTextManager'

export interface ListButtonsProps {
  isEditingText: boolean
  onListChange: (type: 'ordered' | 'unordered') => void
  onRecordHistory?: () => void
}

export const ListButtons: React.FC<ListButtonsProps> = ({
  isEditingText,
  onListChange,
  onRecordHistory
}) => {
  // Prevent focus loss when clicking buttons
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handleListClick = (type: 'ordered' | 'unordered') => {
    if (isEditingText) {
      RichTextManager.toggleList(type)
      if (onRecordHistory) {
        onRecordHistory()
      }
    } else {
      onListChange(type)
    }
  }

  return (
    <>
      {/* Bullet List Button */}
      <button
        type="button"
        onClick={() => handleListClick('unordered')}
        onMouseDown={handleMouseDown}
        className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-800"
        aria-label="Bullet list"
        title="Bullet list"
      >
        <List
          size={18}
          className={isEditingText ? 'text-white' : 'text-gray-600 dark:text-gray-400'}
        />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1"></div>

      {/* Numbered List Button */}
      <button
        type="button"
        onClick={() => handleListClick('ordered')}
        onMouseDown={handleMouseDown}
        className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-800"
        aria-label="Numbered list"
        title="Numbered list"
      >
        <ListOrdered
          size={18}
          className={isEditingText ? 'text-white' : 'text-gray-600 dark:text-gray-400'}
        />
      </button>
    </>
  )
}
