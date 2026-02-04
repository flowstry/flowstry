'use client'
import React from 'react'
import { ToolButton } from './ToolButton'

export interface SelectToolButtonProps {
  active: boolean
  onClick: () => void
  theme: 'light' | 'dark'
}

export const SelectToolButton: React.FC<SelectToolButtonProps> = ({ active, onClick, theme }) => {
  return (
    <ToolButton
      name="Select"
      active={active}
      onClick={onClick}
      tooltip="Select (V)"
      theme={theme}
      icon={
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3 3L16 10L9 11L7 17L3 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      }
    />
  )
}

