
import { CircleHelp, Info, LocateFixed, Menu } from 'lucide-react';
import React from 'react';
import { ConnectorShape } from '../shapes/connectors';
import { CanvasUIProps } from '../types';
import { BottomToolbar } from './BottomToolbar';
import { CanvasSettingsBar } from './CanvasSettingsBar';
import { ContextMenu } from './ContextMenu';
import { HistoryControls } from './HistoryControls';
import { LibraryPanel } from './LibraryPanel';
import { MainMenu } from './MainMenu';
import { PropertiesCard } from './PropertiesCard';
import { Sidebar } from './Sidebar';
import { StyleMenu } from './StyleMenu';
import { ViewerModeToggle } from './ViewerModeToggle';
import { ZoomControls } from './ZoomControls';

export const DesktopCanvasLayout: React.FC<CanvasUIProps> = ({
  engine,
  uiTheme,
  containerRef,
  filename,
  setFilename,
  menuCategories,
  renderBreadcrumb,
  renderUserMenu,
  topMenuItems,
  bottomMenuItems,
  activeTool,
  selectedShapeType,
  selectedConnectorType,
  selectedMarkerType,
  setSelectedShapeType,
  setSelectedConnectorType,
  onTogglePalette,
  isPaletteOpen,
  onApplyPalette,
  activePaletteId,
  handleIconSelect,
  handlePencilSelect,
  handleServiceCardSelect,
  handleTodoCardSelect,
  handleFrameSelect,
  handleScrollToContent,
  handleUndo,
  handleRedo,
  onViewerModeToggle,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  isPropertiesCardOpen,
  setIsPropertiesCardOpen,
  propertiesData,
  canvasSettings,
  isContentVisible,
  canUndo,
  canRedo,
  contextMenu,
  setContextMenu,
  contextMenuOptions,
  containerRect,
  canvasState,
  setShapesVersion,
  isReadOnly,
  isDragging,
  isResizing,
}) => {
  const [activeSection, setActiveSection] = React.useState<string | null>(null);

  // Determine current draw style from selection or default (Masking to Stroke Style)
  const selectedShapes = engine.getDiagramManager().getSelectedShapes()
  const defaultAppearance = engine.getSettingsManager().getSettings().defaultShapeAppearance || {}
  const drawStyle = selectedShapes.length > 0
    ? selectedShapes[0].appearance.strokeDrawStyle
    : defaultAppearance.strokeDrawStyle || 'standard'

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Unified Sidebar */}
      {/* Unified Sidebar - Hide in ReadOnly */}
      {!isReadOnly && (
        <Sidebar
          isOpen={isMobileSidebarOpen}
          activeTool={activeTool}
          selectedShapeType={selectedShapeType}
          selectedConnectorType={selectedConnectorType}
          selectedMarkerType={selectedMarkerType}
          onToolChange={(tool) => engine.activateTool(tool)}
          onShapeTypeChange={(type) => {
            engine.setDrawingShapeType(type);
            setSelectedShapeType(type);
          }}
          onIconSelect={handleIconSelect}
          onConnectorSelect={(type) => {
            engine.activateTool('Connector');
            engine.setConnectorType(type);
            setSelectedConnectorType(type);
          }}
          onPencilSelect={handlePencilSelect}
          onServiceCardSelect={handleServiceCardSelect}
          onTodoCardSelect={handleTodoCardSelect}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          theme={uiTheme}
          containerRef={containerRef}
          activeSection={activeSection}
          onSectionSelect={setActiveSection}
        onTogglePalette={onTogglePalette}
        isPaletteOpen={isPaletteOpen}
        onApplyPalette={onApplyPalette}
        activePaletteId={activePaletteId}
          drawStyle={drawStyle}
          onToggleDrawStyle={() => {
            console.log('DesktopLayout: handleToggleDrawStyle', drawStyle)
            const newStyle = drawStyle === 'standard' ? 'handdrawn' : 'standard'
            engine.getDiagramManager().setDrawStyle(newStyle)
            // Also update global settings defaults so UI stays in sync
            engine.getSettingsManager().setDefaultShapeAppearance({
              strokeDrawStyle: newStyle
              // Note: We intentionally do NOT set fillDrawStyle here
            })
            engine.recordHistory(true)
            setShapesVersion(v => v + 1)
          }}
        />
      )}

      {/* Library Panel - Opens next to Sidebar */}
      {/* Library Panel - Opens next to Sidebar - Hide in ReadOnly */}
      {!isReadOnly && (
        <LibraryPanel
          isOpen={!!activeSection}
          onIconSelect={handleIconSelect}
          activeSection={activeSection}
          theme={uiTheme}
          onClose={() => setActiveSection(null)}
        />
      )}

      {/* Bottom Toolbar - Basic Drawing Tools */}
      {/* Bottom Toolbar - Basic Drawing Tools */}
      <BottomToolbar
        activeTool={activeTool}
        selectedShapeType={selectedShapeType}
        selectedConnectorType={selectedConnectorType}
        selectedMarkerType={selectedMarkerType}
        onToolChange={(tool) => engine.activateTool(tool)}
        onShapeTypeChange={(type) => {
          engine.setDrawingShapeType(type);
          setSelectedShapeType(type);
        }}
        onConnectorSelect={(type) => {
          engine.activateTool('Connector');
          engine.setConnectorType(type);
          setSelectedConnectorType(type);
        }}
        onPencilSelect={handlePencilSelect}
        onServiceCardSelect={handleServiceCardSelect}
        onTodoCardSelect={handleTodoCardSelect}
        onFrameSelect={handleFrameSelect}
        theme={uiTheme}
        containerRef={containerRef}
        isReadOnly={isReadOnly}
      />

      {/* Header Controls - Single unified bar on top left */}
      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none z-[60]">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden p-2.5 rounded-xl border shadow-lg backdrop-blur bg-white/90 border-gray-200 dark:bg-[#1A1A1F] dark:border-gray-700 pointer-events-auto flex-shrink-0"
        >
          <Menu size={20} />
        </button>

        {/* Unified Header Bar */}
        <div
          className={`relative flex items-center gap-1 rounded-xl border shadow-lg backdrop-blur pointer-events-auto px-2 py-1 ${uiTheme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'}`}
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
          {/* MainMenu */}
          <MainMenu
            theme={uiTheme}
            filename={filename}
            onFilenameChange={setFilename}
            categories={menuCategories}
            topMenuItems={topMenuItems}
            bottomMenuItems={bottomMenuItems}
          />

          {/* Viewer Mode Toggle - Core Canvas Feature */}
          <ViewerModeToggle
            theme={uiTheme}
            isReadOnly={isReadOnly}
            onToggle={onViewerModeToggle}
          />

          {/* Separator (only if we have breadcrumb) */}
          {renderBreadcrumb && (
            <div className={`w-px h-5 mx-2 ${uiTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />
          )}

          {/* Breadcrumb will be injected here via renderBreadcrumb prop */}
          {renderBreadcrumb && renderBreadcrumb({ theme: uiTheme })}

          {/* Separator between breadcrumb/sync and user menu */}
          {renderUserMenu && (
            <div className={`w-px h-5 mx-2 ${uiTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />
          )}

          {/* User Menu will be injected here via renderUserMenu prop */}
          {renderUserMenu && renderUserMenu({ theme: uiTheme })}
        </div>
      </div>

      {/* Scroll to Content Button (Top Center, only when content not visible) */}
      {!isContentVisible && engine.getDiagramManager().getShapes().filter(s => s.type !== 'connector').length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <button
            onClick={handleScrollToContent}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg backdrop-blur-xl transition-all hover:scale-105 active:scale-95 ${uiTheme === 'dark'
              ? 'bg-[#1A1A1F] border-gray-700 text-gray-200 hover:text-white'
              : 'bg-white/90 border-gray-200 text-gray-700 hover:bg-white hover:border-[#36C3AD]/50 hover:text-[#36C3AD]'
              }`}
          >
            <LocateFixed size={16} />
            <span className="text-sm font-medium">Return to Content</span>
          </button>
        </div>
      )}

      {/* Bottom Right Controls - Stacked Vertically */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto z-[60] transition-[right] duration-300">
        {/* Canvas Settings Bar */}
        {/* Canvas Settings Bar - Hide in ReadOnly */}
        {!isReadOnly && (
          <div
            className={`relative flex rounded-xl border shadow-lg backdrop-blur pointer-events-auto ${uiTheme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'}`}
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
            <CanvasSettingsBar
              settings={canvasSettings}
              settingsManager={engine.getSettingsManager()}
              theme={uiTheme}
              orientation="vertical"
            />
          </div>
        )}

        {/* Undo/Redo */}
        {/* Undo/Redo - Hide in ReadOnly */}
        {!isReadOnly && (
          <HistoryControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            theme={uiTheme}
            orientation="vertical"
          />
        )}

        {/* Zoom Controls */}
        <ZoomControls
          onZoomIn={() => engine.zoomIn()}
          onZoomOut={() => engine.zoomOut()}
          currentZoom={canvasState.scale}
          theme={uiTheme}
          orientation="vertical"
        />

        {/* Properties Button */}
        {/* Properties Button - Hide in ReadOnly */}
        {!isReadOnly && (
          <div
            className={`flex items-center justify-center rounded-xl border shadow-lg backdrop-blur overflow-hidden ${uiTheme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'}`}
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
            <button
              onClick={() => setIsPropertiesCardOpen(!isPropertiesCardOpen)}
              className={`p-2.5 transition-colors ${isPropertiesCardOpen
                ? uiTheme === 'dark' ? 'bg-[#36C3AD]/20 text-[#36C3AD]' : 'bg-[#36C3AD]/10 text-[#36C3AD]'
                : uiTheme === 'dark' ? 'hover:bg-[#36C3AD]/10 hover:text-[#36C3AD] text-gray-300' : 'hover:bg-gray-50 text-gray-600'
                }`}
              title="Properties"
            >
              <Info size={20} />
            </button>
          </div>
        )}

        {/* Help Button */}
        <div
          className={`flex items-center justify-center rounded-xl border shadow-lg backdrop-blur overflow-hidden ${uiTheme === 'dark' ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'}`}
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
          <button
            // TODO: Pass trigger handler?
            className={`p-2.5 transition-colors ${uiTheme === 'dark' ? 'hover:bg-[#36C3AD]/10 hover:text-[#36C3AD] text-gray-300' : 'hover:bg-gray-50 text-gray-600'}`}
            title="Keyboard Shortcuts & Help"
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </div>

      {/* Properties Card - Positioned to the left of the toolbar */}
      {isPropertiesCardOpen && propertiesData && (
        <div className="absolute bottom-4 right-20 z-[60] animate-in fade-in slide-in-from-right-4 duration-300">
          <PropertiesCard
            data={propertiesData}
            onClose={() => setIsPropertiesCardOpen(false)}
            theme={uiTheme}
          />
        </div>
      )}

      {/* Style Menu - Show for all shapes including freehand, but not ReactShapes (they handle their own styling) */}
      {/* Style Menu - Hide in ReadOnly */}
      {!isReadOnly && (() => {
        const selectedShapes = engine.getDiagramManager().getSelectedShapes()
        // ... rest of logic
        // Need to wrap the inner logic or just don't render.
        // Best to wrap the invocation or return null early.
        // I will replace the block invocation.

        // Don't show StyleMenu if only ReactShapes are selected
        // They handle their own styling internally
        const reactShapeTypes = ['service-card', 'todo-card']
        const nonReactShapes = selectedShapes.filter(s => !reactShapeTypes.includes(s.type))

        if (nonReactShapes.length > 0) {
          return (
            <div
              className="pointer-events-auto"
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
              <StyleMenu
                selectedShapes={selectedShapes}
                canvasState={canvasState}
                containerRect={containerRect}
                isDragging={isDragging}
                isResizing={isResizing}
                onFillColorChange={(color) => engine.setSelectedShapesFillColor(color)}
                onFillOpacityChange={(opacity, skipHistory) => engine.setSelectedShapesFillOpacity(opacity, skipHistory)}
                onStrokeColorChange={(color) => engine.setSelectedShapesStrokeColor(color)}
                onStrokeStyleChange={(style) => engine.setSelectedShapesStrokeStyle(style)}
                onStrokeDrawStyleChange={(style) => engine.setSelectedShapesStrokeDrawStyle(style)}
                onStrokeWidthChange={(width, skipHistory) => engine.setSelectedShapesStrokeWidth(width, skipHistory)}
                onStrokeOpacityChange={(opacity, skipHistory) => engine.setSelectedShapesStrokeOpacity(opacity, skipHistory)}
                onFillStyleChange={(style) => engine.setSelectedShapesFillStyle(style)}
                onFillDrawStyleChange={(style) => engine.setSelectedShapesFillDrawStyle(style)}
                onShapeTypeChange={(type) => engine.setSelectedShapesType(type)}
                onFontFamilyChange={(font) => engine.setSelectedShapesFontFamily(font)}
                onFontSizeChange={(size) => engine.setSelectedShapesFontSize(size)}
                onFontWeightToggle={() => engine.toggleSelectedShapesFontWeight()}
                onFontStyleToggle={() => engine.toggleSelectedShapesFontStyle()}
                onTextDecorationChange={(decoration) => engine.setSelectedShapesTextDecoration(decoration)}
                onListChange={(type) => engine.toggleSelectedShapesList(type)}
                onTextAlignChange={(align) => engine.setSelectedShapesTextAlign(align)}
                onTextJustifyChange={(justify) => engine.setSelectedShapesTextJustify(justify)}
                onTextColorChange={(color) => engine.setSelectedShapesTextColor(color)}
                onConnectorTypeChange={(type) => engine.setSelectedConnectorsType(type)}
                onStartArrowheadChange={(type) => engine.setSelectedConnectorsStartArrowhead(type)}
                onEndArrowheadChange={(type) => engine.setSelectedConnectorsEndArrowhead(type)}
                onToggleFlowAnimation={() => {
                  const selectedShapes = engine.getDiagramManager().getSelectedShapes()
                  const connectors = selectedShapes.filter(s => s.type === 'connector') as ConnectorShape[]

                  if (connectors.length === 0) return

                  // Check if all are currently animated
                  const allAnimated = connectors.every(c => c.animated)
                  const newState = !allAnimated

                  connectors.forEach(c => {
                    c.setAnimated(newState)
                    // Force update handles if selection bounds change (optional, but good practice)
                  })

                  // Trigger history record
                  engine.recordHistory(true)

                  // Force re-render
                  setShapesVersion(v => v + 1)
                }}

                onFreehandMarkerTypeChange={(type) => engine.setSelectedFreehandShapesMarkerType(type)}
                onFreehandStrokeColorChange={(color) => engine.setSelectedFreehandShapesStrokeColor(color)}
                onFreehandStrokeWidthChange={(width, skipHistory) => engine.setSelectedFreehandShapesStrokeWidth(width, skipHistory)}
                onFreehandStrokeOpacityChange={(opacity, skipHistory) => engine.setSelectedFreehandShapesStrokeOpacity(opacity, skipHistory)}
                onAlignLeft={() => engine.alignLeft()}
                onAlignCenter={() => engine.alignCenter()}
                onAlignRight={() => engine.alignRight()}
                onAlignTop={() => engine.alignTop()}
                onAlignMiddle={() => engine.alignMiddle()}
                onAlignBottom={() => engine.alignBottom()}
                onFrameRename={() => {
                  const selectedShapes = engine.getDiagramManager().getSelectedShapes()
                  const frameShape = selectedShapes.find(s => s.type === 'frame')
                  if (frameShape) {
                    // Import dynamically cast to avoid circular dependency
                    const frame = frameShape as any
                    if (frame.startLabelEditing) {
                      frame.startLabelEditing(() => {
                        engine.recordHistory()
                        setShapesVersion(v => v + 1)
                      })
                    }
                  }
                }}
                onToggleIcon={() => {
                  const selectedShapes = engine.getDiagramManager().getSelectedShapes()
                  let changed = false
                  selectedShapes.forEach(s => {
                    if (s.type === 'rectangle') {
                      const rect = s as any
                      if (typeof rect.hasIconPlaceholder !== 'undefined') {
                        rect.hasIconPlaceholder = !rect.hasIconPlaceholder
                        s.state.needsRender = true
                        changed = true
                      } else {
                        // Initialize if undefined (though constructor sets it)
                        rect.hasIconPlaceholder = true
                        s.state.needsRender = true
                        changed = true
                      }
                    }
                  })
                  if (changed) {
                    engine.recordHistory()
                    setShapesVersion(v => v + 1)
                  }
                }}
                onRecordHistory={() => engine.recordHistory(true)}
                theme={uiTheme}
              />
            </div>
          )
        }
        return null
      })()}

      {/* Context Menu - Hide in ReadOnly */}
      {!isReadOnly && contextMenu && (
        <div
          className="pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={contextMenuOptions}
            onClose={() => setContextMenu(null)}
            theme={uiTheme}
            containerRect={containerRect}
          />
        </div>
      )}
    </div>
  );
};
