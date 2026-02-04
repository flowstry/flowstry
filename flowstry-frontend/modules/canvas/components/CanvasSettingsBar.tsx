'use client'
import React, { useRef, useState } from 'react'
import { CanvasSettings, SettingsManager } from '../core/SettingsManager'
import { ThemeFlyout } from './ThemeFlyout'

interface CanvasSettingsBarProps {
    settings: CanvasSettings
    settingsManager: SettingsManager
    theme: 'light' | 'dark'
    orientation?: 'vertical' | 'horizontal'
}

export const CanvasSettingsBar: React.FC<CanvasSettingsBarProps> = ({
    settings,
    settingsManager,
    theme,
    orientation = 'vertical'
}) => {
    const isDark = theme === 'dark'
    const [isThemeFlyoutOpen, setIsThemeFlyoutOpen] = useState(false)
    const themeButtonRef = useRef<HTMLButtonElement>(null)

    const isVertical = orientation === 'vertical'

    const containerClasses = [
        'flex items-center gap-1',
        isVertical ? 'flex-col py-2 w-10' : 'flex-row px-2 h-10',
        isDark ? (isVertical ? 'border-gray-700' : '') : (isVertical ? 'border-gray-200' : '')
    ].join(' ')

    const separatorClasses = isVertical
        ? `h-px w-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`
        : `w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`


    const toggleDarkMode = () => {
        settingsManager.setUITheme(isDark ? 'light' : 'dark')
    }

    const toggleGrid = () => {
        settingsManager.updateCanvasThemeProperty({ showGrid: !settings.canvasTheme.showGrid })
    }

    const toggleSnapToGrid = () => {
        settingsManager.setSnapToGrid(!settings.snapToGrid)
    }

    const toggleGridStyle = () => {
        const newStyle = settings.canvasTheme.gridStyle === 'dots' ? 'lines' : 'dots'
        settingsManager.updateCanvasThemeProperty({ gridStyle: newStyle })
    }

    return (
        <div className={containerClasses}>
            {/* Dark Mode Toggle */}
            <button
                onClick={toggleDarkMode}
                className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                        ? 'text-yellow-400 hover:bg-white/10'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDark ? (
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                )}
            </button>

            <div className={separatorClasses} />

            {/* Canvas Theme Button */}
            <div className="relative">
                <button
                    ref={themeButtonRef}
                    onClick={() => setIsThemeFlyoutOpen(!isThemeFlyoutOpen)}
                    className={`p-1.5 rounded-lg transition-colors ${
                        isDark
                            ? 'text-gray-300 hover:bg-white/10'
                        : 'text-gray-600 hover:bg-gray-100'
                    } ${isThemeFlyoutOpen ? (isDark ? 'bg-white/10' : 'bg-gray-100') : ''}`}
                    title={`Canvas Theme: ${settings.canvasTheme.name}`}
                >
                    <div
                        className="w-4 h-4 rounded-full border shadow-sm"
                        style={{
                            backgroundColor: settings.canvasTheme.backgroundColor,
                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
                        }}
                    />
                </button>
                <ThemeFlyout
                    isOpen={isThemeFlyoutOpen}
                    onClose={() => setIsThemeFlyoutOpen(false)}
                    settings={settings}
                    settingsManager={settingsManager}
                    anchorElement={themeButtonRef.current}
                />
            </div>

            <div className={separatorClasses} />

            {/* Grid Toggle */}
             <button
                onClick={toggleGrid}
                className={`p-1.5 rounded-lg transition-colors ${
                    settings.canvasTheme.showGrid
                    ? 'text-[#36C3AD] bg-[#36C3AD]/10'
                    : isDark ? 'text-gray-500 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={settings.canvasTheme.showGrid ? "Hide Grid" : "Show Grid"}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                </svg>
            </button>

            {/* Extended Grid Controls */}
            {settings.canvasTheme.showGrid && (
                <div className={`flex items-center gap-1 animate-in fade-in duration-200 ${isVertical ? 'flex-col slide-in-from-top-2' : 'flex-row slide-in-from-left-2'}`}>
                     {/* Snap to Grid */}
                    <button
                        onClick={toggleSnapToGrid}
                        className={`p-1.5 rounded-lg transition-colors ${
                            settings.snapToGrid
                            ? 'text-[#36C3AD] bg-[#36C3AD]/10'
                            : isDark ? 'text-gray-500 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="Snap to Grid"
                    >
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path d="M13 13h8v8h-8z" /> {/* Magnet-like visual */}
                             <path d="M21 7v-4h-4"/>
                             <path d="M3 17v4h4"/>
                             <path d="M13 3h-4v4h4z"/> 
                         </svg>
                    </button>

                    {/* Grid Style Toggle */}
                    <button
                        onClick={toggleGridStyle}
                        className={`p-1.5 rounded-lg transition-colors text-[10px] font-medium ${
                             isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Toggle Grid Style (Dots/Lines)"
                    >
                        {settings.canvasTheme.gridStyle === 'dots' ? 'Dots' : 'Line'}
                    </button>
                </div>
            )}
        </div>
    )
}
