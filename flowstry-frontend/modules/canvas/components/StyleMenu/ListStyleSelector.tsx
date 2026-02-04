'use client'
import { RichTextManager } from '@/src/core/RichTextManager'
import { List, ListOrdered } from 'lucide-react'
import React, { useRef } from 'react'
import { usePanelPosition } from './usePanelPosition'

export interface ListStyleSelectorProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  toolbarPlacement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText: boolean
}

const LIST_STYLES = [
  { 
    value: 'insertUnorderedList', 
    label: 'Bullet List',
    icon: <List size={16} />
  },
  { 
    value: 'insertOrderedList', 
    label: 'Numbered List',
    icon: <ListOrdered size={16} />
  }
]

export const ListStyleSelector: React.FC<ListStyleSelectorProps> = ({
  isOpen,
  onToggle,
  onClose,
  toolbarPlacement,
  canvasState: _canvasState,
  isEditingText
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { placement, xOffset } = usePanelPosition(isOpen, containerRef, panelRef, toolbarPlacement)

  // Prevent focus loss when clicking buttons
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div ref={containerRef} className="relative" data-ui-control>
      {/* List Style Button */}
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={handleMouseDown}
        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-gray-700' : 'hover:bg-gray-800'
        }`}
        aria-label="List style"
        title="List style"
      >
        <List size={16} className="text-white" />
      </button>

      {/* List Style Panel */}
      {isOpen && (
        <div 
          ref={panelRef}
          data-style-panel
          className={`absolute z-50 ${
            placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
          }`}
          style={{ left: '50%', transform: `translateX(calc(-50% + ${xOffset}px))` }}
        >
          <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden w-[160px]">
            <div 
              className="flex flex-col"
              onWheel={(e) => e.stopPropagation()}
            >
              {LIST_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onMouseDown={handleMouseDown}
                  onClick={() => {
                    if (isEditingText) {
                      RichTextManager.toggleList(style.value === 'insertOrderedList' ? 'ordered' : 'unordered')
                    }
                    onClose()
                  }}
                  className="w-full px-4 py-3 text-left text-sm transition-colors text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3"
                >
                  <span className="text-gray-400">{style.icon}</span>
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
