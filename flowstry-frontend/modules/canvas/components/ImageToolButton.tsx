'use client'
import React from 'react'

interface ImageToolButtonProps {
  active: boolean
  onClick: () => void
  theme: 'light' | 'dark'
}

export const ImageToolButton: React.FC<ImageToolButtonProps> = ({
  active,
  onClick,
  theme
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-md transition-colors ${active
          ? theme === 'dark'
            ? 'bg-blue-900/50 text-blue-400'
            : 'bg-blue-50 text-blue-600'
          : theme === 'dark'
            ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      title="Insert Image"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </button>
  )
}
