'use client'
import { ConnectorType } from '@/src/shapes/connectors'
import { CornerDownRight, MoveRight, Spline } from 'lucide-react'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface ConnectorTypeSelectorProps {
  value: ConnectorType
  isOpen: boolean
  onToggle: () => void
  onChange: (type: ConnectorType) => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  theme: 'light' | 'dark'
  isMobile?: boolean
}

const CONNECTOR_TYPE_OPTIONS: { value: ConnectorType; label: string; icon: React.ReactNode }[] = [
  {
    value: 'straight',
    label: 'Straight',
    icon: <MoveRight size={16} />
  },
  {
    value: 'bent',
    label: 'Bent',
    icon: <CornerDownRight size={16} />
  },
  {
    value: 'curved',
    label: 'Curved',
    icon: <Spline size={16} />
  }
]

import { createPortal } from 'react-dom'

export const ConnectorTypeSelector: React.FC<ConnectorTypeSelectorProps> = ({
  value,
  isOpen,
  onToggle,
  onChange,
  onClose,
  toolbarPlacement,
  canvasState: _canvasState,
  theme,
  isMobile = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { placement, xOffset, style: fixedStyle } = usePanelPosition(
    isOpen,
    containerRef,
    panelRef,
    toolbarPlacement,
    isMobile ? 'fixed' : 'absolute'
  )

  const currentOption = CONNECTOR_TYPE_OPTIONS.find(opt => opt.value === value) || CONNECTOR_TYPE_OPTIONS[0]

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`${isMobile ? 'rounded-none border-x-0' : 'rounded-xl'} shadow-2xl border overflow-hidden p-2 backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'}`}>
        <div className="flex items-center gap-1">
          {CONNECTOR_TYPE_OPTIONS.map((option) => {
            const isSelected = value === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  onClose()
                }}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isSelected
                  ? theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                aria-label={option.label}
              >
                <div className={isSelected ? 'text-[#36C3AD]' : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {option.icon}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Connector Type Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${isOpen
          ? theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}
        aria-label="Change connector type"
      >
        <div className="text-[#36C3AD]">
          {currentOption.icon}
        </div>
      </button>

      {/* Connector Type Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}

