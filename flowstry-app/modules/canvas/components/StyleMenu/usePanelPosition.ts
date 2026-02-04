'use client'
import { RefObject, useLayoutEffect, useState } from 'react';

// UI element bounds to avoid (matching StyleMenu.tsx constants)
const SIDEBAR_RIGHT_EDGE = 94
const CONTAINER_PADDING = 16
const TOP_BAR_BOTTOM_EDGE = 72

/**
 * Hook to calculate panel position, avoiding UI elements like the sidebar
 * @param isOpen - Whether the panel is currently open
 * @param containerRef - Ref to the button container element
 * @param panelRef - Ref to the panel element
 * @param toolbarPlacement - Whether the parent toolbar is at 'top' or 'bottom'
 * @returns { placement, xOffset } - Vertical placement and horizontal offset
 */
export function usePanelPosition(
  isOpen: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
  toolbarPlacement: 'top' | 'bottom',
  strategy: 'absolute' | 'fixed' = 'absolute'
): {
  placement: 'top' | 'bottom';
  xOffset: number;
  maxHeight?: number;
  style?: React.CSSProperties;
} {
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')
  const [xOffset, setXOffset] = useState(0)
  const [style, setStyle] = useState<React.CSSProperties>({})

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current || !panelRef.current) {
      setXOffset(0)
      setStyle({})
      return
    }

    const buttonRect = containerRef.current.getBoundingClientRect()
    const panelRect = panelRef.current.getBoundingClientRect()
    // Use actual dimensions if available, otherwise fallback
    const panelHeight = panelRect.height || 300
    const panelWidth = panelRect.width || 340

    // Default to provided placement, but check bounds
    let newPlacement = toolbarPlacement

    // 1. Vertical Placement Logic
    if (toolbarPlacement === 'top') {
      // Panel opens above
      const panelTopIfAbove = buttonRect.top - panelHeight - 12
      // If overlaps top bar
      if (panelTopIfAbove < TOP_BAR_BOTTOM_EDGE) {
        newPlacement = 'bottom'
      } else {
        newPlacement = 'top'
      }
    } else {
      // Toolbar is below shape, panel should open below
      const spaceBelow = window.innerHeight - buttonRect.bottom
      // If not enough space below
      if (spaceBelow < panelHeight + 12) {
        newPlacement = 'top'
      } else {
        newPlacement = 'bottom'
      }
    }

    // 2. Horizontal Offset Logic
    const buttonCenterX = buttonRect.left + buttonRect.width / 2
    const panelLeftEdge = buttonCenterX - panelWidth / 2
    const panelRightEdge = buttonCenterX + panelWidth / 2
    
    let newXOffset = 0

    // Check left edge
    if (panelLeftEdge < SIDEBAR_RIGHT_EDGE) {
      newXOffset = SIDEBAR_RIGHT_EDGE - panelLeftEdge
    }
      // Check right edge
    else if (panelRightEdge > window.innerWidth - CONTAINER_PADDING) {
      newXOffset = -(panelRightEdge - (window.innerWidth - CONTAINER_PADDING))
    }

    // Apply state updates
    setPlacement(newPlacement)

    if (Math.abs(newXOffset - xOffset) > 1) {
      setXOffset(newXOffset)
    }

    // 3. Compute Fixed Style (if strategy is fixed)
    if (strategy === 'fixed') {
      const width = window.innerWidth
      const left = 0
      let top = 0
      let originY = 'bottom'

      // On mobile, usually we want to respect the placement (top vs bottom) relative to the toolbar
      // If placement is top (opening upwards from a bottom toolbar)
      if (newPlacement === 'top') {
        top = buttonRect.top - panelHeight - 8
        originY = 'bottom'

        // Prevent going off top of screen
        // Assume top bar is ~60px
        const SAFE_TOP = 60
        if (top < SAFE_TOP) {
          top = SAFE_TOP
        }
      } else {
        top = buttonRect.bottom + 8
        originY = 'top'
      }

      setStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        maxWidth: `${width}px`,
        zIndex: 9999, // Ensure it's on top of everything
        transformOrigin: `center ${originY}`,
        // Add constrain for height to fit in viewport
        maxHeight: `calc(100dvh - ${Math.max(top, 0) + 16}px)`,
        overflowY: 'auto'
      })
    } else {
      setStyle({})
    }

  }, [isOpen, containerRef, panelRef, toolbarPlacement, xOffset, strategy])

  return { placement, xOffset, style }
}
