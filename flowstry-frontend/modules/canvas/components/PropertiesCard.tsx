import React, { useState } from 'react';

export interface PropertiesCardData {
  version: string;
  buildDate: string;
  commit: string;
  storage: {
    scene: string; // e.g. "1.6M"
    total: string; // e.g. "1.6M"
  };
  scene: {
    shapes: number;
    width: number;
    height: number;
  };
}

export interface PropertiesCardProps {
  data: PropertiesCardData;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const PropertiesCard: React.FC<PropertiesCardProps> = ({ data, onClose, theme }) => {
  const [isGeneralOpen, setIsGeneralOpen] = useState(true);

  const bgColor = theme === 'dark' ? 'bg-[#1A1A1F]' : 'bg-white/90';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const textColor = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  const subTextColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const headerTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';

  return (
    <div
      className={`w-64 rounded-xl border shadow-lg backdrop-blur overflow-hidden pointer-events-auto flex flex-col ${bgColor} ${borderColor}`}
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-transparent">
        <h3 className={`font-semibold ${textColor}`}>Properties</h3>
        <button
          onClick={onClose}
          className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${subTextColor}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* General Section */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setIsGeneralOpen(!isGeneralOpen)}
            className={`flex items-center justify-between w-full py-2 mb-2 text-sm font-medium ${headerTextColor} hover:text-opacity-80`}
          >
            <span>General</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transform transition-transform ${isGeneralOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {isGeneralOpen && (
            <div className="space-y-4 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Version */}
              <div className="text-center py-2">
                <div className={`font-medium mb-1 ${subTextColor}`}>Version</div>
                <div className={textColor}>{data.buildDate}</div>
                <div className={`${subTextColor} text-xs font-mono mt-0.5`}>{data.commit}</div>
              </div>

              {/* Storage Stats */}
              <div>
                <div className={`font-medium mb-2 text-center ${subTextColor}`}>Storage</div>
                <div className="flex justify-between items-center mb-1">
                  <span className={subTextColor}>Scene</span>
                  <span className={textColor}>{data.storage.scene}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={subTextColor}>Total</span>
                  <span className={textColor}>{data.storage.total}</span>
                </div>
              </div>

              {/* Scene Stats */}
              <div>
                <div className={`font-medium mb-2 text-center ${subTextColor}`}>Scene</div>
                <div className="flex justify-between items-center mb-1">
                  <span className={subTextColor}>Shapes</span>
                  <span className={textColor}>{data.scene.shapes}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className={subTextColor}>Width</span>
                  <span className={textColor}>{data.scene.width}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={subTextColor}>Height</span>
                  <span className={textColor}>{data.scene.height}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
