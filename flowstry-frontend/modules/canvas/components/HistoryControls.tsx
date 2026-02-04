import React from 'react';

interface HistoryControlsProps {
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    theme: 'light' | 'dark';
    orientation?: 'vertical' | 'horizontal';
}

export const HistoryControls: React.FC<HistoryControlsProps> = ({
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    theme,
    orientation = 'vertical'
}) => {
    const isDark = theme === 'dark';
    const isVertical = orientation === 'vertical';

    const containerClasses = [
        'flex items-center overflow-hidden rounded-xl border shadow-lg backdrop-blur',
        isVertical ? 'flex-col' : 'flex-row',
        isDark ? 'bg-[#1A1A1F] border-gray-700' : 'bg-white/90 border-gray-200'
    ].join(' ');

    const buttonBaseClasses = `p-2.5 transition-colors ${
        isDark 
        ? 'text-gray-300 disabled:text-gray-600 hover:enabled:bg-[#36C3AD]/10 hover:enabled:text-[#36C3AD]' 
        : 'text-gray-600 disabled:text-gray-300 hover:enabled:bg-gray-50'
    }`;

    // Separator border logic
    const undoBorder = isVertical ? 'border-b' : 'border-r';
    const undoBorderColor = isDark ? 'border-gray-700' : 'border-gray-200';
    const undoClasses = `${buttonBaseClasses} ${undoBorder} ${undoBorderColor}`;

    return (
        <div 
            className={containerClasses}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={undoClasses}
                title="Undo (Cmd+Z)"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                </svg>
            </button>
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={buttonBaseClasses}
                title="Redo (Cmd+Shift+Z)"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
                </svg>
            </button>
        </div>
    );
};
