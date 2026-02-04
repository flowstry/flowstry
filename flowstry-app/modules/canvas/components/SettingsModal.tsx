'use client'
import React, { useEffect, useRef, useState } from 'react'
import { CANVAS_THEMES, CanvasSettings, SettingsManager } from '../core/SettingsManager'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    settingsManager: SettingsManager
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    settingsManager
}) => {
    const [settings, setSettings] = useState<CanvasSettings>(settingsManager.getSettings())
    const [activeTab, setActiveTab] = useState<'general' | 'canvas'>('general')
    const modalRef = useRef<HTMLDivElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)

    // Sync settings when modal opens and keep syncing while open
    useEffect(() => {
        if (!isOpen) return
        
        // Initial sync
        setSettings(settingsManager.getSettings())
        
        // Poll for changes while modal is open (in case settings change from elsewhere)
        const interval = setInterval(() => {
            setSettings(settingsManager.getSettings())
        }, 100)
        
        return () => clearInterval(interval)
    }, [settingsManager, isOpen])

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


    // Prevent wheel events from propagating to canvas
    useEffect(() => {
        if (!isOpen) return

        const handleWheel = (e: WheelEvent) => {
            e.stopPropagation()
        }

        const elements = [modalRef.current, backdropRef.current].filter(Boolean) as HTMLDivElement[]
        
        elements.forEach(element => {
            element.addEventListener('wheel', handleWheel, { passive: false })
        })
        
        return () => {
            elements.forEach(element => {
                element.removeEventListener('wheel', handleWheel)
            })
        }
    }, [isOpen])

    if (!isOpen) return null

    const isDark = settings.uiTheme === 'dark'

    const handleUIThemeChange = (theme: 'light' | 'dark') => {
        settingsManager.setUITheme(theme)
        setSettings(settingsManager.getSettings())
    }

    const handleCanvasThemeSelect = (theme: typeof CANVAS_THEMES[0]) => {
        settingsManager.setCanvasTheme(theme)
        // Update local state immediately for instant feedback
        setSettings(settingsManager.getSettings())
    }

    const handleShowGridChange = (enabled: boolean) => {
        settingsManager.updateCanvasThemeProperty({ showGrid: enabled })
        setSettings(settingsManager.getSettings())
    }

    const handleSnapToGridChange = (enabled: boolean) => {
        settingsManager.setSnapToGrid(enabled)
        setSettings(settingsManager.getSettings())
    }

    const handleGridStyleChange = (style: 'dots' | 'lines') => {
        settingsManager.updateCanvasThemeProperty({ gridStyle: style })
        setSettings(settingsManager.getSettings())
    }

    const handleColorChange = (key: 'backgroundColor' | 'gridColor', color: string) => {
        settingsManager.updateCanvasThemeProperty({ [key]: color })
        setSettings(settingsManager.getSettings())
    }

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking directly on the backdrop (not on modal content)
        if (e.target === backdropRef.current) {
            e.preventDefault()
            e.stopPropagation()
            onClose()
        }
    }

    const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Prevent pointer events from reaching canvas
        e.preventDefault()
        e.stopPropagation()
    }

    const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent clicks inside modal from propagating to backdrop
        e.stopPropagation()
    }

    const handleModalPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Prevent pointer events from propagating to backdrop
        e.stopPropagation()
    }

    return (
        <div 
            ref={backdropRef} 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/10"
            data-ui-control
            onClick={handleBackdropClick}
            onPointerDown={handleBackdropPointerDown}
        >
            <div
                ref={modalRef}
                className={`rounded-2xl shadow-2xl w-[700px] h-[500px] overflow-hidden flex flex-col backdrop-blur-xl ${isDark ? 'bg-gray-900/95 text-white' : 'bg-white/95 text-gray-900'
                }`}
                data-ui-control
                onClick={handleModalClick}
                onPointerDown={handleModalPointerDown}
            >
                {/* Header */}
                <div className={`px-8 py-6 flex items-center justify-between flex-shrink-0 ${
                    isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'
                }`}>
                    <h2 className="text-2xl font-semibold">Settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`transition-colors ${
                            isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        aria-label="Close"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Content with sidebar */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className={`w-[180px] flex-shrink-0 ${
                        isDark ? 'border-r border-gray-700 bg-gray-800/50' : 'border-r border-gray-200 bg-gray-50'
                    }`}>
                        <nav className="p-4 space-y-1">
                            <button
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === 'general'
                                        ? 'bg-blue-600 text-white'
                                        : isDark
                                        ? 'text-gray-300 hover:bg-gray-700'
                                        : 'text-gray-700 hover:bg-gray-200'
                                }`}
                                onClick={() => setActiveTab('general')}
                            >
                                General
                            </button>
                            <button
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === 'canvas'
                                        ? 'bg-blue-600 text-white'
                                        : isDark
                                        ? 'text-gray-300 hover:bg-gray-700'
                                        : 'text-gray-700 hover:bg-gray-200'
                                }`}
                                onClick={() => setActiveTab('canvas')}
                            >
                                Canvas
                            </button>
                        </nav>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-y-auto p-8" data-theme={isDark ? 'dark' : 'light'}>
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                {/* UI Theme */}
                                <div>
                                    <h3 className="text-base font-medium mb-3">UI Theme</h3>
                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Theme for menus, modals, and UI elements
                                    </p>
                                    <div className={`flex gap-2 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        <button
                                            onClick={() => handleUIThemeChange('light')}
                                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                                settings.uiTheme === 'light'
                                                    ? isDark
                                                        ? 'bg-gray-700 shadow-sm'
                                                        : 'bg-white shadow-sm'
                                                    : isDark
                                                    ? 'text-gray-400 hover:text-gray-300'
                                                    : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            Light
                                        </button>
                                        <button
                                            onClick={() => handleUIThemeChange('dark')}
                                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                                settings.uiTheme === 'dark'
                                                    ? isDark
                                                        ? 'bg-gray-700 shadow-sm'
                                                        : 'bg-white shadow-sm'
                                                    : isDark
                                                    ? 'text-gray-400 hover:text-gray-300'
                                                    : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                </div>

                                {/* Current Canvas Theme Info */}
                                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-blue-50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                Current Canvas Theme
                                            </p>
                                            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {settings.canvasTheme.name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-12 h-12 rounded-lg border shadow-sm"
                                                style={{
                                                    backgroundColor: settings.canvasTheme.backgroundColor,
                                                    borderColor: isDark ? '#374151' : '#D1D5DB'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Show Grid */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium">Show Grid</h3>
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Display grid on canvas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.canvasTheme.showGrid}
                                        onClick={() => handleShowGridChange(!settings.canvasTheme.showGrid)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            settings.canvasTheme.showGrid
                                                ? 'bg-blue-600'
                                                : isDark
                                                ? 'bg-gray-600'
                                                : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                settings.canvasTheme.showGrid ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Snap to Grid */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium">Snap to Grid</h3>
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {settings.canvasTheme.showGrid
                                                ? 'Align shapes to grid automatically'
                                                : 'Enable grid to use snap-to-grid'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.snapToGrid}
                                        disabled={!settings.canvasTheme.showGrid}
                                        onClick={() => handleSnapToGridChange(!settings.snapToGrid)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            !settings.canvasTheme.showGrid
                                                ? isDark
                                                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                                                    : 'bg-gray-200 cursor-not-allowed opacity-50'
                                                : settings.snapToGrid
                                                ? 'bg-blue-600'
                                                : isDark
                                                ? 'bg-gray-600'
                                                : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                settings.snapToGrid ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Grid Style */}
                                {settings.canvasTheme.showGrid && (
                                    <div>
                                        <h3 className="text-base font-medium mb-3">Grid Style</h3>
                                        <div className={`flex gap-2 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                            <button
                                                onClick={() => handleGridStyleChange('dots')}
                                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                                    settings.canvasTheme.gridStyle === 'dots'
                                                        ? isDark
                                                            ? 'bg-gray-700 shadow-sm'
                                                            : 'bg-white shadow-sm'
                                                        : isDark
                                                        ? 'text-gray-400 hover:text-gray-300'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                Dots
                                            </button>
                                            <button
                                                onClick={() => handleGridStyleChange('lines')}
                                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                                    settings.canvasTheme.gridStyle === 'lines'
                                                        ? isDark
                                                            ? 'bg-gray-700 shadow-sm'
                                                            : 'bg-white shadow-sm'
                                                        : isDark
                                                        ? 'text-gray-400 hover:text-gray-300'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                Lines
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'canvas' && (
                            <div className="space-y-8">
                                {/* Canvas Themes */}
                                <div>
                                    <h3 className="text-sm font-medium mb-4">Canvas Themes</h3>
                                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Select a preset theme. Modifying any setting creates a custom theme.
                                    </p>
                                    <div className="grid grid-cols-3 gap-4">
                                        {CANVAS_THEMES.map((theme) => (
                                            <button
                                                key={theme.name}
                                                onClick={() => handleCanvasThemeSelect(theme)}
                                                className={`group relative rounded-lg border-2 p-1 transition-all ${
                                                    settings.canvasTheme.name === theme.name
                                                        ? 'border-blue-600 ring-2 ring-blue-100'
                                                        : isDark
                                                        ? 'border-transparent hover:border-gray-700'
                                                        : 'border-transparent hover:border-gray-200'
                                                }`}
                                            >
                                                <div
                                                    className={`aspect-video w-full rounded-md shadow-sm mb-2 border ${
                                                        isDark ? 'border-gray-700' : 'border-gray-100'
                                                    }`}
                                                    style={{ backgroundColor: theme.backgroundColor }}
                                                >
                                                    {/* Grid Preview */}
                                                    {theme.showGrid && (
                                                        <div
                                                            className="w-full h-full opacity-50"
                                                            style={{
                                                                backgroundImage:
                                                                    theme.gridStyle === 'dots'
                                                                        ? `radial-gradient(${theme.gridColor} 1px, transparent 1px)`
                                                                        : `linear-gradient(${theme.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)`,
                                                                backgroundSize: '10px 10px'
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {theme.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Customization */}
                                <div className={`pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <h3 className="text-sm font-medium mb-4">Customization</h3>
                                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Customize colors to create your own theme
                                    </p>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`block text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                Background Color
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={settings.canvasTheme.backgroundColor}
                                                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                                    className={`h-9 w-9 rounded cursor-pointer border p-0.5 ${
                                                        isDark ? 'border-gray-600' : 'border-gray-300'
                                                    }`}
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.canvasTheme.backgroundColor}
                                                    onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                                                    className={`flex-1 px-3 py-1.5 border rounded-md text-sm ${
                                                        isDark
                                                            ? 'border-gray-600 bg-gray-800 text-white'
                                                            : 'border-gray-300 bg-white text-gray-900'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                Grid Color
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={settings.canvasTheme.gridColor}
                                                    onChange={(e) => handleColorChange('gridColor', e.target.value)}
                                                    className={`h-9 w-9 rounded cursor-pointer border p-0.5 ${
                                                        isDark ? 'border-gray-600' : 'border-gray-300'
                                                    }`}
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.canvasTheme.gridColor}
                                                    onChange={(e) => handleColorChange('gridColor', e.target.value)}
                                                    className={`flex-1 px-3 py-1.5 border rounded-md text-sm ${
                                                        isDark
                                                            ? 'border-gray-600 bg-gray-800 text-white'
                                                            : 'border-gray-300 bg-white text-gray-900'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
