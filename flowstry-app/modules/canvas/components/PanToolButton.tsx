'use client'
import React from 'react'
import { ToolButton } from './ToolButton'

export interface PanToolButtonProps {
  active: boolean
  onClick: () => void
  theme: 'light' | 'dark'
}

export const PanToolButton: React.FC<PanToolButtonProps> = ({ active, onClick, theme }) => {
  return (
    <ToolButton
      name="Pan"
      active={active}
      onClick={onClick}
      tooltip="Pan (H)"
      theme={theme}
      icon={
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 7V3M10 3L7 6M10 3L13 6M10 13V17M10 17L7 14M10 17L13 14M3 10H7M7 10L4 7M7 10L4 13M13 10H17M17 10L14 7M17 10L14 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    />
  )
}

