'use client'
import React from 'react'
import { CANVAS_THEMES, type CanvasSettings, type SettingsManager } from '../core/SettingsManager'

interface ThemeFlyoutProps {
    isOpen: boolean
    onClose: () => void
    settings: CanvasSettings
    settingsManager: SettingsManager
    anchorElement: HTMLElement | null
}

export const ThemeFlyout: React.FC<ThemeFlyoutProps> = ({
    isOpen,
    onClose,
    settings,
    settingsManager,
    anchorElement
}) => {
    const flyoutRef = React.useRef<HTMLDivElement>(null)
    const isDark = settings.uiTheme === 'dark'

    // Close on click outside
    React.useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (e: MouseEvent) => {
            if (
                flyoutRef.current &&
                !flyoutRef.current.contains(e.target as Node) &&
                anchorElement &&
                !anchorElement.contains(e.target as Node)
            ) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose, anchorElement])

    // Close on Escape
    React.useEffect(() => {
        if (!isOpen) return
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleCanvasThemeSelect = (theme: typeof CANVAS_THEMES[0]) => {
        settingsManager.setCanvasTheme(theme)
    }

    const handleColorChange = (key: 'backgroundColor' | 'gridColor', color: string) => {
        settingsManager.updateCanvasThemeProperty({ [key]: color })
    }

    return (
        <div
            ref={flyoutRef}
            className={`absolute bottom-0 right-full mr-4 z-[60] w-[260px] flex flex-col max-h-[600px] rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all origin-bottom-right ${
                isDark ? 'bg-[#1A1A1F]/95 border-gray-700' : 'bg-white/95 border-gray-200'
            }`}
            data-ui-control
        >
            {/* Header */}
            <div className={`shrink-0 p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Canvas Theme
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Select a preset or customize colors
                </p>
            </div>

            {/* Scrollable Presets */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
                <div className="grid grid-cols-2 gap-2">
                    {CANVAS_THEMES.map((theme) => (
                        <button
                            key={theme.name}
                            onClick={() => handleCanvasThemeSelect(theme)}
                            className={`group relative rounded-lg border-2 p-1 transition-all text-left ${
                                settings.canvasTheme.name === theme.name
                                    ? 'border-[#3C82FF] ring-2 ring-[#3C82FF]/20'
                                    : isDark
                                    ? 'border-transparent hover:border-gray-700 hover:bg-white/5'
                                    : 'border-transparent hover:border-gray-200 hover:bg-black/5'
                            }`}
                        >
                            <div
                                className={`aspect-video w-full rounded-md shadow-sm mb-1.5 border overflow-hidden relative ${
                                    isDark ? 'border-gray-700' : 'border-gray-100'
                                }`}
                                style={{ backgroundColor: theme.backgroundColor }}
                            >
                                {theme.showGrid && (
                                    <div
                                        className="absolute inset-0 opacity-50"
                                        style={{
                                            backgroundImage:
                                                theme.gridStyle === 'dots'
                                                    ? `radial-gradient(${theme.gridColor} 1px, transparent 1px)`
                                                    : `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
                                            backgroundSize: '8px 8px'
                                        }}
                                    />
                                )}
                            </div>
                            <span className={`text-[10px] font-medium block truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {theme.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Fixed Footer: Customization */}
            <div className={`shrink-0 p-3 border-t ${isDark ? 'border-gray-700 bg-[#1A1A1F]/50' : 'border-gray-200 bg-gray-50/50'}`}>
                <div className="space-y-3">
                    <div>
                        <label className={`text-[10px] font-medium mb-1.5 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Background
                        </label>
                        <div className="flex gap-2">
                            <div className={`relative h-7 w-7 rounded-md overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                                <input
                                    type="color"
                                    value={settings.canvasTheme.backgroundColor}
                                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={settings.canvasTheme.backgroundColor}
                                onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                className={`flex-1 px-2 py-1 rounded-md text-[10px] font-mono border outline-none focus:ring-2 focus:ring-[#3C82FF]/50 ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                                        : 'bg-white border-gray-200 text-gray-700'
                                    }`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`text-[10px] font-medium mb-1.5 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Grid Color
                        </label>
                        <div className="flex gap-2">
                            <div className={`relative h-7 w-7 rounded-md overflow-hidden border ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                                <input
                                    type="color"
                                    value={settings.canvasTheme.gridColor}
                                    onChange={(e) => handleColorChange('gridColor', e.target.value)}
                                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={settings.canvasTheme.gridColor}
                                onChange={(e) => handleColorChange('gridColor', e.target.value)}
                                className={`flex-1 px-2 py-1 rounded-md text-[10px] font-mono border outline-none focus:ring-2 focus:ring-[#3C82FF]/50 ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                                        : 'bg-white border-gray-200 text-gray-700'
                                    }`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
