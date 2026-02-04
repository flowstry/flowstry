'use client'
import { DiagramShape, ShapeName } from '@/src/shapes/base'
import { ArrowheadType, ConnectorShape, ConnectorType } from '@/src/shapes/connectors'
import { FrameShape } from '@/src/shapes/FrameShape'
import { FreehandMarkerType, FreehandShape } from '@/src/shapes/freehand'
import { Edit2, MinusSquare, PlayCircle, PlusSquare, Type } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { AlignmentSelector } from './AlignmentSelector'
import { ArrowheadSelector } from './ArrowheadSelector'
import { ConnectorTypeSelector } from './ConnectorTypeSelector'
import { FillStyleSelector, type FillStyle } from './FillStyleSelector'
import { FreehandMarkerTypeSelector } from './FreehandMarkerTypeSelector'
import { ShapeTypeSelector } from './ShapeTypeSelector'
import { StrokeStyleSelector, type StrokeStyle } from './StrokeStyleSelector'
import { TextStyleControls } from './TextStyleControls'
import { TextStyleFlyout } from './TextStyleFlyout'

export interface StyleMenuProps {
  selectedShapes: DiagramShape[]
  canvasState: { scale: number; translation: { x: number; y: number } }
  containerRect: DOMRect | null
  isDragging: boolean
  isResizing: boolean
  onFillColorChange: (color: string) => void
  onFillOpacityChange: (opacity: number, skipHistory?: boolean) => void
  onStrokeColorChange: (color: string) => void
  onStrokeStyleChange: (style: StrokeStyle) => void
  onStrokeDrawStyleChange?: (style: 'standard' | 'handdrawn') => void
  onStrokeWidthChange: (width: number, skipHistory?: boolean) => void
  onStrokeOpacityChange: (opacity: number, skipHistory?: boolean) => void
  onFillStyleChange: (style: FillStyle) => void
  onFillDrawStyleChange?: (style: 'standard' | 'handdrawn') => void
  onShapeTypeChange: (shapeType: ShapeName) => void
  onFontFamilyChange: (fontFamily: string) => void
  onFontSizeChange: (fontSize: number) => void
  onFontWeightToggle: () => void
  onFontStyleToggle: () => void
  onTextDecorationChange: (format: 'underline' | 'line-through') => void
  onListChange: (type: 'ordered' | 'unordered') => void
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void
  onTextJustifyChange: (justify: 'top' | 'middle' | 'bottom') => void
  onTextColorChange: (color: string) => void
  onConnectorTypeChange?: (type: ConnectorType) => void
  onStartArrowheadChange?: (type: ArrowheadType) => void
  onEndArrowheadChange?: (type: ArrowheadType) => void
  onToggleFlowAnimation?: () => void

  onFreehandMarkerTypeChange?: (type: FreehandMarkerType) => void
  onFreehandStrokeColorChange?: (color: string) => void
  onFreehandStrokeWidthChange?: (width: number, skipHistory?: boolean) => void
  onFreehandStrokeOpacityChange?: (opacity: number, skipHistory?: boolean) => void
  onAlignLeft?: () => void
  onAlignCenter?: () => void
  onAlignRight?: () => void
  onAlignTop?: () => void
  onAlignMiddle?: () => void
  onAlignBottom?: () => void
  onFrameRename?: () => void
  onToggleIcon?: () => void
  onRecordHistory: () => void
  theme: 'light' | 'dark'
  isMobile?: boolean
}

type OpenPanel = 'shape' | 'fill' | 'stroke' | 'connectorType' | 'startArrowhead' | 'endArrowhead' | 'fontFamily' | 'fontSize' | 'textAlign' | 'textJustify' | 'textColor' | 'markerType' | 'freehandStroke' | 'alignment' | 'textStyle' | null

export const StyleMenu: React.FC<StyleMenuProps> = ({
  selectedShapes,
  canvasState,
  containerRect,
  isDragging,
  isResizing,
  onFillColorChange,
  onFillOpacityChange,
  onStrokeColorChange,
  onStrokeStyleChange,
  onStrokeDrawStyleChange,
  onStrokeWidthChange,
  onStrokeOpacityChange,
  onFillStyleChange,
  onFillDrawStyleChange,
  onShapeTypeChange,
  onFontFamilyChange,
  onFontSizeChange,
  onFontWeightToggle,
  onFontStyleToggle,
  onTextDecorationChange,
  onListChange,
  onTextAlignChange,
  onTextJustifyChange,
  onTextColorChange,
  onConnectorTypeChange,
  onStartArrowheadChange,
  onEndArrowheadChange,
  onToggleFlowAnimation,

  onFreehandMarkerTypeChange,
  onFreehandStrokeColorChange,
  onFreehandStrokeWidthChange,
  onFreehandStrokeOpacityChange,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onFrameRename,
  onToggleIcon,
  onRecordHistory,
  theme,
  isMobile = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')
  const [xOffset, setXOffset] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [fillStyle, setFillStyle] = useState<FillStyle>('solid')
  const [fillDrawStyle, setFillDrawStyle] = useState<'standard' | 'handdrawn'>('standard')
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid')
  const [strokeDrawStyle, setStrokeDrawStyle] = useState<'standard' | 'handdrawn'>('standard')
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const previousSelectedShapeIdsRef = useRef<string>('')
  const panelPlacement = isMobile ? 'top' : placement
  
  // Debounce timers for slider changes
  const fillOpacityDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const strokeOpacityDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const strokeWidthDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const freehandStrokeOpacityDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const freehandStrokeWidthDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Separate freehand shapes from non-freehand shapes
  const freehandShapes = React.useMemo(() =>
    selectedShapes.filter(shape => shape.type === 'freehand') as FreehandShape[],
    [selectedShapes]
  )

  // Filter out freehand shapes - they have their own style menu
  const nonFreehandShapes = React.useMemo(() => 
    selectedShapes.filter(shape => shape.type !== 'freehand'), 
    [selectedShapes]
  )
  
  // Determine which menu to show
  const showFreehandMenu = freehandShapes.length > 0
  const showRegularMenu = nonFreehandShapes.length > 0

  // If no shapes at all, return null
  if (selectedShapes.length === 0) {
    return null
  }

  // Get the common properties of selected shapes (with safe defaults)
  const firstShape = nonFreehandShapes[0]
  const drawStyle = firstShape?.appearance.drawStyle || 'standard'
  const fillColor = firstShape?.appearance.fill || '#ffffff'
  const fillOpacity = firstShape?.appearance.fillOpacity ?? 1
  const strokeColor = firstShape?.appearance.stroke || '#575757'
  const strokeWidth = firstShape?.appearance.strokeWidth || 4
  const strokeOpacity = firstShape?.appearance.strokeOpacity ?? 1
  // Show the first shape's type as preview (works for single or multiple selection)
  const shapeType = firstShape?.type || 'rectangle'
  // Text style properties
  const fontSize = firstShape?.appearance.fontSize || 14
  const fontFamily = firstShape?.appearance.fontFamily || 'Inter, system-ui, -apple-system, sans-serif'
  const fontWeight = firstShape?.appearance.fontWeight || 'normal'
  const fontStyle = firstShape?.appearance.fontStyle || 'normal'
  const textDecoration = firstShape?.appearance.textDecoration || 'none'
  const textAlign = firstShape?.appearance.textAlign || 'center'
  const textJustify = firstShape?.appearance.textJustify || 'middle'
  const textColor = firstShape?.appearance.textColor || '#000000'
  // Check if any selected shape has text
  const hasText = nonFreehandShapes.some(shape => shape.text && shape.text.trim().length > 0)
  // Check if all selected shapes are frames
  const areAllFrames = nonFreehandShapes.length > 0 && nonFreehandShapes.every(shape => shape.type === 'frame')
  // Check if any frame has a label (for dynamic icon)
  const framesHaveLabels = areAllFrames && nonFreehandShapes.some(shape => {
    const frame = shape as FrameShape
    return frame.labelText && frame.labelText.trim().length > 0
  })
  // Check if all selected shapes are connectors (only non-freehand shapes)
  const areAllConnectors = nonFreehandShapes.length > 0 && nonFreehandShapes.every(shape => shape.type === 'connector')
  const connectorType = areAllConnectors ? (firstShape as ConnectorShape)?.connectorType || 'straight' : 'straight'
  const startArrowheadType = areAllConnectors ? (firstShape as ConnectorShape)?.startArrowheadType || 'none' : 'none'
  const endArrowheadType = areAllConnectors ? (firstShape as ConnectorShape)?.endArrowheadType || 'open-arrow' : 'open-arrow'
  const startDirection = areAllConnectors ? (firstShape as ConnectorShape)?.startConnectorPointDirection || (firstShape as ConnectorShape)?.startConnectorPoint || null : null
  const endDirection = areAllConnectors ? (firstShape as ConnectorShape)?.endConnectorPointDirection || (firstShape as ConnectorShape)?.endConnectorPoint || null : null
  const isAnimated = areAllConnectors ? (firstShape as ConnectorShape)?.animated || false : false

  // Check if any shape is currently editing text
  const isEditingText = nonFreehandShapes.some(s => s.state.isEditingText)

  // Freehand shape properties (from first freehand shape)
  const firstFreehand = freehandShapes[0]
  const freehandMarkerType = firstFreehand?.markerType || 'pen'
  const freehandStrokeColor = firstFreehand?.appearance.stroke || '#000000'
  const freehandStrokeWidth = firstFreehand?.appearance.strokeWidth || 3
  const freehandStrokeOpacity = firstFreehand?.appearance.strokeOpacity ?? 1

  // Calculate bounding box of all selected shapes (all types)
  const bounds = React.useMemo(() => {
    // Use all selected shapes for bounds calculation
    const shapesForBounds = selectedShapes
    if (shapesForBounds.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    shapesForBounds.forEach(shape => {
      const bbox = shape.layout.getBBox()
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    })

    return { minX, minY, maxX, maxY }
  }, [selectedShapes])

  // Convert world coordinates to screen coordinates
  const worldToScreen = (worldX: number, worldY: number) => {
    const screenX = worldX * canvasState.scale + canvasState.translation.x
    const screenY = worldY * canvasState.scale + canvasState.translation.y
    return { x: screenX, y: screenY }
  }

  // Convert world coordinates to screen coordinates
  const screenBounds = React.useMemo(() => {
    if (!bounds) return null
    const topLeft = worldToScreen(bounds.minX, bounds.minY)
    const bottomRight = worldToScreen(bounds.maxX, bounds.maxY)
    const centerX = (topLeft.x + bottomRight.x) / 2
    return { topLeft, bottomRight, centerX }
  }, [bounds, canvasState])

  // Close panels when dragging starts
  useEffect(() => {
    if (isDragging) {
      setOpenPanel(null)
    }
  }, [isDragging])

  // Trigger entry animation
  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Reset placement and offset when selection changes
  useEffect(() => {
    const currentShapeIds = nonFreehandShapes.map(s => s.id).sort().join(',')
    const previousShapeIds = previousSelectedShapeIdsRef.current

    if (currentShapeIds !== previousShapeIds) {
      // We can reset to defaults here, but the layout effect will immediately correct it.
      // Resetting might cause a flicker if the new selection needs bottom placement.
      // However, keeping 'bottom' might be wrong for a new small shape at the top.
      // Let's reset to 'top' as a safe default for new selections.
      setPlacement('top')
      setXOffset(0)
      previousSelectedShapeIdsRef.current = currentShapeIds
    }
  }, [nonFreehandShapes])

  // Update fill/stroke styles based on current shape properties
  useEffect(() => {
    if (nonFreehandShapes.length > 0) {
      const shape = nonFreehandShapes[0]
      
      // Determine fill style from shape's actual fillStyle property
      if (['solid', 'hachure', 'cross-hatch', 'none'].includes(shape.appearance.fillStyle)) {
        setFillStyle(shape.appearance.fillStyle as FillStyle)
        setFillStyle(shape.appearance.fillStyle as FillStyle)
      } else {
        setFillStyle('solid')
      }

      // Determine fill draw style
      setFillDrawStyle(shape.appearance.fillDrawStyle || shape.appearance.drawStyle || 'standard')

      // Determine stroke style from shape's actual strokeStyle property
      if (shape.appearance.strokeStyle === 'none') {
        setStrokeStyle('none')
      } else if (shape.appearance.strokeStyle === 'dashed') {
        setStrokeStyle('dashed')
      } else if (shape.appearance.strokeStyle === 'dotted') {
        setStrokeStyle('dotted')
      } else {
        setStrokeStyle('solid')
      }

      // Determine stroke draw style
      setStrokeDrawStyle(shape.appearance.strokeDrawStyle || shape.appearance.drawStyle || 'standard')
    }
  }, [nonFreehandShapes])

  // Check for edge collision and flip/shift if needed
  React.useLayoutEffect(() => {
    if (isMobile) return // Skip positioning logic for mobile
    if (!menuRef.current || !containerRect || !screenBounds) return

    const menuRect = menuRef.current.getBoundingClientRect()
    const { width: menuWidth, height: menuHeight } = menuRect
    const { topLeft, centerX } = screenBounds

    const containerWidth = containerRect.width
    const MENU_PADDING = 16

    // UI element bounds to avoid
    // Sidebar: positioned at left-4 (16px) with width w-16 (64px) = 80px total, plus some extra padding
    const SIDEBAR_RIGHT_EDGE = 94
    // Top bar: positioned at top-4 (16px) with approximate height of ~56px = 72px total
    const TOP_BAR_BOTTOM_EDGE = 72

    let newPlacement: 'top' | 'bottom' = 'top'
    let newXOffset = 0

    // 1. Vertical Placement Logic
    // Calculate where the top of the menu WOULD be if placed at 'top'
    // Top placement anchor is topLeft.y - MENU_PADDING.
    // The menu is translated -100% Y, so its top is at anchorY - menuHeight.
    const topAnchorY = topLeft.y - MENU_PADDING
    const topOfMenuAtTop = topAnchorY - menuHeight

    // Check if it fits at the top (with padding from top bar)
    // topOfMenuAtTop is container-relative, so compare against TOP_BAR_BOTTOM_EDGE directly
    // (not adding containerTop which is viewport-relative)
    if (topOfMenuAtTop < TOP_BAR_BOTTOM_EDGE) {
    // Doesn't fit top (would overlap top bar), switch to bottom
      newPlacement = 'bottom'
    } else {
      // Fits top, prefer top
      newPlacement = 'top'
    }

    // 2. Horizontal Offset Logic
    // The menu's CSS `left` property is set to `anchorX` (which is screenBounds.centerX).
    // The `transform` property is `translate(calc(-50% + ${xOffset}px), ...)`.
    // This means the effective center of the menu is at `anchorX + xOffset`.
    // We want to calculate the `newXOffset` such that the menu stays within the container bounds.

    // Only apply horizontal offset if the shape is actually in view
    // Check if the shape's center is within the viewport
    const isShapeInView = centerX >= 0 && centerX <= containerWidth

    // Calculate the menu's left and right edges if `xOffset` were 0.
    const menuLeftAtZeroOffset = centerX - (menuWidth / 2)
    const menuRightAtZeroOffset = centerX + (menuWidth / 2)

    // Only adjust offset if shape is in view
    if (isShapeInView) {
      // Check left edge: menuLeftAtZeroOffset should be >= SIDEBAR_RIGHT_EDGE (to avoid sidebar)
      if (menuLeftAtZeroOffset < SIDEBAR_RIGHT_EDGE) {
        // We need to shift the menu right to avoid the sidebar
        newXOffset = SIDEBAR_RIGHT_EDGE - menuLeftAtZeroOffset
      }
      // Check right edge: menuRightAtZeroOffset should be <= containerWidth - MENU_PADDING
      else if (menuRightAtZeroOffset > containerWidth - MENU_PADDING) {
        // We need to shift the menu left. The required shift is `menuRightAtZeroOffset - (containerWidth - MENU_PADDING)`.
        // Since `xOffset` shifts the center, a negative `xOffset` shifts left.
        newXOffset = -1 * (menuRightAtZeroOffset - (containerWidth - MENU_PADDING))
      } else {
        newXOffset = 0
      }
    } else {
      // Shape is out of view, don't apply offset
      newXOffset = 0
    }

    if (newPlacement !== placement) {
      setPlacement(newPlacement)
    }

    // Only update offset if it changed significantly to avoid loops
    if (Math.abs(newXOffset - xOffset) > 1) {
      setXOffset(newXOffset)
    }

  }, [selectedShapes, canvasState, containerRect, placement, screenBounds])


  const handleFillColorChange = (color: string) => {
    setFillStyle('solid')
    onFillColorChange(color)
  }

  const handleFillStyleChange = (style: FillStyle) => {
    setFillStyle(style)
    onFillStyleChange(style)

    // Logic: when setting fill to hachure/cross-hatch, we used to auto-switch fillDrawStyle.
    // However, per new requirements, the rendering logic itself handles this based on the fillStyle check.
    // So we don't need to explicitly change the fillDrawStyle property here.
  }

  const handleStrokeStyleChange = (style: StrokeStyle) => {
    setStrokeStyle(style)
    onStrokeStyleChange(style)
  }

  // Debounced handlers for sliders
  const handleFillOpacityChangeDebounced = (opacity: number) => {
    // Update immediately without history
    onFillOpacityChange(opacity, true)
    
    // Clear existing timer
    if (fillOpacityDebounceRef.current) {
      clearTimeout(fillOpacityDebounceRef.current)
    }
    
    // Record history after user stops moving slider (500ms)
    fillOpacityDebounceRef.current = setTimeout(() => {
      onRecordHistory()
      fillOpacityDebounceRef.current = null
    }, 500)
  }

  const handleStrokeOpacityChangeDebounced = (opacity: number) => {
    // Update immediately without history
    onStrokeOpacityChange(opacity, true)
    
    // Clear existing timer
    if (strokeOpacityDebounceRef.current) {
      clearTimeout(strokeOpacityDebounceRef.current)
    }
    
    // Record history after user stops moving slider (500ms)
    strokeOpacityDebounceRef.current = setTimeout(() => {
      onRecordHistory()
      strokeOpacityDebounceRef.current = null
    }, 500)
  }

  const handleStrokeWidthChangeDebounced = (width: number) => {
    // Update immediately without history
    onStrokeWidthChange(width, true)
    
    // Clear existing timer
    if (strokeWidthDebounceRef.current) {
      clearTimeout(strokeWidthDebounceRef.current)
    }
    
    // Record history after user stops moving slider (500ms)
    strokeWidthDebounceRef.current = setTimeout(() => {
      onRecordHistory()
      strokeWidthDebounceRef.current = null
    }, 500)
  }

  // Freehand-specific debounced handlers
  const handleFreehandStrokeWidthChangeDebounced = (width: number) => {
    if (onFreehandStrokeWidthChange) {
      onFreehandStrokeWidthChange(width, true)
    }

    if (freehandStrokeWidthDebounceRef.current) {
      clearTimeout(freehandStrokeWidthDebounceRef.current)
    }

    freehandStrokeWidthDebounceRef.current = setTimeout(() => {
      onRecordHistory()
      freehandStrokeWidthDebounceRef.current = null
    }, 500)
  }

  const handleFreehandStrokeOpacityChangeDebounced = (opacity: number) => {
    if (onFreehandStrokeOpacityChange) {
      onFreehandStrokeOpacityChange(opacity, true)
    }

    if (freehandStrokeOpacityDebounceRef.current) {
      clearTimeout(freehandStrokeOpacityDebounceRef.current)
    }

    freehandStrokeOpacityDebounceRef.current = setTimeout(() => {
      onRecordHistory()
      freehandStrokeOpacityDebounceRef.current = null
    }, 500)
  }

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (fillOpacityDebounceRef.current) {
        clearTimeout(fillOpacityDebounceRef.current)
      }
      if (strokeOpacityDebounceRef.current) {
        clearTimeout(strokeOpacityDebounceRef.current)
      }
      if (strokeWidthDebounceRef.current) {
        clearTimeout(strokeWidthDebounceRef.current)
      }
      if (freehandStrokeOpacityDebounceRef.current) {
        clearTimeout(freehandStrokeOpacityDebounceRef.current)
      }
      if (freehandStrokeWidthDebounceRef.current) {
        clearTimeout(freehandStrokeWidthDebounceRef.current)
      }
    }
  }, [])

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel(prev => prev === panel ? null : panel)
  }

  const closeAllPanels = () => {
    setOpenPanel(null)
  }

  // Don't render if dragging, resizing, or no selection at all
  if (isDragging || isResizing || selectedShapes.length === 0) {
    return null
  }

  // For desktop, we need containerRect and screenBounds to position correctly
  if (!isMobile) {
    if (!containerRect || !screenBounds) return null
  }

  // Use memoized bounds (only needed for desktop positioning logic)
  // if (!screenBounds) return null (Removed this check for mobile)

  let layoutStyle: React.CSSProperties = {}
  let layoutClass = "absolute"

  if (!isMobile && screenBounds && containerRect) {
    const { topLeft, bottomRight, centerX } = screenBounds

    // Hide menu if shape is completely out of view horizontally or vertically
    const isOutOfViewHorizontally = bottomRight.x < 0 || topLeft.x > containerRect.width
    const isOutOfViewVertically = bottomRight.y < 0 || topLeft.y > containerRect.height

    if (isOutOfViewHorizontally || isOutOfViewVertically) {
      return null
    }

    // Calculate anchor position
    // Padding increased to 32px to avoid covering quick connector buttons
    const MENU_PADDING = 32
    let anchorX = centerX
    let anchorY = topLeft.y - MENU_PADDING

    // Adjust for placement
    if (placement === 'bottom') {
      anchorY = bottomRight.y + MENU_PADDING
    }

    // Clamp anchorX to viewport bounds to prevent menu from following shape off-screen
    // This keeps the menu visible even when the shape is panned out of view
    const minAnchorX = MENU_PADDING
    const maxAnchorX = containerRect.width - MENU_PADDING
    anchorX = Math.max(minAnchorX, Math.min(maxAnchorX, anchorX))

    layoutStyle = {
      left: `${anchorX}px`,
      top: `${anchorY}px`,
      transform: `translate(calc(-50% + ${xOffset}px), ${placement === 'top' ? '-100%' : '0%'})`,
    }
  } else if (isMobile) {
    layoutClass = "relative min-w-full w-full" // Static positioning for mobile
    layoutStyle = {}
  } else {
    return null // Fallback if regular mode but missing bounds
  }

  return (
    <div
      ref={menuRef}
      className={`${layoutClass} pointer-events-none z-40 transition-opacity duration-200`}
      style={{
        ...layoutStyle,
        opacity: isVisible ? 1 : 0,
      }}
      data-style-menu
    >
      <div className={`
        backdrop-blur-xl pointer-events-auto px-3 py-2 transition-all
        ${isMobile
          ? 'rounded-none border-b whitespace-nowrap min-w-full w-full'
          : 'rounded-2xl border shadow-xl'
        }
        ${theme === 'dark'
        ? 'bg-[#1A1A1F] border-gray-700'
        : 'bg-gray-50/90 border-gray-200'
        }
      `}>
        <div className={`flex items-center gap-2 ${theme === 'light' ? '[&_button]:text-gray-900 [&_svg]:text-gray-900 [&_.text-white]:!text-gray-900 [&_.text-gray-400]:!text-gray-600 [&_.text-gray-600]:!text-gray-900 [&_button:hover]:bg-gray-100 [&_.bg-gray-700]:!bg-gray-200 [&_.bg-gray-800]:!bg-gray-100' : ''
          }`}>
          {/* Freehand-specific menu - only when freehand shapes are selected */}
          {showFreehandMenu && !showRegularMenu ? (
            <>
              {/* Marker Type Selector */}
              {onFreehandMarkerTypeChange && (
                <FreehandMarkerTypeSelector
                  value={freehandMarkerType}
                  isOpen={openPanel === 'markerType'}
                  onToggle={() => togglePanel('markerType')}
                  onChange={onFreehandMarkerTypeChange}
                  onClose={closeAllPanels}
                  toolbarPlacement={panelPlacement}
                  canvasState={canvasState}
                  theme={theme}
                  isMobile={isMobile}
                />
              )}

              <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Stroke Style Selector for Freehand - no solid/dashed options, just color/width/opacity */}
              <StrokeStyleSelector
                strokeStyle="solid"
                strokeColor={freehandStrokeColor}
                strokeWidth={freehandStrokeWidth}
                strokeOpacity={freehandStrokeOpacity}
                strokeDrawStyle="standard"
                isOpen={openPanel === 'freehandStroke'}
                onToggle={() => togglePanel('freehandStroke')}
                onStyleChange={() => { }} // No style change for freehand
                onDrawStyleChange={() => { }}
                onColorChange={onFreehandStrokeColorChange || (() => { })}
                onWidthChange={handleFreehandStrokeWidthChangeDebounced}
                onOpacityChange={handleFreehandStrokeOpacityChangeDebounced}
                onClose={closeAllPanels}
                toolbarPlacement={panelPlacement}
                canvasState={canvasState}
                theme={theme}
                minWidth={1}
                maxWidth={24}
                hideStyleTabs={true}
                isMobile={isMobile}
              />
            </>
          ) : (
            /* Connector-specific menu - only show when NOT editing text */
            areAllConnectors && !isEditingText ? (
            <>
              {/* Stroke Color Selector - simplified for connectors */}
              <StrokeStyleSelector
                strokeStyle={strokeStyle}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                    strokeDrawStyle={strokeDrawStyle}
                isOpen={openPanel === 'stroke'}
                onToggle={() => togglePanel('stroke')}
                onStyleChange={handleStrokeStyleChange}
                    onDrawStyleChange={(style) => {
                      setStrokeDrawStyle(style)
                      // Explicit user action
                      onStrokeDrawStyleChange?.(style)
                    }}
                onColorChange={onStrokeColorChange}
                onWidthChange={handleStrokeWidthChangeDebounced}
                onOpacityChange={handleStrokeOpacityChangeDebounced}
                onClose={closeAllPanels}
                toolbarPlacement={panelPlacement}
                canvasState={canvasState}
                theme={theme}
                minWidth={2}
                maxWidth={6}
                    isMobile={isMobile}
              />

              <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Flow Animation Toggle */}
              {onToggleFlowAnimation && (
                <button
                  onClick={onToggleFlowAnimation}
                  className={`p-1.5 rounded-lg transition-colors ${isAnimated
                    ? 'bg-[#36C3AD]/20 text-[#36C3AD]'
                    : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  title="Toggle Flow Animation"
                >
                      <PlayCircle size={18} className={isAnimated ? 'text-[#36C3AD]' : ''} />
                </button>
              )}

              <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Start Arrowhead Selector */}
              {onStartArrowheadChange && (
                <ArrowheadSelector
                  value={startArrowheadType}
                  isOpen={openPanel === 'startArrowhead'}
                  onToggle={() => togglePanel('startArrowhead')}
                  onChange={onStartArrowheadChange}
                  onClose={closeAllPanels}
                  toolbarPlacement={panelPlacement}
                  canvasState={canvasState}
                  theme={theme}
                  label="Start"
                  direction={startDirection}
                      isMobile={isMobile}
                />
              )}

              <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Connector Type Selector */}
              {onConnectorTypeChange && (
                <ConnectorTypeSelector
                  value={connectorType}
                  isOpen={openPanel === 'connectorType'}
                  onToggle={() => togglePanel('connectorType')}
                  onChange={onConnectorTypeChange}
                  onClose={closeAllPanels}
                  toolbarPlacement={panelPlacement}
                  canvasState={canvasState}
                  theme={theme}
                      isMobile={isMobile}
                />
              )}

              <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* End Arrowhead Selector */}
              {onEndArrowheadChange && (
                <ArrowheadSelector
                  value={endArrowheadType}
                  isOpen={openPanel === 'endArrowhead'}
                  onToggle={() => togglePanel('endArrowhead')}
                  onChange={onEndArrowheadChange}
                  onClose={closeAllPanels}
                  toolbarPlacement={panelPlacement}
                  canvasState={canvasState}
                  theme={theme}
                  label="End"
                  direction={endDirection}
                      isMobile={isMobile}
                />
              )}
            </>
          ) : areAllConnectors && isEditingText ? (
                  /* Connector text editing menu - text options using reusable component */
                  <TextStyleControls
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    fontWeight={fontWeight as any}
                    fontStyle={fontStyle}
                    textDecoration={textDecoration as any}
                    textAlign={textAlign}
                    textJustify={textJustify}
                    textColor={textColor}
                    onFontFamilyChange={onFontFamilyChange}
                    onFontSizeChange={onFontSizeChange}
                    onFontWeightToggle={onFontWeightToggle}
                    onFontStyleToggle={onFontStyleToggle}
                    onTextDecorationChange={onTextDecorationChange}
                    onListChange={onListChange}
                    onTextAlignChange={onTextAlignChange}
                    onTextJustifyChange={onTextJustifyChange}
                    onTextColorChange={onTextColorChange}
                    onRecordHistory={onRecordHistory}
                    openPanel={openPanel}
                    togglePanel={(p) => togglePanel(p as OpenPanel)}
                    closeAllPanels={closeAllPanels}
                    theme={theme}
                    placement={panelPlacement}
                    canvasState={canvasState}
                    isEditingText={true}
                    hideAlignment={true}
                    isMobile={isMobile}
                  />
                ) : (
                  /* Regular shape menu */
                  <>
                    {isEditingText ? (
                      /* Text Editing Mode - ONLY show text controls inline */
                      <TextStyleControls
                        fontFamily={fontFamily}
                        fontSize={fontSize}
                        fontWeight={fontWeight as any}
                        fontStyle={fontStyle}
                          textDecoration={textDecoration as any}
                          textAlign={textAlign}
                          textJustify={textJustify}
                          textColor={textColor}
                          onFontFamilyChange={onFontFamilyChange}
                          onFontSizeChange={onFontSizeChange}
                          onFontWeightToggle={onFontWeightToggle}
                          onFontStyleToggle={onFontStyleToggle}
                          onTextDecorationChange={onTextDecorationChange}
                          onListChange={onListChange}
                          onTextAlignChange={onTextAlignChange}
                          onTextJustifyChange={onTextJustifyChange}
                          onTextColorChange={onTextColorChange}
                          onRecordHistory={onRecordHistory}
                          openPanel={openPanel}
                          togglePanel={(p) => togglePanel(p as OpenPanel)}
                          closeAllPanels={closeAllPanels}
                          theme={theme}
                          placement={panelPlacement}
                          canvasState={canvasState}
                          isEditingText={true}
                          isMobile={isMobile}
                        />
                      ) : (
                          /* Standard Selection Mode */
                          <>
                            {/* Shape Type Selector - show if at least one shape can be converted */}
                            {nonFreehandShapes.some(s => !['image', 'cloud', 'database', 'aws-ec2', 'gcp-compute', 'azure-vm', 'kubernetes', 'connector', 'freehand', 'frame'].includes(s.type)) && (
                              <>
                                <ShapeTypeSelector
                                  value={shapeType}
                                  isOpen={openPanel === 'shape'}
                                  onToggle={() => togglePanel('shape')}
                                  onChange={onShapeTypeChange}
                                  onClose={closeAllPanels}
                                  toolbarPlacement={panelPlacement}
                                  canvasState={canvasState}
                                  theme={theme}
                                  isMobile={isMobile}
                                />

                                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                              </>
                            )}

                            {/* Add/Remove Icon Button for Rectangles and Frames */}
                            {nonFreehandShapes.some(s => s.type === 'rectangle' || s.type === 'frame') && onToggleIcon && (
                              <>
                                <button
                                  onClick={onToggleIcon}
                                  className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}
                                  title={nonFreehandShapes.some(s => (s as any).iconContent || (s as any).hasIconPlaceholder) ? "Remove Icon" : "Add Icon"}
                                >
                                  {nonFreehandShapes.some(s => (s as any).iconContent || (s as any).hasIconPlaceholder) ? (
                                    /* Remove Icon (Square Minus) */
                                    <MinusSquare size={18} />
                                  ) : (
                                    /* Add Icon */
                                      <PlusSquare size={18} />
                                  )}
                                </button>
                                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                              </>
                            )}



                            {/* Fill Style Selector */}
                            <FillStyleSelector
                              fillStyle={fillStyle}
                              fillColor={fillColor}
                              fillOpacity={fillOpacity}
                              isOpen={openPanel === 'fill'}
                              onToggle={() => togglePanel('fill')}
                              onStyleChange={handleFillStyleChange}
                              onColorChange={handleFillColorChange}
                              onOpacityChange={handleFillOpacityChangeDebounced}
                              onClose={closeAllPanels}
                              toolbarPlacement={panelPlacement}
                              canvasState={canvasState}
                              theme={theme}
                              isMobile={isMobile}
                            />

                            <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                            <StrokeStyleSelector
                              strokeStyle={strokeStyle}
                              strokeColor={strokeColor}
                              strokeWidth={strokeWidth}
                              strokeOpacity={strokeOpacity}
                              strokeDrawStyle={strokeDrawStyle}
                              isOpen={openPanel === 'stroke'}
                              onToggle={() => togglePanel('stroke')}
                              onStyleChange={handleStrokeStyleChange}
                              onDrawStyleChange={(style) => {
                                setStrokeDrawStyle(style)
                                onStrokeDrawStyleChange?.(style)
                              }}
                              onColorChange={onStrokeColorChange}
                              onWidthChange={handleStrokeWidthChangeDebounced}
                              onOpacityChange={handleStrokeOpacityChangeDebounced}
                              onClose={closeAllPanels}
                              toolbarPlacement={panelPlacement}
                              canvasState={canvasState}
                              theme={theme}
                              isMobile={isMobile}
                            />

                            {/* Alignment Selector - only show when 2+ shapes selected */}
                            {selectedShapes.length >= 2 && onAlignLeft && onAlignCenter && onAlignRight && onAlignTop && onAlignMiddle && onAlignBottom && (
                              <>
                                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                                <AlignmentSelector
                                  isOpen={openPanel === 'alignment'}
                                  onToggle={() => togglePanel('alignment')}
                                  onAlignLeft={onAlignLeft}
                                  onAlignCenter={onAlignCenter}
                                  onAlignRight={onAlignRight}
                                  onAlignTop={onAlignTop}
                                  onAlignMiddle={onAlignMiddle}
                                  onAlignBottom={onAlignBottom}
                                  onClose={closeAllPanels}
                                  toolbarPlacement={panelPlacement}
                                  canvasState={canvasState}
                                  theme={theme}
                                  isMobile={isMobile}
                                />
                              </>
                            )}

                            {/* Frame Rename Button - only show when all shapes are frames */}
                            {areAllFrames && onFrameRename && (
                              <>
                                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                                <button
                                  onClick={onFrameRename}
                                  className={`p-1.5 rounded-lg transition-colors hover:bg-gray-100 text-gray-700`}
                                  title={framesHaveLabels ? "Rename section ⌘R" : "Add title ⌘R"}
                                >
                                  {framesHaveLabels ? (
                                    /* Rename/Edit icon */
                                    <Edit2 size={18} />
                                  ) : (
                                      /* Text/Add title icon */
                                      <Type size={18} />
                                  )}
                                </button>
                              </>
                            )}

                            {/* Text Style Flyout (Button) - ONLY show if has text potential */}
                            {hasText && (
                              <>
                                <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                                <TextStyleFlyout
                                  isOpen={openPanel === 'textStyle'}
                                  onToggle={() => togglePanel('textStyle')}
                                  onClose={closeAllPanels}
                                  toolbarPlacement={panelPlacement}
                                  fontFamily={fontFamily}
                                  fontSize={fontSize}
                                  fontWeight={fontWeight as any}
                                  fontStyle={fontStyle}
                                  textDecoration={textDecoration as any}
                                  textAlign={textAlign}
                                  textJustify={textJustify}
                                  textColor={textColor}
                                  onFontFamilyChange={onFontFamilyChange}
                                  onFontSizeChange={onFontSizeChange}
                                  onFontWeightToggle={onFontWeightToggle}
                                  onFontStyleToggle={onFontStyleToggle}
                                  onTextDecorationChange={onTextDecorationChange}
                                  onListChange={onListChange}
                                  onTextAlignChange={onTextAlignChange}
                                  onTextJustifyChange={onTextJustifyChange}
                                  onTextColorChange={onTextColorChange}
                                  onRecordHistory={onRecordHistory}
                                  theme={theme}
                                  canvasState={canvasState}
                                  isEditingText={false}
                                  isMobile={isMobile}
                                />
                              </>
                            )}
                  </>
                )}
              </>
            ))}
        </div>

      </div>
    </div>
  )
}

