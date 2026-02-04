'use client'
import React, { useRef, useState } from 'react'
import { TextStyleControls, TextStyleControlsProps } from './TextStyleControls'
import { usePanelPosition } from './usePanelPosition'

export interface TextStyleFlyoutProps extends Omit<TextStyleControlsProps, 'openPanel' | 'togglePanel' | 'closeAllPanels' | 'placement'> {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  onListChange: (type: 'ordered' | 'unordered') => void
  isMobile?: boolean
}

import { createPortal } from 'react-dom'

export const TextStyleFlyout: React.FC<TextStyleFlyoutProps> = (props) => {
  const {
    isOpen,
    onToggle,
    onClose,
    toolbarPlacement,
    theme,
    onListChange,
    isMobile = false,
    ...controlsProps
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { placement, xOffset, style: fixedStyle } = usePanelPosition(
    isOpen,
    containerRef,
    panelRef,
    toolbarPlacement,
    isMobile ? 'fixed' : 'absolute'
  )
  
  // Local state for the controls inside the flyout
  // The StyleMenu manages the main panels, but inside this flyout, 
  // we might want independent panel state or share it. 
  // However, `TextStyleControls` expects `openPanel` and `togglePanel`.
  // If we open a sub-panel (like font family) inside this flyout, does it overlap?
  // `FontFamilySelector` uses `usePanelPosition` relative to ITSELF.
  // So if `FontFamilySelector` is inside `TextStyleFlyout`, its popup will position relative to its button.
  // BUT the selectors in `TextStyleMenu` (like `FontFamilySelector`) are designed to be top-level items in `StyleMenu`.
  // If we nest them, `usePanelPosition` might calculate based on the intermediate container.
  
  // Actually, `TextStyleControls` passes `openPanel` down to the selectors (FontSelector, etc).
  // These selectors manage their OWN open state via props. 
  // We need to manage the "which sub-panel is open" state LOCALLY for this TextFlyout 
  // so that opening "Font Family" inside the flyout closes "Color Picker" inside the flyout.
  const [activeSubPanel, setActiveSubPanel] = useState<string | null>(null)

  const toggleSubPanel = (panel: string) => {
    setActiveSubPanel(prev => prev === panel ? null : panel)
  }

  const closeAllSubPanels = () => {
    setActiveSubPanel(null)
  }

  const panelContent = (
    <div
      ref={panelRef}
      data-style-panel
      className={`z-50 ${isMobile ? '' : 'absolute'} ${!isMobile ? (placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3') : ''
        }`}
      style={isMobile ? fixedStyle : { left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
    >
      <div className={`
        ${isMobile ? 'rounded-none border-x-0' : 'rounded-2xl'} shadow-xl border p-2 backdrop-blur-xl flex items-center gap-2
        ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-gray-50/90 border-gray-200'}
      `}>
        <TextStyleControls
          {...controlsProps}
          openPanel={activeSubPanel}
          togglePanel={toggleSubPanel}
          closeAllPanels={closeAllSubPanels}
          onListChange={onListChange}
          theme={theme}
          // Determine placement for sub-popups. 
          // Since this Flyout is usually above the shape, sub-popups should probably also try to go above or on top?
          // If we pass 'top', they will try to go above the button inside the flyout.
          // Since the flyout is already above, this might push them off screen.
          // However `usePanelPosition` handles edge detection.
          placement={placement}
          isMobile={isMobile}
        />
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* Trigger Button (T icon) */}
      <button
        type="button"
        onClick={onToggle}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
        }`}
        title="Text Styles"
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
            className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}
        >
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        isMobile ? createPortal(panelContent, document.body) : panelContent
      )}
    </div>
  )
}
