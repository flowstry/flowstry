'use client'
import { Brush, Code, Database, LayoutTemplate, Monitor, Palette, PencilIcon, Wrench, X } from 'lucide-react'
import React from 'react'
import { ColorPalette } from '../consts/colorPalettes'
import { ShapeName } from '../shapes/base'
import { ConnectorType } from '../shapes/connectors'
import { FreehandMarkerType } from '../shapes/freehand'
import { ColorPaletteFlyout } from './ColorPaletteFlyout'



export interface SidebarProps {
    isOpen: boolean
    activeTool: string | null
    selectedShapeType: ShapeName
    selectedConnectorType?: string
    selectedMarkerType?: FreehandMarkerType
    onToolChange: (toolName: string) => void
    onShapeTypeChange: (shapeType: ShapeName) => void
    onIconSelect: (iconPath: string, iconName?: string) => void
    onConnectorSelect?: (connectorType: ConnectorType) => void
    onPencilSelect?: (markerType: FreehandMarkerType) => void
    onServiceCardSelect?: () => void
    onTodoCardSelect?: () => void

    onCloseMobile?: () => void
    theme: 'light' | 'dark'
    containerRef?: React.RefObject<HTMLDivElement | null>

    // New Props for Library Navigation
    activeSection: string | null
    onSectionSelect: (section: string | null) => void

    // Color Palette Toggle
    onTogglePalette?: () => void
    isPaletteOpen?: boolean
    onApplyPalette?: (palette: ColorPalette) => void
    activePaletteId?: string

    // Draw Style Toggle
    drawStyle: 'standard' | 'handdrawn'
    onToggleDrawStyle: () => void

    // Layout (mobile)
    dockLeft?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onCloseMobile,
    theme,
    activeSection,
    onSectionSelect,
    onTogglePalette,
    isPaletteOpen,
    onApplyPalette,
    activePaletteId,
    drawStyle,
    onToggleDrawStyle,
    dockLeft
}) => {

    // Render a navigation item
    const renderNavItem = (title: string, icon: React.ReactNode, sectionKey: string) => {
        const isActive = activeSection === sectionKey

        const handleClick = () => {
            // Toggle
            if (isActive) {
                onSectionSelect(null)
            } else {
                onSectionSelect(sectionKey)
            }
        }

        return (
            <div
                role="button"
                onClick={handleClick}
                title={title}
                className={`w-full flex items-center justify-center p-2 transition-all relative cursor-pointer ${isActive
                    ? 'bg-[#36C3AD]/10 text-[#36C3AD] dark:bg-[#36C3AD]/20 dark:text-[#36C3AD]'
                    : theme === 'dark'
                        ? 'text-gray-400 hover:bg-[#1A1A1F] hover:text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
            >
                <div className="flex-shrink-0">{icon}</div>
            </div>
        )
    }

    return (
        <div
            className={`absolute top-1/2 -translate-y-1/2 ${dockLeft ? 'left-0' : 'left-4'} z-50 flex flex-col gap-3 transition-all duration-300 pointer-events-none ${isOpen ? 'translate-x-0' : '-translate-x-[200%] md:translate-x-0'
                }`}
        >
            {/* Draw Style Toggle - Floating above palette toggle */}
            <div className="relative pointer-events-auto mb-2">
                <button
                    onClick={() => {
                        console.log('Sidebar: Toggle Draw Style Clicked')
                        // Per user request, this button strictly toggles stroke and font style.
                        // It does NOT affect the fill style.
                        onToggleDrawStyle()
                    }}
                    className={`h-12 ${dockLeft ? 'rounded-r-xl rounded-l-none border-l-0 w-10' : 'w-12 rounded-xl'} shadow-lg flex items-center justify-center transition-all border backdrop-blur-md ${drawStyle === 'handdrawn'
                        ? 'bg-[#36C3AD] text-zinc-900 border-[#36C3AD]'
                        : theme === 'dark'
                            ? 'bg-[#1A1A1F] border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'
                            : 'bg-white/90 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    title={drawStyle === 'handdrawn' ? "Switch to Standard" : "Switch to Handdrawn"}
                >
                    <PencilIcon size={24} />
                </button>
            </div>

            {/* Color Palette Toggle - Floating above sidebar */}
            {onTogglePalette && (
                <div className="relative pointer-events-auto">
                    <button
                        onClick={onTogglePalette}
                        className={`h-12 ${dockLeft ? 'rounded-r-2xl rounded-l-none border-l-0 w-10' : 'w-12 rounded-2xl'} shadow-xl flex items-center justify-center transition-all border backdrop-blur-xl ${isPaletteOpen
                            ? 'bg-blue-500 text-white border-blue-600'
                            : theme === 'dark'
                                ? 'bg-[#1A1A1F] border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'
                                : 'bg-white/90 border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        title="Color Palettes"
                    >
                        <Palette size={24} strokeWidth={1.5} />
                    </button>

                    {/* Render Flyout relative to this button */}
                    <div className="absolute left-full top-0 ml-3">
                        <ColorPaletteFlyout
                            isOpen={!!isPaletteOpen}
                            onClose={onTogglePalette}
                            theme={theme}
                            onApplyPalette={onApplyPalette!}
                            activePaletteId={activePaletteId}
                        />
                    </div>
                </div>
            )}

            <aside
                className={`flex flex-col ${dockLeft ? 'rounded-r-2xl rounded-l-none border-l-0 w-10' : ' w-12 rounded-2xl'} shadow-xl backdrop-blur-xl pointer-events-auto border max-h-[calc(100vh-12rem)] overflow-hidden ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
            >
                {/* Mobile Close Button - Only show on mobile */}
                {onCloseMobile && (
                    <div className={`md:hidden p-2 flex justify-end`}>
                        <button
                            onClick={onCloseMobile}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <X size={24} />
                        </button>
                    </div>
                )}

                {/* Tech Icons Section */}
                <div className={`flex-1 overflow-y-auto py-2 space-y-2 flex flex-col items-center custom-scrollbar`}>
                    {/* We can re-add basic shapes here if we want them in the library too, but for now just tech icons as requested */}

                    {renderNavItem('Languages', <Code size={24} />, 'Languages')}

                    {renderNavItem('Frameworks', <LayoutTemplate size={24} />, 'Frameworks')}

                    {renderNavItem('Databases', <Database size={24} />, 'Databases')}

                    {renderNavItem('OS', <Monitor size={24} />, 'Os')}

                    {renderNavItem('Tools', <Wrench size={24} />, 'Tools')}
                </div>

                {/* Cloud Provider Section - Bottom */}
                <div className={`shrink-0 border-t py-2 space-y-2 flex flex-col items-center ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200/80'}`}>
                    {renderNavItem('AWS', <img src={theme === 'dark' ? "/icons/providers/aws-dark.svg" : "/icons/providers/aws.svg"} alt="AWS" className="w-7 h-7 object-contain" />, 'AWS')}

                    {renderNavItem('Azure', <img src="/icons/providers/azure.svg" alt="Azure" className="w-7 h-7 object-contain" />, 'Azure')}

                    {renderNavItem('Google Cloud', <img src="/icons/providers/gcp.svg" alt="GCP" className="w-7 h-7 object-contain" />, 'GCP')}

                    {renderNavItem('Kubernetes', <img src="/icons/providers/kubernetes.svg" alt="K8s" className="w-7 h-7 object-contain" />, 'Kubernetes')}
                </div>

            </aside>
        </div>
    )
}

