import React from 'react';
import { MAX_SCALE, MIN_SCALE } from '../consts/canvas';

interface ZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    currentZoom: number;
    theme: 'light' | 'dark';
    orientation?: 'vertical' | 'horizontal';
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
    onZoomIn,
    onZoomOut,
    currentZoom,
    theme,
    orientation = 'vertical'
}) => {
    const isDark = theme === 'dark';
    const isVertical = orientation === 'vertical';
    const canZoomIn = currentZoom < MAX_SCALE;
    const canZoomOut = currentZoom > MIN_SCALE;

    const containerClasses = [
        'flex items-center overflow-hidden rounded-xl border shadow-lg backdrop-blur',
        isVertical ? 'flex-col' : 'flex-row-reverse', // Zoom In often on right/top
        isDark ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'
    ].join(' ');

    const buttonBaseClasses = `p-2.5 transition-colors ${
        isDark 
        ? 'text-gray-300 disabled:text-gray-600 hover:enabled:bg-[#36C3AD]/10 hover:enabled:text-[#36C3AD]' 
        : 'text-gray-600 disabled:text-gray-300 hover:enabled:bg-gray-50'
    }`;

    // Separator border logic based on orientation
    const zoomInBorder = isVertical ? 'border-b' : 'border-l';
    const zoomInBorderColor = isDark ? 'border-gray-700' : 'border-gray-200';
    const zoomInClasses = `${buttonBaseClasses} ${zoomInBorder} ${zoomInBorderColor}`;

    return (
        <div 
            className={containerClasses}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={onZoomIn}
                disabled={!canZoomIn}
                className={zoomInClasses}
                title="Zoom In"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>
            <button
                onClick={onZoomOut}
                disabled={!canZoomOut}
                className={buttonBaseClasses}
                title="Zoom Out"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                </svg>
            </button>
        </div>
    );
};
