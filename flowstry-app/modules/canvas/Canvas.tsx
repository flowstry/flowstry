 
'use client'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { type ContextMenuOption } from './components/ContextMenu'
import { ExportImageModal } from './components/ExportImageModal'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
// import { FileMenu, type FileMenuOption } from './components/FileMenu'
// import { FreehandStyleMenu } from './components/FreehandStyleMenu'
// import { SettingsModal } from './components/SettingsModal'
import { type MenuCategory } from './components/MainMenu'
import { type PropertiesCardData } from './components/PropertiesCard'
import { GRID_DOT_OPACITY, GRID_DOT_RADIUS, GRID_SPACING, WORKSPACE_SIZE } from './consts/canvas'
import { InteractionEngine, type CanvasState } from './core'
import { type CanvasSettings } from './core/SettingsManager'
import { GenericImageShape } from './shapes'
import { ShapeName } from './shapes/base'
import { ConnectorType } from './shapes/connectors'
import { FreehandMarkerType } from './shapes/freehand'
import { LaserPointerTool, LaserStroke, LaserStrokeEvent } from './tools/LaserPointerTool'
// import { FreehandShape } from './shapes/freehand/FreehandShape'
import { DesktopCanvasLayout } from './components/DesktopCanvasLayout'
import { LoadingOverlay } from './components/LoadingOverlay'
import { MobileCanvasLayout } from './components/MobileCanvasLayout'
import { RemoteCursors } from './components/RemoteCursors'
import { RemoteSelections } from './components/RemoteSelections'
import { applyPaletteToAppearance, COLOR_PALETTES, ColorPalette } from './consts/colorPalettes'
import type { CollaborationPlugin } from './plugins/collaboration'
import type { LaserPointerPayload, UserPresence } from './types/collaboration'
import { injectCanvasStyles } from './utils/injectStyles'


export interface CanvasProps {
  engine?: InteractionEngine;

  // Injectable header components
  renderBreadcrumb?: (props: { theme: "light" | "dark" }) => React.ReactNode;
  renderUserMenu?: (props: { theme: "light" | "dark" }) => React.ReactNode;

  // Injectable menu items
  topMenuItems?: { label: string; onClick: () => void; disabled?: boolean }[];
  bottomMenuItems?: { label: string; onClick: () => void; disabled?: boolean }[];

  // Loading & Access Control
  isLoading?: boolean;
  isReadOnly?: boolean;

  // Collaboration Plugin (managed by workspace layer)
  collaborationPlugin?: CollaborationPlugin;
  remoteUsers?: UserPresence[];
}

const Canvas: React.FC<CanvasProps> = ({
  engine: externalEngine,
  renderBreadcrumb,
  renderUserMenu,
  topMenuItems = [],
  bottomMenuItems = [],
  isLoading = false,
  isReadOnly: propReadOnly = false,
  collaborationPlugin,
  remoteUsers = [],
}) => {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const contentLayerRef = useRef<SVGGElement | null>(null)
  const rawId = useId()
  const baseId = useMemo(() => rawId.replace(/:/g, '-'), [rawId])

  // Create InteractionEngine instance if not provided
  const internalEngineRef = useRef<InteractionEngine | null>(null)

  // Use external engine if provided, otherwise use/create internal one
  const engine = useMemo(() => {
    if (externalEngine) return externalEngine

    if (!internalEngineRef.current) {
      internalEngineRef.current = new InteractionEngine()
    }
    return internalEngineRef.current
  }, [externalEngine])

  // Canvas state managed by InteractionEngine
  const [canvasState, setCanvasState] = useState<CanvasState>({ scale: 1, translation: { x: 0, y: 0 } })
  const [cursorStyle, setCursorStyle] = useState<string>('default')
  const [activeTool, setActiveTool] = useState<string | null>('Select')
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeName>('rectangle')
  const [selectedConnectorType, setSelectedConnectorType] = useState<ConnectorType>('curved')
  const [selectedMarkerType, setSelectedMarkerType] = useState<FreehandMarkerType>('pen')
  const [shapesVersion, setShapesVersion] = useState(0)
  const [localViewerMode, setLocalViewerMode] = useState(false)

  // Effective read-only state: either enforced by prop (Viewer role) or toggled locally (Editor preview)
  const isReadOnly = propReadOnly || localViewerMode

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState(false)
  const [isPropertiesCardOpen, setIsPropertiesCardOpen] = useState(false)
  const [propertiesData, setPropertiesData] = useState<PropertiesCardData | null>(null)
  const [isContentVisible, setIsContentVisible] = useState(true)
  // Get initial settings from engine (which loads them synchronously in constructor)
  // This ensures both engine and component start with the same loaded settings
  const initialSettings = useMemo(() => {
    return engine.getSettingsManager().getSettings();
  }, [engine])

  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(initialSettings)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const lastCursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [laserStrokes, setLaserStrokes] = useState<LaserStroke[]>([])
  const [remoteLaserStrokes, setRemoteLaserStrokes] = useState<LaserStroke[]>([])
  const remoteLaserStrokesRef = useRef<LaserStroke[]>([])
  const animationFrameRef = useRef<number | null>(null)

  // Track currently pressed arrow keys for diagonal movement
  const pressedArrowKeysRef = useRef<Set<string>>(new Set())
  const [filename, setFilename] = useState('Untitled')

  // Delayed loading state to prevent flash
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isLoading) {
      // Only show overlay if loading takes more than 200ms
      timer = setTimeout(() => {
        setShowLoadingOverlay(true)
      }, 200)
    } else {
      setShowLoadingOverlay(false)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isLoading])

  // Library Panel State
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeIconTargetShapeId, setActiveIconTargetShapeId] = useState<string | null>(null)

  // Color Palette State
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false)

  const handleTogglePalette = useCallback(() => {
    setIsColorPaletteOpen(prev => !prev)
  }, [])

  // Calculate active palette ID based on default settings
  const activePaletteId = useMemo(() => {
    const current = canvasSettings.defaultShapeAppearance;
    if (!current) return undefined;
    return COLOR_PALETTES.find(p =>
      p.colors.fill === current.fill &&
      p.colors.stroke === current.stroke &&
      p.colors.textColor === current.textColor
    )?.id;
  }, [canvasSettings.defaultShapeAppearance]);

  // Listen for open-library event
  useEffect(() => {
    const handleOpenLibrary = (e: CustomEvent) => {
      const { shapeId, section } = e.detail
      setActiveIconTargetShapeId(shapeId)
      // Open panel by setting active section
      if (section) {
        setActiveSection(section)
      } else {
        // Default to Frameworks if no section specified
        setActiveSection('Frameworks')
      }
    }

    window.addEventListener('open-library', handleOpenLibrary as any)
    return () => {
      window.removeEventListener('open-library', handleOpenLibrary as any)
    }
  }, [])

  // Calculate properties data when card is open
  useEffect(() => {
    if (isPropertiesCardOpen) {
      const updateProperties = async () => {
        try {
          const shapes = engine.getDiagramManager().getShapes()

          // Calculate scene bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          if (shapes.length > 0) {
            shapes.forEach(s => {
              minX = Math.min(minX, s.layout.x)
              minY = Math.min(minY, s.layout.y)
              maxX = Math.max(maxX, s.layout.x + s.layout.width)
              maxY = Math.max(maxY, s.layout.y + s.layout.height)
            })
          } else {
            minX = minY = maxX = maxY = 0
          }

          // Calculate storage usage (approximate by serializing)
          let storageSize = '0B'
          try {
            // We use the storage manager to get the serialized size
            const diagramData = (engine.getStorageManager() as any).serializeDiagram()
            const jsonString = JSON.stringify(diagramData)
            const bytes = new TextEncoder().encode(jsonString).length
            // Format bytes
            const formatBytes = (b: number) => {
              if (b === 0) return '0 B'
              const k = 1024
              const sizes = ['B', 'KB', 'MB', 'GB']
              const i = Math.floor(Math.log(b) / Math.log(k))
              return parseFloat((b / Math.pow(k, i)).toFixed(1)) + '' + sizes[i]
            }
            storageSize = formatBytes(bytes)
          } catch (e) {
            console.warn('Failed to calculate storage size', e)
          }

          setPropertiesData({
            version: '0.1.1', // Hardcoded from package.json for now as we can't import json
            buildDate: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5), // Current time placeholder
            commit: 'c158187', // Placeholder/example commit
            storage: {
              scene: storageSize,
              total: storageSize // In local storage, scene usually equals total for that file
            },
            scene: {
              shapes: shapes.length,
              width: Math.round(maxX - minX),
              height: Math.round(maxY - minY)
            }
          })
        } catch (error) {
          console.error('Failed to update properties', error)
        }
      }

      updateProperties()

      // Update every second while open? Or just on open? 
      // Let's update on shapesVersion change if open
    }
  }, [isPropertiesCardOpen, shapesVersion, engine])

  // ReactShape placement mode - shows a preview that follows cursor
  const [reactShapePlacementType, setReactShapePlacementType] = useState<'service-card' | 'todo-card' | null>(null)
  const [reactShapePreviewPos, setReactShapePreviewPos] = useState<{ x: number; y: number } | null>(null)

  // Inject canvas styles on mount
  useEffect(() => {
    injectCanvasStyles()
  }, [])

  // Track container rect for style menu positioning
  useEffect(() => {
    const updateContainerRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect())
      }
    }

    updateContainerRect()
    window.addEventListener('resize', updateContainerRect)
    
    return () => {
      window.removeEventListener('resize', updateContainerRect)
    }
  }, [])

  // Initialize engine with refs
  useEffect(() => {
    engine.initialize(
      containerRef, 
      svgRef, 
      contentLayerRef,
      setCanvasState, 
      setCursorStyle,
      () => setShapesVersion(v => v + 1),
      (toolName: string) => setActiveTool(toolName),
      (dragging: boolean) => setIsDragging(dragging),
      (resizing: boolean) => setIsResizing(resizing)
    )
    // Sync initial tool state
    const tool = engine.getActiveTool()
    setActiveTool(tool?.name || null)
    
    // Subscribe to settings changes
    engine.setOnSettingsChange((newSettings) => {
      setCanvasSettings(newSettings)
    })

    // Settings are already initialized from engine in useMemo above,
    // so no need to manually sync here (would cause unnecessary re-render)

    // Try to load saved diagram, otherwise record initial empty state
    const initializeCanvas = async () => {
      const hasSaved = await engine.hasSavedDiagram()
      if (hasSaved) {
        const result = await engine.loadDiagram()
        if (result.success && result.name) {
          // Strip .flowstry extension if present
          const name = result.name.replace(/\.flowstry$/, '')
          setFilename(name)
        } else {
          // Fallback to metadata if name not in top-level
          const metadata = await engine.getStorageManager().getMetadata()
          if (metadata && metadata.filename) {
            const name = metadata.filename.replace(/\.flowstry$/, '')
            setFilename(name)
          }
        }
      } else {
        engine.recordInitialState()
      }
    }
    
    initializeCanvas()

    return () => {
      // Only destroy if we created it (internal engine)
      if (!externalEngine) {
        engine.destroy()
      }
    }
  }, [engine, externalEngine])

  // Sync ReadOnly state with Engine
  useEffect(() => {
    engine.setReadOnly(isReadOnly)
  }, [engine, isReadOnly])

  // Add document-level Escape handler to ensure it works even when container doesn't have focus
  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+Shift+? to open keyboard shortcuts modal (works regardless of focus)
      if (e.ctrlKey && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        // Skip if typing in an input
        const target = e.target as HTMLElement
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isTyping) {
          e.preventDefault()
          e.stopPropagation()
          setIsKeyboardShortcutsModalOpen(true)
          return
        }
      }

      // Only handle Escape key for the rest
      if (e.key !== 'Escape') return
      
      // Skip if user is typing in a regular INPUT or TEXTAREA (not contentEditable from canvas)
      const target = e.target as HTMLElement
      const isRegularInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (isRegularInput) return
      
      // Skip if a modal is open - check by looking for the backdrop or modal element
      const backdrop = document.querySelector('[data-ui-control]')
      if (backdrop && backdrop !== containerRef.current) {
        // A modal is likely open, let it handle Escape
        return
      }
      
      // Prevent default and stop propagation
      e.preventDefault()
      e.stopPropagation()

      // First, let the engine handle Escape (which delegates to active tool for canceling operations)
      engine.handleKeyDown(e)

      // Always switch to Select tool after handling Escape
      engine.activateTool('Select')
      setActiveTool('Select')

      // Deselect all shapes
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length > 0) {
        engine.getDiagramManager().deselectAllShapes()
        engine.getDiagramManager().hideSelectionOverlay()
        // Force re-render to update UI (hide style menu)
        setShapesVersion(v => v + 1)
      }
      
      // Ensure container has focus for future keyboard events
      if (containerRef.current) {
        containerRef.current.focus()
      }
    }

    // Use capture phase to catch Escape before other handlers
    document.addEventListener('keydown', handleDocumentKeyDown, true)
    
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true)
    }
     
  }, [engine]) // setActiveTool and setShapesVersion are stable state setters, don't need to be in deps

  const applyRemoteLaserEvent = useCallback((userId: string, payload: LaserPointerPayload) => {
    const combinedId = `${userId}:${payload.strokeId}`
    const strokes = remoteLaserStrokesRef.current
    let stroke = strokes.find(s => s.id === combinedId)

    if (!stroke || payload.phase === 'start') {
      stroke = { id: combinedId, points: [payload.point] }
      strokes.push(stroke)
    } else {
      const lastPoint = stroke.points[stroke.points.length - 1]
      const dx = payload.point.x - lastPoint.x
      const dy = payload.point.y - lastPoint.y
      if (dx * dx + dy * dy >= 1) {
        stroke.points.push(payload.point)
      }
    }

    setRemoteLaserStrokes([...strokes])
  }, [])

  const cleanupRemoteLaserStrokes = useCallback(() => {
    const now = Date.now()
    const fadeDuration = LaserPointerTool.FADE_DURATION_MS
    const stagger = LaserPointerTool.STAGGER_MS
    let changed = false

    for (const stroke of remoteLaserStrokesRef.current) {
      if (stroke.points.length === 0) continue
      const firstTimestamp = stroke.points[0].timestamp
      const beforeCount = stroke.points.length
      stroke.points = stroke.points.filter((_, index) => {
        const fadeStartTime = firstTimestamp + (index * stagger)
        const timeSinceFadeStart = now - fadeStartTime
        return timeSinceFadeStart < fadeDuration
      })
      if (stroke.points.length !== beforeCount) {
        changed = true
      }
    }

    const beforeStrokeCount = remoteLaserStrokesRef.current.length
    remoteLaserStrokesRef.current = remoteLaserStrokesRef.current.filter(stroke => stroke.points.length > 0)
    if (remoteLaserStrokesRef.current.length !== beforeStrokeCount) {
      changed = true
    }

    if (changed) {
      setRemoteLaserStrokes([...remoteLaserStrokesRef.current])
    }
  }, [])

  // Laser pointer animation loop - handles stroke updates and fade-out
  useEffect(() => {
    const laserTool = engine.getLaserPointerTool()

    // Set up callback to receive stroke updates from the tool
    laserTool.setCallbacks(
      () => containerRef.current,
      () => ({ scale: canvasState.scale, translation: canvasState.translation }),
      (strokes) => setLaserStrokes(strokes),
      (event: LaserStrokeEvent) => {
        if (!collaborationPlugin) return
        collaborationPlugin.sendLaserPointer({
          strokeId: event.strokeId,
          phase: event.phase,
          point: event.point
        })
      }
    )

    // Animation loop for cleaning up old strokes
    const animate = () => {
      laserTool.cleanupOldStrokes()
      cleanupRemoteLaserStrokes()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [engine, canvasState.scale, canvasState.translation, collaborationPlugin, cleanupRemoteLaserStrokes])

  useEffect(() => {
    if (!collaborationPlugin) return
    collaborationPlugin.onLaserPointer((event) => {
      applyRemoteLaserEvent(event.userId, event.payload)
    })
    return () => {
      collaborationPlugin.onLaserPointer(null)
    }
  }, [collaborationPlugin, applyRemoteLaserEvent])

  // Update auto-save to include filename
  useEffect(() => {
    const storageManager = engine.getStorageManager()
    // Always keep StorageManager's filename in sync with React state
    storageManager.setFilename(filename !== 'Untitled' ? filename : undefined)
    // We need to patch the save method or ensure metadata is passed during auto-save
    // Since StorageManager handles auto-save internally, we might need to update how it gets metadata
    // For now, let's manually save when filename changes to ensure it's persisted
    if (filename !== 'Untitled') {
      storageManager.save({ metadata: { filename } })
    }
  }, [engine, filename])

  // Listen for text input events to record history (debounced)
  useEffect(() => {
    const handleInput = (e: Event) => {
      // Only record if the target is contenteditable (which our text elements are)
      if (e.target instanceof HTMLElement && e.target.isContentEditable) {
        engine.recordHistory(true); // Pass true for debounce
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('input', handleInput);
    }

    return () => {
      if (container) {
        container.removeEventListener('input', handleInput);
      }
    };
  }, [engine]);

  // Render text for all shapes whenever shapes change
  useEffect(() => {
    engine.getDiagramManager().renderAllText()
  }, [engine, shapesVersion, canvasState])

  // Broadcast selection changes to collaborators
  useEffect(() => {
    if (!collaborationPlugin) return;

    const selectedShapes = engine.getDiagramManager().getSelectedShapes();
    const selectedIds = selectedShapes.map(shape => shape.id);

    collaborationPlugin.updateSelection(selectedIds);
  }, [collaborationPlugin, engine, shapesVersion])

  // Update locked shapes in engine when remote users change
  useEffect(() => {
    // Collect all selected shape IDs from all remote users
    const lockedIds: string[] = [];
    if (remoteUsers) {
      remoteUsers.forEach(user => {
        if (user.selection?.shapeIds) {
          user.selection.shapeIds.forEach(id => lockedIds.push(id));
        }
      });
    }

    // Update engine
    engine.setLockedShapeIds(lockedIds);
  }, [engine, remoteUsers]);


  // Check if content is in view - removed unused effect

  const handleSelectAll = useCallback(() => {
    const allShapes = engine.getDiagramManager().getShapes()
    allShapes.forEach(shape => {
      engine.getDiagramManager().selectShape(shape)
    })
    engine.getDiagramManager().updateSelectionOverlay()
    setShapesVersion(v => v + 1)
  }, [engine])

  const handleApplyPalette = useCallback((palette: ColorPalette) => {
    if (!engine || !engine.getDiagramManager()) return

    const selectedShapes = engine.getDiagramManager().getSelectedShapes()

    // ALWAYS update the default shape appearance (current color schema)
    engine.getSettingsManager().setDefaultShapeAppearance({
      fill: palette.colors.fill,
      stroke: palette.colors.stroke,
      textColor: palette.colors.textColor,
      strokeWidth: 2,
    })

    // If shapes are selected, apply palette to them
    if (selectedShapes.length > 0) {
      // Apply to all selected shapes
      selectedShapes.forEach((shape: any) => {
        applyPaletteToAppearance(shape.appearance, palette)
        shape.state.needsRender = true
      })

      // Notify modifications and record history
      engine.getDiagramManager().notifyShapeModified()
      engine.recordHistory()

      // Force update of React components
      setShapesVersion(v => v + 1)
    }
  }, [engine])

  const handleSetDefaultPalette = useCallback((palette: ColorPalette) => {
    const appearance = {
      fill: palette.colors.fill,
      stroke: palette.colors.stroke,
      textColor: palette.colors.textColor
    }
    engine.getSettingsManager().setDefaultShapeAppearance(appearance)
  }, [engine])

  const handleZoomIn = useCallback(() => {
    engine.zoomIn()
  }, [engine])

  const handleZoomOut = useCallback(() => {
    engine.zoomOut()
  }, [engine])

  const handleSaveToFile = useCallback(async () => {
    const storageManager = engine.getStorageManager()
    // Ensure filename has extension
    const nameToSave = filename.endsWith('.flowstry') ? filename : `${filename}.flowstry`
    await storageManager.saveWith('file', { metadata: { filename: nameToSave } })
  }, [engine, filename])

  const handleOpenFile = useCallback(async () => {
    const storageManager = engine.getStorageManager()
    const result = await storageManager.loadFrom('file')

    if (result.success) {
      if (result.name) {
        // Strip .flowstry extension if present
        const name = result.name.replace(/\.flowstry$/, '')
        setFilename(name)
      } else {
        const metadata = await storageManager.getMetadata()
        if (metadata && metadata.filename) {
          // Strip extension for display
          const name = metadata.filename.replace(/\.flowstry$/, '')
          setFilename(name)
        }
      }
      
      // Scroll to content after shapes are loaded
      // Use requestAnimationFrame to ensure DOM is ready before scrolling
      requestAnimationFrame(() => {
        engine.scrollToContent()
      })
    }
  }, [engine])

  const handleCopyAsPNG = useCallback(async () => {
    const exportManager = engine.getImageExportManager()
    if (!exportManager) {
      console.error('Export manager not initialized')
      return
    }

    const hasSelection = engine.getDiagramManager().getSelectedShapes().length > 0

    await exportManager.export({
      onlySelected: hasSelection,
      withBackground: true,
      scale: 2,
      filename: 'clipboard'
    }, 'clipboard')
  }, [engine])

  const handleCopyAsSVG = useCallback(async () => {
    const exportManager = engine.getImageExportManager()
    if (!exportManager) {
      console.error('Export manager not initialized')
      return
    }

    const hasSelection = engine.getDiagramManager().getSelectedShapes().length > 0

    // For SVG, we can copy the SVG text to clipboard
    const svg = exportManager.generatePreview({
      onlySelected: hasSelection,
      withBackground: true,
      scale: 1
    })

    if (svg) {
      const svgString = new XMLSerializer().serializeToString(svg)
      await navigator.clipboard.writeText(svgString)
    }
  }, [engine])

  const handlePasteToReplace = useCallback(async (_useCursorPosition = false) => {
    const diagramManager = engine.getDiagramManager()
    const selectedShapes = diagramManager.getSelectedShapes()
    
    if (selectedShapes.length === 0) {
      return
    }

    // Calculate the center point of selected shapes to paste at that location
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    
    selectedShapes.forEach(shape => {
      minX = Math.min(minX, shape.layout.x)
      minY = Math.min(minY, shape.layout.y)
      maxX = Math.max(maxX, shape.layout.x + shape.layout.width)
      maxY = Math.max(maxY, shape.layout.y + shape.layout.height)
    })
    
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    // Delete all selected shapes
    engine.deleteSelectedShapes()
    
    // Paste at the center of where the deleted shapes were
    await engine.paste(centerX, centerY)
  }, [engine])

  // Handle keyboard events (scoped to component)
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Check if user is typing in an input/textarea
    const target = e.target as HTMLElement
    const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    // Command/Ctrl + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && !isTyping) {
      e.preventDefault()
      await engine.saveDiagram()
      return
    }

    // Command/Ctrl + O to open file
    if ((e.metaKey || e.ctrlKey) && e.key === 'o' && !isTyping) {
      e.preventDefault()
      await handleOpenFile()
      return
    }

    // Command/Ctrl + Shift + E to export image
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'e' && !isTyping) {
      e.preventDefault()
      setIsExportModalOpen(true)
      return
    }

    // Control + Shift + ? (Ctrl+Shift+/) to open keyboard shortcuts modal
    // On some keyboards, Shift+/ produces ?, on others we need to check for / with shift
    if (e.ctrlKey && (e.key === '?' || (e.shiftKey && e.key === '/')) && !isTyping) {
      e.preventDefault()
      setIsKeyboardShortcutsModalOpen(true)
      return
    }



    // Command/Ctrl + A to select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isTyping) {
      e.preventDefault()
      handleSelectAll()
      return
    }

    // Command/Ctrl + Shift + C to copy as PNG (check this first to avoid conflict with regular copy)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C') && !isTyping) {
      e.preventDefault()
      const allShapes = engine.getDiagramManager().getShapes()
      if (allShapes.length > 0) {
        await handleCopyAsPNG()
      }
      return
    }

    // Command/Ctrl + C to copy
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey && !isTyping) {
      e.preventDefault()
      await engine.copy()
      return
    }

    // Command/Ctrl + X to cut
    if ((e.metaKey || e.ctrlKey) && e.key === 'x' && !isTyping) {
      e.preventDefault()
      await engine.cut()
      return
    }

    // Command/Ctrl + V to paste
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !isTyping) {
      e.preventDefault()
      await engine.paste()
      return
    }

    // Command/Ctrl + Shift + G to ungroup (check before ⌘G to avoid conflict)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'g' || e.key === 'G') && !isTyping) {
      e.preventDefault()
      engine.getDiagramManager().ungroupSelectedShapes()
      setShapesVersion(v => v + 1)
      engine.recordHistory()
      return
    }

    // Command/Ctrl + G to group
    if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey && !isTyping) {
      e.preventDefault()
      engine.getDiagramManager().groupSelectedShapes()
      setShapesVersion(v => v + 1)
      engine.recordHistory()
      return
    }

    // Command/Ctrl + R to rename frame label (without shift)
    if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      const frameShape = selectedShapes.find(s => s.type === 'frame')
      if (frameShape) {
        e.preventDefault()
        const frame = frameShape as any
        if (frame.startLabelEditing) {
          frame.startLabelEditing(() => {
            engine.recordHistory()
            setShapesVersion(v => v + 1)
          })
        }
        return
      }
      // If not a frame, let the browser handle ⌘R (refresh)
    }

    // Shift + Command/Ctrl + R to paste to replace
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r' && !isTyping) {
      e.preventDefault()
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      const hasClipboard = engine.hasClipboardData()
      if (selectedShapes.length > 0 && hasClipboard) {
        await handlePasteToReplace(false)
      }
      return
    }

    // Command/Ctrl + I to toggle icon (frames/rectangles)
    if ((e.metaKey || e.ctrlKey) && e.key === 'i' && !e.shiftKey && !isTyping) {
      e.preventDefault()
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      let changed = false
      selectedShapes.forEach(s => {
        if (s.type === 'rectangle' || s.type === 'frame') {
          const shape = s as any
          if (shape.iconContent || shape.hasIconPlaceholder) {
            shape.iconContent = null
            shape.hasIconPlaceholder = false
            s.state.needsRender = true
            changed = true
          } else {
            shape.hasIconPlaceholder = true
            s.state.needsRender = true
            changed = true
          }
        }
      })
      if (changed) {
        engine.recordHistory()
        setShapesVersion(v => v + 1)
      }
      return
    }

    // Command/Ctrl + Z to undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !isTyping) {
      e.preventDefault()
      engine.undo()
      return
    }

    // Command/Ctrl + Shift + Z or Command/Ctrl + Y to redo
    if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') ||
      ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
      if (!isTyping) {
        e.preventDefault()
        engine.redo()
        return
      }
    }

    // Command/Ctrl + Plus/Equals to zoom in
    if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault()
      handleZoomIn()
      return
    }

    // Command/Ctrl + Minus to zoom out
    if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault()
      handleZoomOut()
      return
    }

    // Command/Ctrl + 0 to reset zoom to 100%
    if ((e.metaKey || e.ctrlKey) && e.key === '0') {
      e.preventDefault()
      engine.resetZoom()
      return
    }

    // ] to bring to front
    if (e.key === ']' && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length > 0) {
        e.preventDefault()
        engine.bringToFront()
        return
      }
    }

    // [ to send to back
    if (e.key === '[' && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length > 0) {
        e.preventDefault()
        engine.sendToBack()
        return
      }
    }

    // Option/Alt + A to align left
    if (e.altKey && (e.key === 'a' || e.key === 'å') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignLeft()
        return
      }
    }

    // Option/Alt + H to align horizontal center
    if (e.altKey && (e.key === 'h' || e.key === '˙') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignCenter()
        return
      }
    }

    // Option/Alt + D to align right
    if (e.altKey && (e.key === 'd' || e.key === '∂') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignRight()
        return
      }
    }

    // Option/Alt + W to align top
    if (e.altKey && (e.key === 'w' || e.key === '∑') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignTop()
        return
      }
    }

    // Option/Alt + V to align vertical middle
    if (e.altKey && (e.key === 'v' || e.key === '√') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignMiddle()
        return
      }
    }

    // Option/Alt + S to align bottom
    if (e.altKey && (e.key === 's' || e.key === 'ß') && !isTyping) {
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length >= 2) {
        e.preventDefault()
        engine.alignBottom()
        return
      }
    }

    // Option/Alt + / (Forward Slash) to toggle Properties Card
    // On Mac Option + / produces '÷', check e.code 'Slash' to be layout-independent
    if (e.altKey && (e.code === 'Slash' || e.key === '/' || e.key === '÷') && !isTyping) {
      e.preventDefault()
      e.stopPropagation()
      setIsPropertiesCardOpen(prev => !prev)
      return
    }

    // Arrow keys: move selected shapes OR scroll canvas if nothing selected
    // Skip this if Command/Ctrl is pressed (quick connect keyboard shortcut)
    const selectedShapes = engine.getDiagramManager().getSelectedShapes()
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (arrowKeys.includes(e.key) && !isTyping && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()

      // Track pressed arrow keys
      pressedArrowKeysRef.current.add(e.key)

      // Calculate movement based on all currently pressed arrow keys
      const pressed = pressedArrowKeysRef.current

      // Check for conflicts on each axis (opposing keys cancel out)
      const upPressed = pressed.has('ArrowUp')
      const downPressed = pressed.has('ArrowDown')
      const leftPressed = pressed.has('ArrowLeft')
      const rightPressed = pressed.has('ArrowRight')

      // Calculate delta - opposing keys cancel out
      let deltaX = 0
      let deltaY = 0

      // Y-axis: Up and Down cancel out
      if (upPressed && !downPressed) deltaY = -1
      else if (downPressed && !upPressed) deltaY = 1

      // X-axis: Left and Right cancel out
      if (leftPressed && !rightPressed) deltaX = -1
      else if (rightPressed && !leftPressed) deltaX = 1

      // Only apply movement if there's actual movement
      if (deltaX !== 0 || deltaY !== 0) {
        if (selectedShapes.length > 0) {
          // Move selected shapes
          engine.moveSelectedShapesByOffset(deltaX * GRID_SPACING, deltaY * GRID_SPACING)
        } else {
          // Pan canvas (note: pan direction is inverted for natural scrolling feel)
          const PAN_AMOUNT = GRID_SPACING * 2
          engine.panByOffset(-deltaX * PAN_AMOUNT, -deltaY * PAN_AMOUNT)
        }
      }
      return
    }

    // ESC key to deselect shapes and switch to Select tool
    if (e.key === 'Escape') {
      // Only skip if user is typing in a regular INPUT or TEXTAREA element
      // Allow Escape to work when editing canvas text (contentEditable) or when using tools
      const isRegularInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      
      // Handle Escape unless in a regular input/textarea
      if (!isRegularInput) {
        e.preventDefault()
        e.stopPropagation()

        // Cancel ReactShape placement mode if active
        if (reactShapePlacementType) {
          setReactShapePlacementType(null)
          setReactShapePreviewPos(null)
          return
        }

        // First, let the engine handle Escape (which delegates to active tool for canceling operations)
        // This will cancel drawing/connecting if in progress, or stop text editing if editing text
        engine.handleKeyDown(e)

        // Always switch to Select tool after handling Escape (always call to ensure UI updates)
        engine.activateTool('Select')
        setActiveTool('Select')

        // Deselect all shapes
        const selectedShapes = engine.getDiagramManager().getSelectedShapes()
        if (selectedShapes.length > 0) {
          engine.getDiagramManager().deselectAllShapes()
          engine.getDiagramManager().hideSelectionOverlay()
          // Force re-render to update UI (hide style menu)
          setShapesVersion(v => v + 1)
        }

        return
      }
    }

    // Enter key to start text editing (fallback if container doesn't have focus)
    // Only handle if not typing and exactly one shape is selected
    if (e.key === 'Enter' && !isTyping && !e.metaKey && !e.ctrlKey) {
      const isEditingText = engine.getDiagramManager().isEditingText()
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()
      if (selectedShapes.length === 1 && !isEditingText) {
        // Start text editing directly via the engine
        const selectTool = engine.getTool('Select')
        if (selectTool && 'getTextEditTool' in selectTool) {
          const textEditTool = (selectTool as any).getTextEditTool()
          if (textEditTool && typeof textEditTool.startTextEditing === 'function') {
            textEditTool.startTextEditing(selectedShapes[0], false)
            e.preventDefault()
            return
          }
        }
      }
    }

    // Tab key to cycle through shapes (Tab = next, Shift+Tab = previous)
    if (e.key === 'Tab' && !isTyping) {
      e.preventDefault()

      const diagramManager = engine.getDiagramManager()
      // Filter out connectors - only cycle through actual shapes
      const allShapes = diagramManager.getShapes().filter(s => s.type !== 'connector')

      // Skip if no shapes exist
      if (allShapes.length === 0) return

      const selectedShapes = diagramManager.getSelectedShapes()

      // Deselect all currently selected shapes
      diagramManager.deselectAllShapes()

      let nextShape
      if (selectedShapes.length === 0) {
        // No selection - select first shape (or last if Shift+Tab)
        nextShape = e.shiftKey ? allShapes[allShapes.length - 1] : allShapes[0]
      } else {
        // Find the index of the last selected shape
        const lastSelectedShape = selectedShapes[selectedShapes.length - 1]
        const currentIndex = allShapes.findIndex(s => s.id === lastSelectedShape.id)

        if (e.shiftKey) {
          // Shift+Tab - select previous shape (wrap around to end)
          const prevIndex = currentIndex <= 0 ? allShapes.length - 1 : currentIndex - 1
          nextShape = allShapes[prevIndex]
        } else {
          // Tab - select next shape (wrap around to beginning)
          const nextIndex = currentIndex >= allShapes.length - 1 ? 0 : currentIndex + 1
          nextShape = allShapes[nextIndex]
        }
      }

      // Select the next/previous shape
      diagramManager.selectShape(nextShape)
      nextShape.selection.show()
      diagramManager.updateSelectionOverlay()
      setShapesVersion(v => v + 1)

      return
    }

    // Pass event to engine for tool handling
    engine.handleKeyDown(e)
  }, [engine, handleSelectAll, handleZoomIn, handleZoomOut, handleOpenFile, handlePasteToReplace, handleCopyAsPNG, reactShapePlacementType])

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Remove arrow key from pressed set when released
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (arrowKeys.includes(e.key)) {
      pressedArrowKeysRef.current.delete(e.key)
    }
    engine.handleKeyUp(e)
  }, [engine])

  // Handle wheel events with passive: false to allow preventing default behavior (scrolling)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelNative = (e: WheelEvent) => {
      // Cast to unknown then to React.WheelEvent to satisfy engine strict types if needed,
      // or duplicate logic. Since engine expects WheelEvent | React.WheelEvent, native WheelEvent is fine.
      engine.handleWheel(e)
    }

    container.addEventListener('wheel', handleWheelNative, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheelNative)
    }
  }, [engine])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Check if the event target is within the context menu or its children
    if ((e.target as Element).closest('[data-context-menu="true"]')) {
      return
    }

    // Close context menu if open (and we clicked outside)
    if (contextMenu) {
      setContextMenu(null)
    }
    
    // Dismiss all React shape interactions (close modals, blur inputs)
    // This ensures modals close when clicking anywhere on the canvas
    engine.getDiagramManager().dismissReactShapeInteractions()

    // Handle ReactShape (ServiceCard/TodoCard) placement mode - place the card on click
    if (reactShapePlacementType) {
      e.preventDefault()
      e.stopPropagation()

      // Get world coordinates from the current preview position
      const svg = svgRef.current
      if (svg && reactShapePreviewPos) {
        const rect = svg.getBoundingClientRect()
        const screenX = e.clientX - rect.left
        const screenY = e.clientY - rect.top

        const worldX = (screenX - canvasState.translation.x) / canvasState.scale
        const worldY = (screenY - canvasState.translation.y) / canvasState.scale

        // Get shape-specific offsets
        const offsetX = reactShapePlacementType === 'service-card' ? 60 : 110
        const offsetY = reactShapePlacementType === 'service-card' ? 50 : 60

        // Apply grid snapping if enabled
        const snapToGrid = engine.getDiagramManager().getSnapToGrid()
        const gridOffset = GRID_SPACING / 2
        const snapValue = (value: number) => snapToGrid
          ? Math.round((value - gridOffset) / GRID_SPACING) * GRID_SPACING + gridOffset
          : value

        const snappedX = snapValue(worldX - offsetX)
        const snappedY = snapValue(worldY - offsetY)

        // Create the shape at the snapped position
        const shape = engine.getDiagramManager().createShape(reactShapePlacementType, snappedX, snappedY)

        if (shape) {
          // Deselect all existing shapes
          engine.getDiagramManager().deselectAllShapes()

          // Select the new shape
          engine.getDiagramManager().selectShape(shape)
          shape.selection.show()

          // Switch to Select tool
          engine.activateTool('Select')
          setActiveTool('Select')

          // Trigger re-render
          setShapesVersion(v => v + 1)

          // Record in history
          engine.recordHistory()
        }
      }

      // Exit placement mode
      setReactShapePlacementType(null)
      setReactShapePreviewPos(null)
      return
    }

    // Close file menu if open
    // if (isFileMenuOpen) {
    //   setIsFileMenuOpen(false)
    // }

    // Ensure the canvas has focus for keyboard events
    const container = e.currentTarget as HTMLDivElement
    if (container && document.activeElement !== container) {
      container.focus()
    }
    
    engine.handlePointerDown(e, container)
  }, [engine, contextMenu, reactShapePlacementType, reactShapePreviewPos, canvasState])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Track cursor position for paste operations
    lastCursorPosRef.current = { x: e.clientX, y: e.clientY }

    // Update ReactShape preview position when in placement mode
    if (reactShapePlacementType) {
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const screenX = e.clientX - rect.left
        const screenY = e.clientY - rect.top

        const worldX = (screenX - canvasState.translation.x) / canvasState.scale
        const worldY = (screenY - canvasState.translation.y) / canvasState.scale

        // Use type-specific offsets
        const offsetX = reactShapePlacementType === 'service-card' ? 60 : 110
        const offsetY = reactShapePlacementType === 'service-card' ? 50 : 60

        // Apply grid snapping if enabled for preview position too
        const snapToGrid = engine.getDiagramManager().getSnapToGrid()
        const gridOffset = GRID_SPACING / 2
        const snapValue = (value: number) => snapToGrid
          ? Math.round((value - gridOffset) / GRID_SPACING) * GRID_SPACING + gridOffset
          : value

        const previewX = snapValue(worldX - offsetX)
        const previewY = snapValue(worldY - offsetY)
        setReactShapePreviewPos({ x: previewX, y: previewY })
      }
    }

    engine.handlePointerMove(e)

    // Broadcast cursor position for collaboration
    if (collaborationPlugin) {
      collaborationPlugin.updateCursor(
        e.clientX,
        e.clientY,
        canvasState.scale,
        canvasState.translation
      );
    }
  }, [engine, reactShapePlacementType, canvasState, collaborationPlugin])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    engine.handlePointerUp(e, e.currentTarget as HTMLElement)
  }, [engine])

  const handlePointerCancel = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    // Pointer was cancelled (e.g., by browser or OS) - clean up any ongoing interactions
    engine.cancelAllInteractions()
  }, [engine])

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    // Save cursor position for paste operations
    lastCursorPosRef.current = { x: e.clientX, y: e.clientY }
    
    // Calculate coordinates relative to the canvas container
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      setContextMenu({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top
      })
    }
  }, [])

  const handleScrollToContent = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation()
    }
    engine.scrollToContent()
  }, [engine])

  const handleIconSelect = useCallback(async (iconPath: string, iconName?: string, iconKey?: string) => {
    try {
      // Icons are now in public/icons folder, so paths should be /icons/...
      // For SVGs, we need to fetch and convert to data URL for proper rendering
      let imageUrl = iconPath
      
      // If it's an SVG and not already a data URL, fetch and convert
      if (iconPath.endsWith('.svg') && !iconPath.startsWith('data:')) {
        try {
          // Ensure path starts with /
          const fetchPath = iconPath.startsWith('/') ? iconPath : `/${iconPath}`
          const response = await fetch(fetchPath)
          
          if (response.ok) {
            const svgText = await response.text()
            // Convert to data URL - use encodeURIComponent to handle special characters
            imageUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`
          } else {
            console.warn('Failed to load icon:', iconPath, response.status)
            // Fall back to original path - might work as URL
            imageUrl = iconPath
          }
        } catch (error) {
          console.error('Failed to load icon:', error)
          // Fall back to original path
          imageUrl = iconPath
        }
      }
      
      // Set the pending image URL and name - this will create an ImageShape when drawing
      // For cloud provider icons (AWS, Azure, GCP, Kubernetes), use square aspect ratio
      const isCloudIcon = iconPath.includes('/icons/aws/') || iconPath.includes('/icons/azure/') || iconPath.includes('/icons/gcp/') || iconPath.includes('/icons/kubernetes/')
      // Ensure we pass the icon name - use provided name or default to "Image"
      const nameToUse = (iconName && typeof iconName === 'string' && iconName.trim()) ? iconName.trim() : 'Image'

      // Update ANY selected shape that can hold an icon
      const selectedShapes = engine.getDiagramManager().getSelectedShapes()

      const targetShapes = selectedShapes.filter(s => {
        // Image shapes are always targets
        if (s.type === 'image' || s instanceof GenericImageShape) return true

        // Rectangles/Frames are targets IF they already have icons/placeholders
        // OR if we are explicitly in "icon mode" (though we are deprecating explicit mode)
        if (s.type === 'rectangle' || s.type === 'frame') {
          const shape = s as any
          return shape.iconContent || shape.hasIconPlaceholder || shape.isIconEditing
        }
        return false
      })

      if (targetShapes.length > 0) {
        let updated = false
        targetShapes.forEach(s => {
          const shape = s as any
          if (shape.setImage) {
            shape.setImage(imageUrl)
            shape.iconKey = iconKey || null
            updated = true
          } else if (shape.type === 'rectangle' || shape.type === 'frame') {
            shape.iconContent = imageUrl
            shape.hasIconPlaceholder = false
            shape.isIconEditing = false // Clear legacy flag if present
            shape.iconKey = iconKey || null
            shape.state.needsRender = true
            shape.render()
            updated = true
          } else if (shape.iconPath !== undefined) {
            shape.iconPath = imageUrl
            shape.iconKey = iconKey || null
            updated = true
          }
        })

        if (updated) {
          engine.recordHistory()
          setShapesVersion(v => v + 1)
          return
        }
      }

      // Default: Create new ImageShape (Draw Tool)
      // Fall through to existing code...

      // Default: Create new ImageShape (Draw Tool)
      engine.setPendingImage(imageUrl, nameToUse, isCloudIcon)

      // Switch to Draw tool if not already active
      if (activeTool !== 'Draw') {
        engine.activateTool('Draw')
        setActiveTool('Draw')
      }
    } catch (error) {
      console.error('Error selecting icon:', error)
    }
  }, [engine, activeTool, activeIconTargetShapeId])

  const handlePencilSelect = useCallback((markerType: FreehandMarkerType) => {
    engine.setMarkerType(markerType)
    setSelectedMarkerType(markerType)
    if (activeTool !== 'Pencil') {
      engine.activateTool('Pencil')
      setActiveTool('Pencil')
    }
  }, [engine, activeTool])

  // Handle ServiceCard creation from sidebar - enter placement mode
  const handleServiceCardSelect = useCallback(() => {
    // Enter placement mode - the actual shape will be created on click
    setReactShapePlacementType('service-card')

    // Initialize preview position at center of canvas
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const centerScreenX = rect.width / 2
      const centerScreenY = rect.height / 2

      const worldX = (centerScreenX - canvasState.translation.x) / canvasState.scale
      const worldY = (centerScreenY - canvasState.translation.y) / canvasState.scale

      setReactShapePreviewPos({ x: worldX - 60, y: worldY - 50 })
    }
  }, [canvasState])

  // Handle TodoCard creation from sidebar - enter placement mode
  const handleTodoCardSelect = useCallback(() => {
    // Enter placement mode - the actual shape will be created on click
    setReactShapePlacementType('todo-card')

    // Initialize preview position at center of canvas
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const centerScreenX = rect.width / 2
      const centerScreenY = rect.height / 2

      const worldX = (centerScreenX - canvasState.translation.x) / canvasState.scale
      const worldY = (centerScreenY - canvasState.translation.y) / canvasState.scale

      setReactShapePreviewPos({ x: worldX - 110, y: worldY - 60 })
    }
  }, [canvasState])

  // Handle Frame creation from sidebar - activate Frame drawing tool
  const handleFrameSelect = useCallback(() => {
    const success = engine.activateTool('Frame')
    if (success) {
      setActiveTool('Frame')
      // Ensure container has focus for keyboard events
      if (containerRef.current) {
        containerRef.current.focus()
      }
    }
  }, [engine])

  const handleCopy = useCallback(async () => {
    await engine.copy()
  }, [engine])

  const handleCut = useCallback(async () => {
    await engine.cut()
  }, [engine])

  const handlePaste = useCallback(async (useCursorPosition = false) => {
    if (useCursorPosition) {
      // Convert screen coordinates to world coordinates for context menu paste
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const screenX = lastCursorPosRef.current.x - rect.left
        const screenY = lastCursorPosRef.current.y - rect.top
        
        const worldX = (screenX - canvasState.translation.x) / canvasState.scale
        const worldY = (screenY - canvasState.translation.y) / canvasState.scale
        
        await engine.paste(worldX, worldY)
      } else {
        await engine.paste()
      }
    } else {
      // Keyboard paste - use default offset behavior
      await engine.paste()
    }
  }, [engine, canvasState])

  const handleDelete = useCallback(() => {
    engine.deleteSelectedShapes()
  }, [engine])

  const handleBringToFront = useCallback(() => {
    engine.bringToFront()
  }, [engine])

  const handleSendToBack = useCallback(() => {
    engine.sendToBack()
  }, [engine])

  const handleUndo = useCallback(() => {
    engine.undo()
  }, [engine])

  const handleRedo = useCallback(() => {
    engine.redo()
  }, [engine])

  // Check content visibility when canvas state or shapes change
  useEffect(() => {
    // Small timeout to ensure DOM is updated
    const timer = setTimeout(() => {
      setIsContentVisible(engine.isContentInView())
    }, 100)
    return () => clearTimeout(timer)
  }, [engine, canvasState, shapesVersion])



  const canUndo = engine.canUndo()
  const canRedo = engine.canRedo()



  // File menu options removed in favor of top bar buttons
  /*
  // Build file menu options
  const fileMenuOptions = useMemo((): FileMenuOption[] => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

    return [
      {
        label: 'Open',
        shortcut: isMac ? '⌘O' : 'Ctrl+O',
        onClick: handleOpenFile,
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 3C2 2.44772 2.44772 2 3 2H6.58579C6.851 2 7.10536 2.10536 7.29289 2.29289L8.70711 3.70711C8.89464 3.89464 9.149 4 9.41421 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      },
      {
        label: 'Save to...',
        onClick: handleSaveToFile,
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 11L8 3M8 11L5.5 8.5M8 11L10.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 13L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )
      },
      {
        label: 'Export image...',
        shortcut: isMac ? '⇧⌘E' : 'Shift+Ctrl+E',
        onClick: () => setIsExportModalOpen(true),
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="5.5" cy="5.5" r="1" fill="currentColor"/>
            <path d="M2 11L5 8L8 11L11 8L14 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      }
    ]
  }, [handleOpenFile, handleSaveToFile])
  */

  // Build menu categories for MainMenu
  const menuCategories = useMemo((): MenuCategory[] => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmd = isMac ? '⌘' : 'Ctrl+'
    const shift = isMac ? '⇧' : 'Shift+'

    // Get current state for enabling/disabling menu items
    const selectedShapes = engine.getDiagramManager().getSelectedShapes()
    const allShapes = engine.getDiagramManager().getShapes()
    const hasSelection = selectedShapes.length > 0
    const hasShapes = allShapes.length > 0
    const hasClipboard = engine.hasClipboardData()
    const canUndoNow = engine.canUndo()
    const canRedoNow = engine.canRedo()

    // Check if selected shapes have text capabilities
    // Shapes that support text are most SVG shapes and connectors
    const hasTextShapes = hasSelection && selectedShapes.some(shape =>
      'text' in shape || 'getText' in shape || typeof (shape as unknown as { setText?: () => void }).setText === 'function'
    )

    return [
      {
        label: 'File',
        items: [
          { label: 'New', onClick: () => { window.location.reload() } },
          { separator: true },
          { label: 'Open...', shortcut: `${cmd}O`, onClick: handleOpenFile },
          { separator: true },
          { label: 'Save local copy...', onClick: handleSaveToFile },
          { separator: true },
          { label: 'Export as...', shortcut: `${shift}${cmd}E`, onClick: () => setIsExportModalOpen(true) },
        ]
      },
      {
        label: 'Edit',
        items: [
          { label: 'Undo', shortcut: `${cmd}Z`, onClick: () => engine.undo(), disabled: !canUndoNow },
          { label: 'Redo', shortcut: `${shift}${cmd}Z`, onClick: () => engine.redo(), disabled: !canRedoNow },
          { separator: true },
          { label: 'Copy', shortcut: `${cmd}C`, onClick: () => engine.copy(), disabled: !hasSelection },
          { label: 'Paste', shortcut: `${cmd}V`, onClick: () => engine.paste(), disabled: !hasClipboard },
          { label: 'Paste to replace', shortcut: `${shift}${cmd}R`, onClick: () => handlePasteToReplace(false), disabled: !hasSelection || !hasClipboard },
          {
            label: 'Duplicate', shortcut: `${cmd}D`, onClick: () => {
              engine.copy()
              engine.paste()
            }, disabled: !hasSelection
          },
          { label: 'Delete', shortcut: '⌫', onClick: () => engine.deleteSelectedShapes(), disabled: !hasSelection },
          { separator: true },
          { label: 'Select all', shortcut: `${cmd}A`, onClick: handleSelectAll, disabled: !hasShapes },
        ]
      },
      {
        label: 'View',
        items: [
          {
            label: 'Show dot grid', checked: canvasSettings.canvasTheme.showGrid, onClick: () => {
              engine.getSettingsManager().updateCanvasThemeProperty({ showGrid: !canvasSettings.canvasTheme.showGrid })
            }
          },
          { separator: true },
          { label: 'Zoom in', shortcut: `${cmd}+`, onClick: handleZoomIn },
          { label: 'Zoom out', shortcut: `${cmd}-`, onClick: handleZoomOut },
          { label: 'Zoom to 100%', shortcut: `${cmd}0`, onClick: () => engine.resetZoom() },
          { label: 'Zoom to fit', shortcut: `${shift}1`, onClick: () => engine.scrollToContent(), disabled: !hasShapes },
        ]
      },
      {
        label: 'Object',
        items: [
          { label: 'Bring to front', shortcut: ']', onClick: () => engine.bringToFront(), disabled: !hasSelection },
          { label: 'Send to back', shortcut: '[', onClick: () => engine.sendToBack(), disabled: !hasSelection },
          { separator: true },
          { label: 'Group', shortcut: `${cmd}G`, onClick: () => { engine.getDiagramManager().groupSelectedShapes(); setShapesVersion(v => v + 1); engine.recordHistory(); }, disabled: !engine.getDiagramManager().canGroupSelectedShapes() },
          { label: 'Ungroup', shortcut: `${shift}${cmd}G`, onClick: () => { engine.getDiagramManager().ungroupSelectedShapes(); setShapesVersion(v => v + 1); engine.recordHistory(); }, disabled: !engine.getDiagramManager().canUngroupSelectedShapes() },
        ]
      },
      {
        label: 'Text',
        items: [
          { label: 'Bold', shortcut: `${cmd}B`, onClick: () => engine.toggleSelectedShapesFontWeight(), disabled: !hasTextShapes },
          { label: 'Italic', shortcut: `${cmd}I`, onClick: () => engine.toggleSelectedShapesFontStyle(), disabled: !hasTextShapes },
          { label: 'Underline', shortcut: `${cmd}U`, onClick: () => engine.setSelectedShapesTextDecoration('underline'), disabled: !hasTextShapes },
          { separator: true },
          { label: 'Align left', onClick: () => engine.setSelectedShapesTextAlign('left'), disabled: !hasTextShapes },
          { label: 'Align center', onClick: () => engine.setSelectedShapesTextAlign('center'), disabled: !hasTextShapes },
          { label: 'Align right', onClick: () => engine.setSelectedShapesTextAlign('right'), disabled: !hasTextShapes },
        ]
      },
      {
        label: 'Arrange',
        items: [
          { label: 'Align left', shortcut: '⌥A', onClick: () => engine.alignLeft(), disabled: selectedShapes.length < 2 },
          { label: 'Align horizontal centers', shortcut: '⌥H', onClick: () => engine.alignCenter(), disabled: selectedShapes.length < 2 },
          { label: 'Align right', shortcut: '⌥D', onClick: () => engine.alignRight(), disabled: selectedShapes.length < 2 },
          { separator: true },
          { label: 'Align top', shortcut: '⌥W', onClick: () => engine.alignTop(), disabled: selectedShapes.length < 2 },
          { label: 'Align vertical centers', shortcut: '⌥V', onClick: () => engine.alignMiddle(), disabled: selectedShapes.length < 2 },
          { label: 'Align bottom', shortcut: '⌥S', onClick: () => engine.alignBottom(), disabled: selectedShapes.length < 2 },
        ]
      },
      {
        label: 'Preferences',
        items: [
          {
            label: 'Theme',
            submenu: [
              { label: 'Light', checked: canvasSettings.uiTheme === 'light', onClick: () => engine.getSettingsManager().setUITheme('light') },
              { label: 'Dark', checked: canvasSettings.uiTheme === 'dark', onClick: () => engine.getSettingsManager().setUITheme('dark') },
            ]
          },
          {
            label: 'Show grid', checked: canvasSettings.canvasTheme.showGrid, onClick: () => {
              engine.getSettingsManager().updateCanvasThemeProperty({ showGrid: !canvasSettings.canvasTheme.showGrid })
            }
          },
          {
            label: 'Snap to grid', checked: canvasSettings.snapToGrid, onClick: () => {
              engine.getSettingsManager().setSnapToGrid(!canvasSettings.snapToGrid)
            }
          },
        ]
      },
      {
        label: 'Help and account',
        items: [
          { label: 'Keyboard shortcuts', shortcut: '⌃⇧?', onClick: () => setIsKeyboardShortcutsModalOpen(true) },
          {
            label: 'About Flowstry', onClick: () => {
              window.open('https://flowstry.com', '_blank')
            }
          },
        ]
      },
    ]
  }, [engine, handleOpenFile, handleSaveToFile, handlePasteToReplace, handleSelectAll, handleZoomIn, handleZoomOut, canvasSettings, shapesVersion])

  // Build context menu options
  const contextMenuOptions = useMemo((): ContextMenuOption[] => {
    const selectedShapes = engine.getDiagramManager().getSelectedShapes()
    const allShapes = engine.getDiagramManager().getShapes()
    const hasSelection = selectedShapes.length > 0
    const hasClipboard = engine.hasClipboardData()
    const hasShapes = allShapes.length > 0
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

    // If no shapes are selected, show a different menu
    if (!hasSelection) {
      return [
        {
          label: 'Paste',
          shortcut: isMac ? '⌘V' : 'Ctrl+V',
          onClick: () => handlePaste(true), // Context menu paste at cursor
          disabled: !hasClipboard
        },
        {
          label: 'Select all',
          shortcut: isMac ? '⌘A' : 'Ctrl+A',
          onClick: handleSelectAll,
          disabled: !hasShapes
        },
        {
          label: '',
          separator: true,
          onClick: () => {}
        },
        {
          label: 'Copy to clipboard as PNG',
          shortcut: isMac ? '⇧⌘C' : 'Shift+Ctrl+C',
          onClick: handleCopyAsPNG,
          disabled: !hasShapes
        },
        {
          label: 'Copy to clipboard as SVG',
          onClick: handleCopyAsSVG,
          disabled: !hasShapes
        },
        {
          label: 'Export image...',
          shortcut: isMac ? '⇧⌘E' : 'Shift+Ctrl+E',
          onClick: () => setIsExportModalOpen(true)
        },
        {
          label: '',
          separator: true,
          onClick: () => { }
        },
        {
          label: 'Keyboard shortcuts',
          shortcut: '⌃⇧?',
          onClick: () => setIsKeyboardShortcutsModalOpen(true)
        },
        {
          label: 'Properties',
          shortcut: '⌥/',
          onClick: () => setIsPropertiesCardOpen(true)
        }

      ]
    }

    // If shapes are selected, show full menu
    return [
      {
        label: 'Copy',
        shortcut: isMac ? '⌘C' : 'Ctrl+C',
        onClick: handleCopy,
        disabled: !hasSelection
      },
      {
        label: 'Cut',
        shortcut: isMac ? '⌘X' : 'Ctrl+X',
        onClick: handleCut,
        disabled: !hasSelection
      },
      {
        label: 'Paste',
        shortcut: isMac ? '⌘V' : 'Ctrl+V',
        onClick: () => handlePaste(true), // Context menu paste at cursor
        disabled: !hasClipboard
      },
      {
        label: 'Paste to replace',
        shortcut: isMac ? '⇧⌘R' : 'Shift+Ctrl+R',
        onClick: () => handlePasteToReplace(true),
        disabled: !hasSelection || !hasClipboard // Only active when both selected shapes AND clipboard data exist
      },
      {
        label: '',
        separator: true,
        onClick: () => {}
      },
      {
        label: 'Copy to clipboard as PNG',
        shortcut: isMac ? '⇧⌘C' : 'Shift+Ctrl+C',
        onClick: handleCopyAsPNG,
        disabled: !hasSelection
      },
      {
        label: 'Copy to clipboard as SVG',
        onClick: handleCopyAsSVG,
        disabled: !hasSelection
      },
      {
        label: 'Export image...',
        shortcut: isMac ? '⇧⌘E' : 'Shift+Ctrl+E',
        onClick: () => setIsExportModalOpen(true)
      },
      {
        label: '',
        separator: true,
        onClick: () => {}
      },
      {
        label: 'Bring to front',
        shortcut: ']',
        onClick: handleBringToFront,
        disabled: !hasSelection
      },
      {
        label: 'Send to back',
        shortcut: '[',
        onClick: handleSendToBack,
        disabled: !hasSelection
      },
      {
        label: '',
        separator: true,
        onClick: () => {}
      },
      {
        label: 'Group',
        shortcut: isMac ? '⌘G' : 'Ctrl+G',
        onClick: () => { engine.getDiagramManager().groupSelectedShapes(); setShapesVersion(v => v + 1); engine.recordHistory(); },
        disabled: !engine.getDiagramManager().canGroupSelectedShapes()
      },
      {
        label: 'Ungroup',
        shortcut: isMac ? '⇧⌘G' : 'Shift+Ctrl+G',
        onClick: () => { engine.getDiagramManager().ungroupSelectedShapes(); setShapesVersion(v => v + 1); engine.recordHistory(); },
        disabled: !engine.getDiagramManager().canUngroupSelectedShapes()
      },
      {
        label: '',
        separator: true,
        onClick: () => { }
      },
      {
        label: 'Delete',
        shortcut: '⌫',
        onClick: handleDelete,
        disabled: !hasSelection,
        danger: true
      },
      {
        label: '',
        separator: true,
        onClick: () => { }
      },
      {
        label: 'Properties',
        shortcut: '⌥/',
        onClick: () => setIsPropertiesCardOpen(true)
      },
      {
        label: 'Keyboard shortcuts',
        shortcut: '⌃⇧?',
        onClick: () => setIsKeyboardShortcutsModalOpen(true)
      }
    ]
  }, [engine, handleCopy, handleCut, handlePaste, handlePasteToReplace, handleDelete, handleSelectAll, handleBringToFront, handleSendToBack, handleCopyAsPNG, handleCopyAsSVG, shapesVersion, setIsPropertiesCardOpen])

  const patternId = useMemo(() => `dot-grid-${baseId}`, [baseId])
  const gridLayerId = useMemo(() => `grid-layer-${baseId}`, [baseId])
  const contentLayerId = useMemo(() => `content-layer-${baseId}`, [baseId])

  // Get computed values from engine
  const contentTransform = useMemo(() => engine.getContentTransform(), [canvasState])
  const patternTransform = useMemo(() => engine.getPatternTransform(), [canvasState])
  const contentStrokeWidth = useMemo(() => engine.getContentStrokeWidth(), [canvasState.scale])

  // Derive UI theme (light/dark) from settings
  const uiTheme = canvasSettings.uiTheme

  return (
    <div 
      className="flowstry-canvas relative w-full h-full overflow-clip" 
      data-theme={uiTheme}
      style={{ backgroundColor: canvasSettings.canvasTheme.backgroundColor }}
    >
      {/* Canvas Layer - handles all canvas interactions */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        tabIndex={0}
        role="application"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        style={{
          cursor: reactShapePlacementType ? 'crosshair' : cursorStyle,
          touchAction: 'none'
        }}
      >
        <div style={{ width: WORKSPACE_SIZE, height: WORKSPACE_SIZE }} className="relative">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ display: 'block', willChange: 'transform' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id={patternId}
                width={GRID_SPACING}
                height={GRID_SPACING}
                patternUnits="userSpaceOnUse"
                patternTransform={patternTransform}
              >
                {canvasSettings.canvasTheme.gridStyle === 'dots' ? (
                  <circle
                    cx={GRID_SPACING / 2}
                    cy={GRID_SPACING / 2}
                    r={GRID_DOT_RADIUS}
                    fill={canvasSettings.canvasTheme.gridColor}
                    opacity={GRID_DOT_OPACITY}
                  />
                ) : (
                  <g stroke={canvasSettings.canvasTheme.gridColor} strokeOpacity={GRID_DOT_OPACITY} strokeWidth="1">
                    {/* Horizontal line through center */}
                    <path d={`M 0 ${GRID_SPACING / 2} L ${GRID_SPACING} ${GRID_SPACING / 2}`} fill="none" />
                    {/* Vertical line through center */}
                    <path d={`M ${GRID_SPACING / 2} 0 L ${GRID_SPACING / 2} ${GRID_SPACING}`} fill="none" />
                  </g>
                )}
              </pattern>

              {/* UML Arrowhead Markers - End markers (pointing forward) */}
              {/* Open Arrow (Directed Association) */}
              <marker
                id="arrowhead-open"
                markerWidth="12"
                markerHeight="12"
                refX="10"
                refY="6"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 0,0 L 10,6 L 0,12"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              {/* Start marker (reversed) - refX set to 0 so marker attaches at path start, maintaining gap */}
              <marker
                id="arrowhead-open-start"
                markerWidth="12"
                markerHeight="12"
                refX="0"
                refY="6"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 0,0 L 10,6 L 0,12"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>

              {/* Hollow Triangle (Inheritance/Generalization) */}
              <marker
                id="arrowhead-hollow-triangle"
                markerWidth="14"
                markerHeight="14"
                refX="12"
                refY="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 0,0 L 14,7 L 0,14 Z"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              {/* Start marker (reversed) - refX set to 0 so marker attaches at path start, maintaining gap */}
              <marker
                id="arrowhead-hollow-triangle-start"
                markerWidth="14"
                markerHeight="14"
                refX="0"
                refY="7"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 0,0 L 14,7 L 0,14 Z"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>

              {/* Hollow Diamond (Aggregation) - symmetric, same for start and end */}
              <marker
                id="arrowhead-hollow-diamond"
                markerWidth="14"
                markerHeight="14"
                refX="12"
                refY="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 7,0 L 14,7 L 7,14 L 0,7 Z"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              {/* Start marker - refX set to 0 so marker attaches at path start, maintaining gap */}
              <marker
                id="arrowhead-hollow-diamond-start"
                markerWidth="14"
                markerHeight="14"
                refX="0"
                refY="7"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 7,0 L 14,7 L 7,14 L 0,7 Z"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>

              {/* Filled Diamond (Composition) - symmetric, same for start and end */}
              <marker
                id="arrowhead-filled-diamond"
                markerWidth="14"
                markerHeight="14"
                refX="12"
                refY="7"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 7,0 L 14,7 L 7,14 L 0,7 Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
              {/* Start marker - refX set to 0 so marker attaches at path start, maintaining gap */}
              <marker
                id="arrowhead-filled-diamond-start"
                markerWidth="14"
                markerHeight="14"
                refX="0"
                refY="7"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 7,0 L 14,7 L 7,14 L 0,7 Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>

            {/* Grid rect */}
            {canvasSettings.canvasTheme.showGrid && (
              <rect
                id={gridLayerId}
                width="100%"
                height="100%"
                fill={`url(#${patternId})`}
                pointerEvents="none"
              />
            )}

            {/* Content layer */}
            <g 
              id={contentLayerId} 
              ref={contentLayerRef}
              transform={contentTransform} 
              style={{ strokeWidth: contentStrokeWidth }}
            >
              {/* Render shapes */}
              {shapesVersion >= 0 && engine.getDiagramManager().getShapes().map(shape => (
                <React.Fragment key={shape.id} />
              ))}
            </g>

            {/* ReactShape placement preview - shows ghost card following cursor */}
            {reactShapePlacementType && reactShapePreviewPos && (
              <g transform={contentTransform} pointerEvents="none">
                {reactShapePlacementType === 'service-card' ? (
                  /* ServiceCard preview - horizontal layout: icon left, text right */
                  <>
                    <rect
                      x={reactShapePreviewPos.x}
                      y={reactShapePreviewPos.y}
                      width={120}
                      height={48}
                      rx={12}
                      ry={12}
                      fill={canvasSettings.uiTheme === 'dark' ? 'rgba(30, 30, 35, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
                      stroke="#3C82FF"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                    />
                    {/* Icon placeholder (left side) */}
                    <rect
                      x={reactShapePreviewPos.x + 12}
                      y={reactShapePreviewPos.y + 8}
                      width={32}
                      height={32}
                      rx={4}
                      fill="none"
                      stroke={canvasSettings.uiTheme === 'dark' ? '#666' : '#ccc'}
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                    {/* Text placeholder (right side) */}
                    <rect
                      x={reactShapePreviewPos.x + 52}
                      y={reactShapePreviewPos.y + 18}
                      width={56}
                      height={12}
                      rx={2}
                      fill={canvasSettings.uiTheme === 'dark' ? '#444' : '#e0e0e0'}
                    />
                  </>
                ) : (
                  /* TodoCard preview */
                  <>
                    <rect
                      x={reactShapePreviewPos.x}
                      y={reactShapePreviewPos.y}
                      width={220}
                      height={120}
                      rx={8}
                      ry={8}
                      fill={canvasSettings.uiTheme === 'dark' ? 'rgba(30, 30, 35, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
                      stroke="#3C82FF"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                    />
                    {/* Header line */}
                    <line
                      x1={reactShapePreviewPos.x + 10}
                      y1={reactShapePreviewPos.y + 35}
                      x2={reactShapePreviewPos.x + 210}
                      y2={reactShapePreviewPos.y + 35}
                      stroke={canvasSettings.uiTheme === 'dark' ? '#444' : '#e0e0e0'}
                      strokeWidth={1}
                    />
                    {/* Todo item placeholder 1 */}
                    <rect
                      x={reactShapePreviewPos.x + 15}
                      y={reactShapePreviewPos.y + 50}
                      width={12}
                      height={12}
                      rx={2}
                      fill="none"
                      stroke={canvasSettings.uiTheme === 'dark' ? '#666' : '#ccc'}
                      strokeWidth={1.5}
                    />
                    <rect
                      x={reactShapePreviewPos.x + 35}
                      y={reactShapePreviewPos.y + 53}
                      width={100}
                      height={6}
                      rx={2}
                      fill={canvasSettings.uiTheme === 'dark' ? '#444' : '#e0e0e0'}
                    />
                    {/* Todo item placeholder 2 */}
                    <rect
                      x={reactShapePreviewPos.x + 15}
                      y={reactShapePreviewPos.y + 75}
                      width={12}
                      height={12}
                      rx={2}
                      fill="none"
                      stroke={canvasSettings.uiTheme === 'dark' ? '#666' : '#ccc'}
                      strokeWidth={1.5}
                    />
                    <rect
                      x={reactShapePreviewPos.x + 35}
                      y={reactShapePreviewPos.y + 78}
                      width={80}
                      height={6}
                      rx={2}
                      fill={canvasSettings.uiTheme === 'dark' ? '#444' : '#e0e0e0'}
                    />
                  </>
                )}
              </g>
            )}



            {/* Laser pointer layer - ephemeral strokes above content */}
            <g transform={contentTransform} pointerEvents="none">
              {laserStrokes.map(stroke => {
                if (stroke.points.length < 2) return null

                const now = Date.now()
                const stagger = LaserPointerTool.STAGGER_MS
                const fadeDuration = LaserPointerTool.FADE_DURATION_MS
                const maxStrokeWidth = 4
                const firstTimestamp = stroke.points[0].timestamp

                // Render each segment with stroke width based on sequence position
                return (
                  <g key={stroke.id}>
                    {stroke.points.slice(1).map((point, i) => {
                      const prevPoint = stroke.points[i]

                      // Calculate fade start time based on sequence index (not timestamp)
                      // This ensures points fade in order: first point fades first
                      const fadeStartTime = firstTimestamp + (i * stagger)
                      const timeSinceFadeStart = now - fadeStartTime

                      // If we haven't reached this point's fade start time, full width
                      // Otherwise, fade based on time since fade started
                      let strokeWidth: number
                      if (timeSinceFadeStart <= 0) {
                        strokeWidth = maxStrokeWidth
                      } else {
                        const fadeProgress = Math.min(1, timeSinceFadeStart / fadeDuration)
                        strokeWidth = maxStrokeWidth * (1 - fadeProgress)
                      }

                      if (strokeWidth < 0.5) return null

                      const segmentPath = `M ${prevPoint.x} ${prevPoint.y} L ${point.x} ${point.y}`

                      return (
                        <path
                          key={`${stroke.id}-seg-${i}`}
                          d={segmentPath}
                          fill="none"
                          stroke="#FF0000"
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )
                    })}
                  </g>
                )
              })}
              {remoteLaserStrokes.map(stroke => {
                if (stroke.points.length < 2) return null

                const now = Date.now()
                const stagger = LaserPointerTool.STAGGER_MS
                const fadeDuration = LaserPointerTool.FADE_DURATION_MS
                const maxStrokeWidth = 4
                const firstTimestamp = stroke.points[0].timestamp

                return (
                  <g key={stroke.id}>
                    {stroke.points.slice(1).map((point, i) => {
                      const prevPoint = stroke.points[i]
                      const fadeStartTime = firstTimestamp + (i * stagger)
                      const timeSinceFadeStart = now - fadeStartTime

                      let strokeWidth: number
                      if (timeSinceFadeStart <= 0) {
                        strokeWidth = maxStrokeWidth
                      } else {
                        const fadeProgress = Math.min(1, timeSinceFadeStart / fadeDuration)
                        strokeWidth = maxStrokeWidth * (1 - fadeProgress)
                      }

                      if (strokeWidth < 0.5) return null

                      const segmentPath = `M ${prevPoint.x} ${prevPoint.y} L ${point.x} ${point.y}`

                      return (
                        <path
                          key={`${stroke.id}-seg-${i}`}
                          d={segmentPath}
                          fill="none"
                          stroke="#FF0000"
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>


      </div>


      {/* Remote Selections - Rendered on top of canvas */}
      {remoteUsers.length > 0 && (
        <RemoteSelections
          remoteUsers={remoteUsers}
          canvasScale={canvasState.scale}
          canvasTranslation={canvasState.translation}
        />
      )}

      {/* Remote Cursors Overlay - Rendered on top of canvas */}
      {remoteUsers.length > 0 && (
        <RemoteCursors
          users={remoteUsers}
          canvasScale={canvasState.scale}
          canvasTranslation={canvasState.translation}
        />
      )}

      {/* Loading Overlay - Rendered between canvas and UI layer */}
      {showLoadingOverlay && <LoadingOverlay />}

      {/* UI Layers - Conditional rendering for Mobile vs Desktop */}

      {/* Mobile Layout - Visible only on small screens */}
      <div className="md:hidden fixed inset-0 pointer-events-none z-50">
        <MobileCanvasLayout
          engine={engine}
          uiTheme={canvasSettings.uiTheme}
          containerRef={containerRef}
          filename={filename}
          setFilename={setFilename}
          menuCategories={menuCategories}
          renderBreadcrumb={renderBreadcrumb}
          renderUserMenu={renderUserMenu}
          topMenuItems={topMenuItems}
          bottomMenuItems={bottomMenuItems}
          activeTool={activeTool}
          selectedShapeType={selectedShapeType}
          selectedConnectorType={selectedConnectorType}
          selectedMarkerType={selectedMarkerType}
          setSelectedShapeType={setSelectedShapeType}
          setSelectedConnectorType={setSelectedConnectorType}
          onTogglePalette={handleTogglePalette}
          isPaletteOpen={isColorPaletteOpen}
          onApplyPalette={handleApplyPalette}
          activePaletteId={activePaletteId}
          handleIconSelect={handleIconSelect}
          handlePencilSelect={handlePencilSelect}
          handleServiceCardSelect={handleServiceCardSelect}
          handleTodoCardSelect={handleTodoCardSelect}
          handleFrameSelect={handleFrameSelect}
          handleScrollToContent={handleScrollToContent}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          isPropertiesCardOpen={isPropertiesCardOpen}
          setIsPropertiesCardOpen={setIsPropertiesCardOpen}
          propertiesData={propertiesData}
          canvasSettings={canvasSettings}
          isContentVisible={isContentVisible}
          canUndo={canUndo}
          canRedo={canRedo}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          contextMenuOptions={contextMenuOptions}
          containerRect={containerRect}
          canvasState={canvasState}
          isDragging={isDragging}
          isResizing={isResizing}
          setShapesVersion={setShapesVersion}
          isReadOnly={isReadOnly}
          onViewerModeToggle={() => {
            // Only allow toggling if not enforced by propReadOnly
            if (!propReadOnly) {
              setLocalViewerMode(prev => !prev)
            }
          }}
        />
      </div>

      {/* Desktop Layout - Hidden on small screens */}
      <div className="hidden md:block absolute inset-0 pointer-events-none z-50">
        <DesktopCanvasLayout
          engine={engine}
          uiTheme={canvasSettings.uiTheme}
          containerRef={containerRef}
          filename={filename}
          setFilename={setFilename}
          menuCategories={menuCategories}
          renderBreadcrumb={renderBreadcrumb}
          renderUserMenu={renderUserMenu}
          topMenuItems={topMenuItems}
          bottomMenuItems={bottomMenuItems}
          activeTool={activeTool}
          selectedShapeType={selectedShapeType}
          selectedConnectorType={selectedConnectorType}
          selectedMarkerType={selectedMarkerType}
          setSelectedShapeType={setSelectedShapeType}
          setSelectedConnectorType={setSelectedConnectorType}
          onTogglePalette={handleTogglePalette}
          isPaletteOpen={isColorPaletteOpen}
          onApplyPalette={handleApplyPalette}
          activePaletteId={activePaletteId}
          handleIconSelect={handleIconSelect}
          handlePencilSelect={handlePencilSelect}
          handleServiceCardSelect={handleServiceCardSelect}
          handleTodoCardSelect={handleTodoCardSelect}
          handleFrameSelect={handleFrameSelect}
          handleScrollToContent={handleScrollToContent}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          isPropertiesCardOpen={isPropertiesCardOpen}
          setIsPropertiesCardOpen={setIsPropertiesCardOpen}
          propertiesData={propertiesData}
          canvasSettings={canvasSettings}
          isContentVisible={isContentVisible}
          canUndo={canUndo}
          canRedo={canRedo}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          contextMenuOptions={contextMenuOptions}
          containerRect={containerRect}
          canvasState={canvasState}
          isDragging={isDragging}
          isResizing={isResizing}
          setShapesVersion={setShapesVersion}
          isReadOnly={isReadOnly}
          onViewerModeToggle={() => {
            // Only allow toggling if not enforced by propReadOnly
            if (!propReadOnly) {
              setLocalViewerMode(prev => !prev)
            }
          }}
        />
      </div>

      {/* Modals - rendered at root level */}
      <ExportImageModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={(options, format) => {
          const exportManager = engine.getImageExportManager();
          if (exportManager) {
            return exportManager.export(options, format);
          }
          return Promise.resolve();
        }}
        hasSelectedShapes={engine.getDiagramManager().getSelectedShapes().length > 0}
        getPreviewSVG={(options) => {
          const exportManager = engine.getImageExportManager();
          return exportManager ? exportManager.generatePreview(options) : null;
        }}
        theme={uiTheme}
      />
      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() => setIsKeyboardShortcutsModalOpen(false)}
        theme={uiTheme}
      />
    </div>
  )

}

export default Canvas