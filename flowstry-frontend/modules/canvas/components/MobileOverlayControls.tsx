import React from 'react';
import { InteractionEngine } from '../core';
import { CanvasSettings } from '../core/SettingsManager';
import { CanvasSettingsBar } from './CanvasSettingsBar';
import { HistoryControls } from './HistoryControls';
import { ZoomControls } from './ZoomControls';

interface MobileOverlayControlsProps {
  engine: InteractionEngine;
  theme: 'light' | 'dark';
  canvasSettings: CanvasSettings;
  canUndo: boolean;
  canRedo: boolean;
  scale: number;
  isReadOnly?: boolean;
}

export const MobileOverlayControls: React.FC<MobileOverlayControlsProps> = ({
  engine,
  theme,
  canvasSettings,
  canUndo,
  canRedo,
  scale,
  isReadOnly = false,
}) => {
  const isDark = theme === 'dark';
  
  return (
    <div className="absolute top-14 left-0 w-full px-3 z-50 flex items-center justify-between pointer-events-none">
      {/* Left: Canvas Settings */}
      {!isReadOnly && (
        <div className={`pointer-events-auto flex items-center rounded-xl border shadow-lg backdrop-blur overflow-hidden ${
          isDark ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'
        }`}>
          <CanvasSettingsBar
            settings={canvasSettings}
            settingsManager={engine.getSettingsManager()}
            theme={theme}
            orientation="horizontal"
          />
        </div>
      )}

      {/* Right: Tools (Zoom & History) */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Zoom Controls */}
        <ZoomControls
          onZoomIn={() => engine.zoomIn()}
          onZoomOut={() => engine.zoomOut()}
          currentZoom={scale}
          theme={theme}
          orientation="horizontal"
        />

        {/* History Controls */}
        {!isReadOnly && (
          <HistoryControls
            onUndo={() => engine.undo()}
            onRedo={() => engine.redo()}
            canUndo={canUndo}
            canRedo={canRedo}
            theme={theme}
            orientation="horizontal"
          />
        )}
      </div>
    </div>
  );
};
