'use client'
import React, { useEffect, useRef, useState } from 'react'

interface ExportImageModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (options: ExportOptions, format: 'png' | 'svg' | 'clipboard') => Promise<void>
  hasSelectedShapes: boolean
  getPreviewSVG: (options: Omit<ExportOptions, 'filename'>) => SVGSVGElement | null
  theme: 'light' | 'dark'
}

export interface ExportOptions {
  onlySelected: boolean
  withBackground: boolean
  scale: number
  filename: string
}

export const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  onExport,
  hasSelectedShapes,
  getPreviewSVG,
  theme
}) => {
  const [onlySelected, setOnlySelected] = useState(hasSelectedShapes)
  const [withBackground, setWithBackground] = useState(true)
  const [scale, setScale] = useState(1)
  const [filename, setFilename] = useState(`Untitled-${new Date().toISOString().split('T')[0]}`)
  const [isExporting, setIsExporting] = useState(false)
  const [previewSVG, setPreviewSVG] = useState<string>('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset onlySelected when hasSelectedShapes changes
  useEffect(() => {
    if (hasSelectedShapes) {
      setOnlySelected(true)
    } else {
      setOnlySelected(false)
    }
  }, [hasSelectedShapes])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Update preview when options change
  useEffect(() => {
    if (!isOpen) return

    const svg = getPreviewSVG({
      onlySelected,
      withBackground,
      scale: 1 // Always use 1x for preview
    })

    if (svg) {
      const svgString = new XMLSerializer().serializeToString(svg)
      setPreviewSVG(svgString)
    }
  }, [isOpen, onlySelected, withBackground, getPreviewSVG])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleExport = async (format: 'png' | 'svg' | 'clipboard') => {
    setIsExporting(true)
    try {
      await onExport({
        onlySelected,
        withBackground,
        scale,
        filename: format === 'clipboard' ? filename : `${filename}.${format}`
      }, format)
      // Don't close modal automatically - let user export multiple formats
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" data-ui-control>
      <div
        ref={modalRef}
        className={`rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border border-gray-700' : 'bg-white/95'
          }`}
        data-ui-control
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-8 py-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Export image</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8" data-theme={theme}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Preview Section */}
            <div className="space-y-4">
              <div 
                className={`aspect-[4/3] rounded-xl border-2 flex items-center justify-center overflow-hidden p-4 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  } ${
                  withBackground 
                  ? (theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')
                    : 'bg-white'
                }`}
                style={{
                  backgroundImage: withBackground ? 'none' : 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: withBackground ? undefined : '#ffffff'
                }}
              >
                {previewSVG ? (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: previewSVG }}
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-2 opacity-50">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M3 15L8 10L12 14L16 10L21 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-sm">Preview</p>
                  </div>
                )}
              </div>

              {/* Filename */}
              <div>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#36C3AD] focus:border-transparent text-sm ${theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  placeholder="Filename"
                />
              </div>
            </div>

            {/* Options Section */}
            <div className="space-y-6">
              {/* Only selected toggle */}
              {hasSelectedShapes && (
                <div className="flex items-center justify-between">
                  <label htmlFor="only-selected" className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Only selected
                  </label>
                  <button
                    id="only-selected"
                    type="button"
                    role="switch"
                    aria-checked={onlySelected}
                    onClick={() => setOnlySelected(!onlySelected)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      onlySelected ? 'bg-[#36C3AD]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        onlySelected ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Background toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="background" className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Background
                </label>
                <button
                  id="background"
                  type="button"
                  role="switch"
                  aria-checked={withBackground}
                  onClick={() => setWithBackground(!withBackground)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    withBackground ? 'bg-[#36C3AD]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      withBackground ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Scale selector */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Scale</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScale(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        scale === s
                        ? 'bg-[#36C3AD] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-8 py-6 border-t flex items-center justify-end gap-3 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <button
            type="button"
            onClick={() => handleExport('png')}
            disabled={isExporting}
            className="px-6 py-3 bg-[#36C3AD] text-white rounded-lg font-medium hover:bg-[#2eb39e] active:bg-[#249ba5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 11L8 3M8 11L5.5 8.5M8 11L10.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 13L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            PNG
          </button>
          <button
            type="button"
            onClick={() => handleExport('svg')}
            disabled={isExporting}
            className="px-6 py-3 bg-[#36C3AD] text-white rounded-lg font-medium hover:bg-[#2eb39e] active:bg-[#249ba5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 11L8 3M8 11L5.5 8.5M8 11L10.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 13L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            SVG
          </button>
          <button
            type="button"
            onClick={() => handleExport('clipboard')}
            disabled={isExporting}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="2" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 4H3C2.44772 4 2 4.44772 2 5V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V5C14 4.44772 13.5523 4 13 4H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Copy to clipboard
          </button>
        </div>
      </div>
    </div>
  )
}

