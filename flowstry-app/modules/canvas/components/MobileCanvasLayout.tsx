'use client'

import React, { useEffect, useState } from 'react';
import { ConnectorShape } from '../shapes/connectors';
import { CanvasUIProps } from '../types';
import { BottomToolbar } from './BottomToolbar';
import { ContextMenu } from './ContextMenu';
import { LibraryPanel } from './LibraryPanel';
import { MainMenu } from './MainMenu';
import { MobileOverlayControls } from './MobileOverlayControls';
import { Sidebar } from './Sidebar';
import { StyleMenu } from './StyleMenu';
import { ViewerModeToggle } from './ViewerModeToggle';

export const MobileCanvasLayout: React.FC<CanvasUIProps> = ({
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
  isPropertiesCardOpen,
  setIsPropertiesCardOpen,
  propertiesData,
  contextMenu,
  setContextMenu,
  contextMenuOptions,
  containerRect,
  canvasState,
  isDragging,
  isResizing,
  setShapesVersion,
  canvasSettings,
  canUndo,
  canRedo,
  isReadOnly,
  onViewerModeToggle,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (isReadOnly) {
      setActiveSection(null);
    }
  }, [isReadOnly]);

  return (
    <div className="fixed inset-0 h-[100dvh] z-50 pointer-events-none flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className={`flex-none h-12 backdrop-blur border-b flex items-center px-3 pointer-events-auto z-[60] ${
        uiTheme === 'dark' ? 'bg-[#1A1A1F]/95 border-gray-700' : 'bg-white/95 border-gray-200'
      }`}>
        <MainMenu
          theme={uiTheme}
          filename={filename}
          onFilenameChange={setFilename}
          categories={menuCategories}
          topMenuItems={topMenuItems}
          bottomMenuItems={bottomMenuItems}
        />

        {/* Core Canvas Header */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ViewerModeToggle
            theme={uiTheme}
            isReadOnly={isReadOnly}
            onToggle={onViewerModeToggle}
            showLabel={false}
          />

          {renderBreadcrumb && renderBreadcrumb({ theme: uiTheme })}

          {renderUserMenu && (
            <div className="ml-auto flex items-center">
              {renderUserMenu({ theme: uiTheme })}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Toolbar (Re-integrated) */}
      <MobileOverlayControls
        engine={engine}
        theme={uiTheme}
        canvasSettings={canvasSettings}
        canUndo={canUndo}
        canRedo={canRedo}
        scale={canvasState.scale}
        isReadOnly={isReadOnly}
      />

      {/* Canvas Area with Sidebar */}
      <div className="flex-1 relative">
        {/* Style Menu */}
        {(() => {
          const selectedShapes = engine.getDiagramManager().getSelectedShapes();
          const reactShapeTypes = ['service-card', 'todo-card'];
          const nonReactShapes = selectedShapes.filter(s => !reactShapeTypes.includes(s.type));

          if (nonReactShapes.length > 0) {
            return (
              <div
                className="fixed left-0 w-full z-[55] pointer-events-auto overflow-visible"
                style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex justify-start overflow-x-auto no-scrollbar touch-pan-x">
                  <StyleMenu
                    isMobile={true}
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
                      const shapes = engine.getDiagramManager().getSelectedShapes();
                      const connectors = shapes.filter(s => s.type === 'connector') as ConnectorShape[];
                      if (connectors.length === 0) return;
                      const allAnimated = connectors.every(c => c.animated);
                      connectors.forEach(c => c.setAnimated(!allAnimated));
                      engine.recordHistory(true);
                      setShapesVersion(v => v + 1);
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
                      const shapes = engine.getDiagramManager().getSelectedShapes();
                      const frameShape = shapes.find(s => s.type === 'frame');
                      if (frameShape) {
                        const frame = frameShape as any;
                        if (frame.startLabelEditing) {
                          frame.startLabelEditing(() => {
                            engine.recordHistory();
                            setShapesVersion(v => v + 1);
                          });
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
              </div>
            );
          }
          return null;
        })()}

        {/* Sidebar - Uses the same flyouts as desktop (with search, categories, all icons) */}
        {!isReadOnly && (
          <div className="absolute inset-y-0 left-0 pointer-events-auto z-[65]">
            <Sidebar
              isOpen={true}
              activeTool={activeTool}
              selectedShapeType={selectedShapeType}
              selectedConnectorType={selectedConnectorType}
              selectedMarkerType={selectedMarkerType}
              onToolChange={(tool) => engine.activateTool(tool)}
              onShapeTypeChange={(type) => {
                setSelectedShapeType(type);
                engine.setDrawingShapeType(type);
              }}
              onIconSelect={(path) => handleIconSelect(path)}
              onConnectorSelect={(type) => {
                setSelectedConnectorType(type);
                engine.setConnectorType(type);
              }}
              onPencilSelect={(type) => handlePencilSelect(type)}
              onServiceCardSelect={() => handleServiceCardSelect()}
              onTodoCardSelect={() => handleTodoCardSelect()}
              theme={uiTheme}
              containerRef={containerRef}
              activeSection={activeSection}
              onSectionSelect={setActiveSection}
              onTogglePalette={onTogglePalette}
              isPaletteOpen={isPaletteOpen}
              onApplyPalette={onApplyPalette}
              activePaletteId={activePaletteId}
              dockLeft={true}
              drawStyle={(() => {
                const selectedShapes = engine.getDiagramManager().getSelectedShapes()
                const defaultAppearance = engine.getSettingsManager().getSettings().defaultShapeAppearance || {}
                return selectedShapes.length > 0
                  ? selectedShapes[0].appearance.drawStyle
                  : defaultAppearance.drawStyle || 'standard'
              })()}
              onToggleDrawStyle={() => {
                const selectedShapes = engine.getDiagramManager().getSelectedShapes()
                const defaultAppearance = engine.getSettingsManager().getSettings().defaultShapeAppearance || {}
                const currentStyle = selectedShapes.length > 0
                  ? selectedShapes[0].appearance.drawStyle
                  : defaultAppearance.drawStyle || 'standard'
                const newStyle = currentStyle === 'standard' ? 'handdrawn' : 'standard'

                engine.getDiagramManager().setDrawStyle(newStyle)
                engine.getSettingsManager().setDefaultShapeAppearance({
                  drawStyle: newStyle,
                  fillDrawStyle: newStyle,
                  strokeDrawStyle: newStyle
                })
                engine.recordHistory(true)
                setShapesVersion(v => v + 1)
              }}
            />
          </div>
        )}

        {!isReadOnly && (
          <LibraryPanel
            isOpen={!!activeSection}
            onIconSelect={handleIconSelect}
            activeSection={activeSection}
            theme={uiTheme}
            onClose={() => setActiveSection(null)}
            dockLeft={true}
          />
        )}
      </div>

      {/* Bottom Bar - Uses BottomToolbar component + Library & Settings */}
      <div 
        className={`flex-none min-h-[3.5rem] h-auto pb-[env(safe-area-inset-bottom)] backdrop-blur border-t flex items-center gap-2 px-3 pointer-events-auto z-[60] overflow-x-auto [&::-webkit-scrollbar]:hidden ${
          uiTheme === 'dark' ? 'bg-[#1A1A1F]/95 border-gray-700' : 'bg-white/95 border-gray-200'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* BottomToolbar - Same as desktop */}
        <BottomToolbar
          activeTool={activeTool}
          selectedShapeType={selectedShapeType}
          selectedConnectorType={selectedConnectorType}
          selectedMarkerType={selectedMarkerType}
          onToolChange={(tool) => engine.activateTool(tool)}
          onShapeTypeChange={(type) => {
            setSelectedShapeType(type);
            engine.setDrawingShapeType(type);
          }}
          onConnectorSelect={(type) => {
            setSelectedConnectorType(type);
            engine.setConnectorType(type);
          }}
          onPencilSelect={(type) => handlePencilSelect(type)}
          onFrameSelect={() => handleFrameSelect()}
          theme={uiTheme}
          containerRef={containerRef}
          embedded={true}
          isReadOnly={isReadOnly}
        />

      </div>



      {/* Backdrop when sidebar is open */}
      {/* Floating Overlays */}
      <div className="absolute inset-0 pointer-events-none z-[70]">

        {!isReadOnly && contextMenu && (
          <div
            className="absolute inset-0 pointer-events-auto z-[80]"
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
    </div>
  );
};
