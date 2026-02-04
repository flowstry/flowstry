'use client';
import {
    Circle,
    CornerDownRight,
    Hand,
    Image,
    MousePointer2,
    MoveRight,
    PenIcon,
    Spline,
    Square,
    Triangle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShapeName } from '../shapes/base';
import { ConnectorType } from '../shapes/connectors';
import { FreehandMarkerType, MARKER_CONFIGS } from '../shapes/freehand';

// Shape Icons
const RectIcon = () => <Square size={24} strokeWidth={1.5} />

const EllipseIcon = () => <Circle size={24} strokeWidth={1.5} />

const DiamondIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 4L20 12L12 20L4 12Z" />
    </svg>
)

const TriangleIcon = () => <Triangle size={24} strokeWidth={1.5} />

const TriangleDownIcon = () => <Triangle size={24} strokeWidth={1.5} className="rotate-180" />

const TriangleRightIcon = () => <Triangle size={24} strokeWidth={1.5} className="rotate-90" />

const TriangleLeftIcon = () => <Triangle size={24} strokeWidth={1.5} className="-rotate-90" />

const HexagonIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
    </svg>
)

const PentagonIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L22 9L18 21H6L2 9L12 2Z" />
    </svg>
)

const OctagonIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2H16L22 8V16L16 22H8L2 16V8L8 2Z" />
    </svg>
)

// Connector Icons
const StraightConnectorIcon = () => <MoveRight size={24} strokeWidth={1.5} />;
const BentConnectorIcon = () => <CornerDownRight size={24} strokeWidth={1.5} />;
const CurvedConnectorIcon = () => <Spline size={24} strokeWidth={1.5} />;

// Tool Icons
const SelectIcon = () => <MousePointer2 size={24} strokeWidth={1.5} />;
const PanIcon = () => <Hand size={24} strokeWidth={1.5} />;
const ImageIcon = () => <Image size={24} strokeWidth={1.5} />;
const PencilIcon = () => <PenIcon size={24} strokeWidth={1.5} />;

const LaserPointerIcon = () => (
    <div className="relative">
        <PenIcon size={24} strokeWidth={1.5} />
        <div className="absolute bottom-[-4px] left-[-4px] w-2 h-2 bg-red-500 rounded-full shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
    </div>
)

const FrameIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 8h7a1 1 0 0 0 1-1V3" />
    </svg>
)

// Data Structures
const BASIC_SHAPES: Array<{ type: ShapeName; name: string; icon: React.ReactNode }> = [
    { type: 'rectangle', name: 'Rectangle', icon: <RectIcon /> },
    { type: 'ellipse', name: 'Ellipse', icon: <EllipseIcon /> },
    { type: 'diamond', name: 'Diamond', icon: <DiamondIcon /> },
    { type: 'triangle', name: 'Triangle', icon: <TriangleIcon /> },
    { type: 'triangle-down', name: 'Triangle Down', icon: <TriangleDownIcon /> },
    { type: 'triangle-right', name: 'Triangle Right', icon: <TriangleRightIcon /> },
    { type: 'triangle-left', name: 'Triangle Left', icon: <TriangleLeftIcon /> },
    { type: 'hexagon', name: 'Hexagon', icon: <HexagonIcon /> },
    { type: 'pentagon', name: 'Pentagon', icon: <PentagonIcon /> },
    { type: 'octagon', name: 'Octagon', icon: <OctagonIcon /> },
]

const CONNECTOR_SHAPES: Array<{ type: ConnectorType; name: string; icon: React.ReactNode }> = [
    { type: 'bent', name: 'Bent', icon: <BentConnectorIcon /> },
    { type: 'curved', name: 'Curved', icon: <CurvedConnectorIcon /> },
    { type: 'straight', name: 'Straight', icon: <StraightConnectorIcon /> },
]

const MARKER_TYPES: Array<{ type: FreehandMarkerType; name: string }> = [
    { type: 'brush', name: 'Brush' },
    { type: 'pen', name: 'Pen' },
    { type: 'pencil', name: 'Pencil' },
    { type: 'highlighter', name: 'Highlighter' },
]

// ServiceCard icon - a horizontal card with icon on left and label on right (matches actual component)
const ServiceCardIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* Card outline */}
        <rect x="3" y="7" width="18" height="10" rx="3" />
        {/* Icon placeholder (left side) */}
        <rect x="5" y="9" width="6" height="6" rx="1.5" strokeDasharray="2 1" />
        {/* Text lines (right side) */}
        <path d="M13 12h6" strokeLinecap="round" />
    </svg>
);

// TodoCard icon - a checklist card
const TodoCardIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        {/* Checkbox checked */}
        <rect x="7" y="8" width="3" height="3" rx="0.5" />
        <path d="M7.5 9.5l1 1 1.5-2" strokeWidth="1" />
        {/* Checkbox unchecked */}
        <rect x="7" y="13" width="3" height="3" rx="0.5" />
        {/* Lines */}
        <path d="M12 9.5h5" strokeLinecap="round" />
        <path d="M12 14.5h5" strokeLinecap="round" />
    </svg>
);

export interface BottomToolbarProps {
    activeTool: string | null
    selectedShapeType: ShapeName
    selectedConnectorType?: ConnectorType
    selectedMarkerType?: FreehandMarkerType
    onToolChange: (toolName: string) => void
    onShapeTypeChange: (shapeType: ShapeName) => void
    onConnectorSelect?: (connectorType: ConnectorType) => void
    onPencilSelect?: (markerType: FreehandMarkerType) => void
    onFrameSelect?: () => void
    onServiceCardSelect?: () => void
    onTodoCardSelect?: () => void
    theme: 'light' | 'dark'
    containerRef?: React.RefObject<HTMLDivElement | null>
    /** When true, renders just buttons without container styling (for embedding in parent container) */
    embedded?: boolean
    isReadOnly?: boolean;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
    activeTool,
    selectedShapeType,
    selectedConnectorType = 'curved',
    selectedMarkerType = 'pen',
    onToolChange,
    onShapeTypeChange,
    onConnectorSelect,
    onPencilSelect,
    onFrameSelect,
    onServiceCardSelect,
    onTodoCardSelect,
    theme,
    containerRef,
    embedded = false,
    isReadOnly = false
}) => {
    const [mounted, setMounted] = useState(false)
    const [hoveredSection, setHoveredSection] = useState<string | null>(null)
    const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null)
    const flyoutTimerRef = useRef<NodeJS.Timeout | null>(null)
    const flyoutRef = useRef<HTMLDivElement>(null)
    const sectionRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    useEffect(() => {
        setMounted(true)
    }, [])

    // Smart Positioning Logic for flyouts (appear above the button)
    React.useLayoutEffect(() => {
        if (!hoveredSection || !flyoutRef.current || !mounted) return

        const triggerEl = sectionRefs.current[hoveredSection]
        if (!triggerEl) return

        const triggerRect = triggerEl.getBoundingClientRect()
        const flyoutRect = flyoutRef.current.getBoundingClientRect()

        // Use container bounds if available, otherwise fall back to window
        const containerEl = containerRef?.current
        const containerRect = containerEl?.getBoundingClientRect()

        const boundsLeft = containerRect?.left ?? 0
        const boundsRight = containerRect ? containerRect.left + containerRect.width : window.innerWidth

        const PADDING = 20

        // Calculate position - flyout appears ABOVE the button
        let leftPos = triggerRect.left + triggerRect.width / 2 - flyoutRect.width / 2

        // Ensure it doesn't overflow left
        if (leftPos < boundsLeft + PADDING) {
            leftPos = boundsLeft + PADDING
        }

        // Ensure it doesn't overflow right
        if (leftPos + flyoutRect.width > boundsRight - PADDING) {
            leftPos = boundsRight - flyoutRect.width - PADDING
        }

        // Position above the toolbar with some gap
        const topPos = triggerRect.top - flyoutRect.height - 12

        setFlyoutPosition({ top: topPos, left: leftPos })
    }, [hoveredSection, mounted, containerRef])

    // Hover logic
    const handleMouseEnterSection = (section: string) => {
        if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current)
        setHoveredSection(section)
        if (hoveredSection !== section) {
            setFlyoutPosition(null)
        }
    }

    const handleMouseLeaveSection = () => {
        flyoutTimerRef.current = setTimeout(() => {
            setHoveredSection(null)
            setFlyoutPosition(null)
        }, 600)
    }

    const handleShapeClick = (shapeType: ShapeName) => {
        onShapeTypeChange(shapeType)
        onToolChange('Draw')
    }

    // Render flyout content based on section
    const renderFlyoutContent = (sectionKey: string) => {
        if (sectionKey === 'Connectors') {
            return (
                <div className="grid grid-cols-3 gap-3">
                    {CONNECTOR_SHAPES.map(shape => (
                        <button
                            key={shape.type}
                            onClick={() => {
                                if (onConnectorSelect) onConnectorSelect(shape.type)
                                onToolChange('Connector')
                            }}
                            className={`group p-2 rounded-lg border aspect-square flex items-center justify-center transition-all hover:shadow-md ${activeTool === 'Connector' && (selectedConnectorType || 'curved') === shape.type
                                    ? 'border-[#36C3AD] bg-[#36C3AD]/10 text-[#36C3AD] dark:bg-[#36C3AD]/20 dark:text-[#36C3AD]'
                                    : theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-[#36C3AD] hover:text-[#36C3AD]'
                                }`}
                            title={shape.name}
                        >
                            <div className="transition-transform duration-200 group-hover:scale-110">
                                {shape.icon}
                            </div>
                        </button>
                    ))}
                </div>
            )
        }
        if (sectionKey === 'Basic') {
            return (
                <div className="grid grid-cols-5 gap-3">
                    {BASIC_SHAPES.map(shape => (
                        <button
                            key={shape.type}
                            onClick={() => handleShapeClick(shape.type)}
                            className={`group p-2 rounded-lg border aspect-square flex items-center justify-center transition-all hover:shadow-md ${activeTool === 'Draw' && selectedShapeType === shape.type
                                    ? 'border-[#36C3AD] bg-[#36C3AD]/10 text-[#36C3AD] dark:bg-[#36C3AD]/20 dark:text-[#36C3AD]'
                                    : theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-[#36C3AD] hover:text-[#36C3AD]'
                                }`}
                            title={shape.name}
                        >
                            <div className="transition-transform duration-200 group-hover:scale-110">
                                {shape.icon}
                            </div>
                        </button>
                    ))}
                </div>
            )
        }
        if (sectionKey === 'Pencil') {
            return (
                <div className="grid grid-cols-4 gap-3">
                    {MARKER_TYPES.map(marker => {
                        const config = MARKER_CONFIGS[marker.type]
                        return (
                            <button
                                key={marker.type}
                                onClick={() => {
                                    if (onPencilSelect) onPencilSelect(marker.type)
                                    onToolChange('Pencil')
                                }}
                                className={`group p-2 rounded-lg border aspect-square flex flex-col items-center justify-center transition-all hover:shadow-md ${activeTool === 'Pencil' && selectedMarkerType === marker.type
                                    ? 'border-[#36C3AD] bg-[#36C3AD]/10 text-[#36C3AD] dark:bg-[#36C3AD]/20 dark:text-[#36C3AD]'
                                    : theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-[#36C3AD] hover:text-[#36C3AD]'
                                    }`}
                                title={`${marker.name} - Stroke: ${config.strokeWidth}px, Opacity: ${Math.round(config.opacity * 100)}%`}
                            >
                                <div className="transition-transform duration-200 group-hover:scale-110">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={config.strokeWidth / 2} strokeOpacity={config.opacity}>
                                        <path d="M4 17 C 8 13, 12 15, 16 11 C 18 9, 20 7, 20 7" strokeLinecap={config.lineCap} />
                                    </svg>
                                </div>
                                <span className="text-[9px] mt-1 font-medium">{marker.name}</span>
                            </button>
                        )
                    })}
                </div>
            )
        }
        return null
    }

    // Render a tool button with optional flyout
    const renderToolButton = (
        toolName: string,
        icon: React.ReactNode,
        title: string,
        sectionKey?: string,
        isActive?: boolean
    ) => {
        const active = isActive ?? activeTool === toolName
        const hasFlyout = sectionKey && ['Pencil', 'Connectors', 'Basic'].includes(sectionKey)

        const handleClick = () => {
            if (sectionKey === 'Connectors') {
                if (onConnectorSelect) onConnectorSelect(selectedConnectorType as ConnectorType || 'bent')
                onToolChange('Connector')
            } else if (sectionKey === 'Basic') {
                onShapeTypeChange(selectedShapeType || 'rectangle')
                onToolChange('Draw')
            } else if (sectionKey === 'Pencil') {
                if (onPencilSelect) onPencilSelect(selectedMarkerType || 'pen')
                onToolChange('Pencil')
            } else {
                onToolChange(toolName)
            }
        }

        return (
            <>
                <button
                    ref={el => { if (sectionKey) sectionRefs.current[sectionKey] = el }}
                    onClick={handleClick}
                    onMouseEnter={hasFlyout ? () => handleMouseEnterSection(sectionKey!) : undefined}
                    onMouseLeave={hasFlyout ? handleMouseLeaveSection : undefined}
                    className={`flex items-center justify-center p-3 rounded-xl transition-all ${active
                            ? 'bg-[#36C3AD] text-white shadow-lg shadow-[#36C3AD]/30'
                            : theme === 'dark' ? 'text-gray-400 hover:bg-white/10 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                    title={title}
                >
                    {icon}
                </button>

                {/* Flyout Portal */}
                {mounted && hasFlyout && hoveredSection === sectionKey && createPortal(
                    <div
                        ref={flyoutRef}
                        onMouseEnter={() => handleMouseEnterSection(sectionKey!)}
                        onMouseLeave={handleMouseLeaveSection}
                        className={`fixed z-50 pb-4 flex items-end transition-opacity duration-100 ease-out pointer-events-auto ${flyoutPosition !== null ? 'opacity-100' : 'opacity-0'
                            }`}
                        style={{
                            top: flyoutPosition?.top ?? 0,
                            left: flyoutPosition?.left ?? 0
                        }}
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
                        <div className={`p-4 rounded-xl border shadow-2xl backdrop-blur-xl ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/95 border-gray-200'
                            }`}>
                            <h3 className={`font-semibold mb-3 px-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {sectionKey === 'Basic' ? 'Basic Shapes' : sectionKey === 'Connectors' ? 'Connectors' : 'Pencil'}
                            </h3>
                            {renderFlyoutContent(sectionKey!)}
                        </div>
                    </div>,
                    document.body
                )}
            </>
        )
    }

    const buttonsContent = isReadOnly ? (
        <>
            {/* Pan Tool */}
            {renderToolButton('Pan', <PanIcon />, 'Pan Tool (H)')}

            {/* Laser Pointer */}
            {renderToolButton('LaserPointer', <LaserPointerIcon />, 'Laser Pointer (L)')}
        </>
    ) : (
        <>
            {/* Select Tool */}
            {renderToolButton('Select', <SelectIcon />, 'Select Tool (V)')}

            {/* Pan Tool */}
            {renderToolButton('Pan', <PanIcon />, 'Pan Tool (H)')}

            {/* Laser Pointer */}
            {renderToolButton('LaserPointer', <LaserPointerIcon />, 'Laser Pointer (L)')}

            {/* Divider */}
            <div className={`w-px h-8 mx-1 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />

            {/* Pencil with flyout */}
            {renderToolButton(
                'Pencil',
                <PencilIcon />,
                'Pencil Tool (P)',
                'Pencil',
                activeTool === 'Pencil'
            )}


            {/* Image Tool */}
            {renderToolButton('Image', <ImageIcon />, 'Image Tool')}

            {/* Connector with flyout */}
            {renderToolButton(
                'Connector',
                CONNECTOR_SHAPES.find(c => c.type === (selectedConnectorType || 'curved'))?.icon || <BentConnectorIcon />,
                'Connector Tool',
                'Connectors',
                activeTool === 'Connector'
            )}

            {/* Basic Shapes with flyout */}
            {renderToolButton(
                'Draw',
                BASIC_SHAPES.find(s => s.type === selectedShapeType)?.icon || <RectIcon />,
                'Basic Shapes',
                'Basic',
                activeTool === 'Draw'
            )}

            {/* Frame Tool */}
            {renderToolButton(
                'Frame',
                <FrameIcon />,
                'Frame Tool',
                undefined, // No flyout
                false // Active state handled by parent usually? Or maybe I should check activeTool === 'Frame' if applicable, but currently it's a single select action usually
            )}

            {/* Divider */}
            {/* <div className={`w-px h-8 mx-1 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} /> */}

            {/* Application Shapes (Disabled for now) */}
            {/* <button
                onClick={() => onServiceCardSelect?.()}
                className={`flex items-center justify-center p-3 rounded-xl transition-all ${theme === 'dark' ? 'text-gray-400 hover:bg-white/10 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                title="Service Card"
            >
                <div className="flex-shrink-0"><ServiceCardIcon /></div>
            </button>

            <button
                onClick={() => onTodoCardSelect?.()}
                className={`flex items-center justify-center p-3 rounded-xl transition-all ${theme === 'dark' ? 'text-gray-400 hover:bg-white/10 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                title="Todo Card"
            >
                <div className="flex-shrink-0"><TodoCardIcon /></div>
            </button> */}
        </>
    )

    // When embedded, just return the buttons without container
    if (embedded) {
        return (
            <div className="flex items-center gap-1 shrink-0">
                {buttonsContent}
            </div>
        )
    }

    return (
        <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-2 rounded-2xl shadow-xl backdrop-blur-xl pointer-events-auto border ${theme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'
                }`}
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
            {buttonsContent}
        </div>
    )
}
