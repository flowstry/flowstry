'use client'
import React from 'react'

export interface ToolButtonProps {
  name: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  tooltip?: string
  theme: 'light' | 'dark'
}

export const ToolButton: React.FC<ToolButtonProps> = ({ name, icon, active, onClick, tooltip, theme }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative h-10 w-10 rounded-md transition-all duration-150
        flex items-center justify-center
        ${active 
        ? 'text-white shadow-md' 
        : theme === 'dark'
          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
        }
      `}
      style={active ? { backgroundColor: '#36C3AD' } : undefined}
      aria-label={tooltip || name}
      title={tooltip || name}
    >
      {icon}
    </button>
  )
}

