'use client'
import React from 'react'
import { COLOR_PALETTES, ColorPalette } from '../consts/colorPalettes'

interface ColorPaletteFlyoutProps {
    isOpen: boolean
    onClose: () => void
    theme: 'light' | 'dark'
    onApplyPalette: (palette: ColorPalette) => void
    activePaletteId?: string
}

export const ColorPaletteFlyout: React.FC<ColorPaletteFlyoutProps> = ({
    isOpen,
    onClose,
    theme,
    onApplyPalette,
    activePaletteId
}) => {
    if (!isOpen) return null

    // Position flyout to the right of the button (which we assume is at left-4 top-custom)
    // Or just fixed position near the sidebar area
    // The Sidebar is left-4. We can put this flyout at left-24 (sidebar width + gap).
    
    return (
        <div 
            className={`absolute z-50 rounded-2xl shadow-xl border w-72 backdrop-blur-xl pointer-events-auto ${
                theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Color Palettes
                </h3>
                <button 
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>

            <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {COLOR_PALETTES.map((palette) => (
                    <div 
                        key={palette.id}
                        className={`group p-3 rounded-xl mb-2 border transition-all hover:shadow-md cursor-pointer ${
                            activePaletteId === palette.id
                                ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                : theme === 'dark' 
                                    ? 'border-gray-800 hover:bg-gray-800' 
                                    : 'border-gray-100 hover:bg-gray-50'
                        }`}
                        onClick={() => onApplyPalette(palette)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                {palette.name}
                            </span>
                        </div>

                        {/* Preview */}
                        <div className="flex gap-2">
                            {/* Fill Preview */}
                            <div 
                                className="w-8 h-8 rounded-full shadow-sm border border-black/10 flex items-center justify-center"
                                style={{ backgroundColor: palette.colors.fill }}
                                title="Fill Color"
                            >
                                <span className="text-[10px] opacity-50 contrast-more:opacity-100 mix-blend-difference">Fill</span>
                            </div>
                            
                            {/* Stroke Preview */}
                            <div 
                                className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center"
                                style={{ 
                                    backgroundColor: 'transparent',
                                    border: `2px solid ${palette.colors.stroke}` 
                                }}
                                title="Stroke Color"
                            >
                                <span className="text-[10px]" style={{ color: palette.colors.stroke }}>Str</span>
                            </div>

                            {/* Text Preview */}
                            <div 
                                className="w-8 h-8 rounded-full shadow-sm border border-gray-200/50 flex items-center justify-center bg-white/50"
                                title="Text Color"
                            >
                                <span className="text-sm font-bold" style={{ color: palette.colors.textColor }}>
                                    Aa
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
