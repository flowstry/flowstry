import React, { useEffect, useRef } from 'react';

export interface ContextMenuOption {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
  danger?: boolean; // For destructive actions like delete
}

export interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
  theme: 'light' | 'dark';
  containerRect: DOMRect | null;
}

// Calculate adjusted position to keep menu within container bounds
function calculateAdjustedPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding: number = 10
): { x: number; y: number } {
  let adjustedX = x;
  let adjustedY = y;

  // Check if menu would overflow right edge of container
  if (x + menuWidth + padding > containerWidth) {
    adjustedX = containerWidth - menuWidth - padding;
  }

  // Check if menu would overflow bottom edge of container
  if (y + menuHeight + padding > containerHeight) {
    adjustedY = containerHeight - menuHeight - padding;
  }

  // Ensure we don't go off the left/top edges
  if (adjustedX < padding) adjustedX = padding;
  if (adjustedY < padding) adjustedY = padding;

  return { x: adjustedX, y: adjustedY };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose, theme, containerRect }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle clicks outside the menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Calculate position after render when we have the menu dimensions
  React.useLayoutEffect(() => {
    if (menuRef.current && containerRect) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjusted = calculateAdjustedPosition(
        x,
        y,
        rect.width,
        rect.height,
        containerRect.width,
        containerRect.height
      );
      setPosition(adjusted);
    }
  }, [x, y, containerRect]);

  const handleOptionClick = async (option: ContextMenuOption) => {
    if (!option.disabled && !option.separator) {
      await option.onClick();
      onClose();
    }
  };

  // Use absolute positioning relative to Canvas container
  return (
    <div
      ref={menuRef}
      data-context-menu="true"
      className={`absolute z-[60] min-w-[200px] rounded-md border shadow-lg ${theme === 'dark'
          ? 'bg-gray-900 border-gray-700'
          : 'bg-white border-gray-300'
        }`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="py-1">
        {options.map((option, index) => {
          if (option.separator) {
            return (
              <div
                key={`separator-${index}`}
                className={`my-1 h-px ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
              />
            );
          }

          return (
            <button
              key={index}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOptionClick(option);
              }}
              disabled={option.disabled}
              className={`
                w-full px-3 py-2 text-left text-sm flex items-center justify-between
                pointer-events-auto
                ${option.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : option.danger
                    ? 'text-red-600 hover:bg-red-50 cursor-pointer'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-800 cursor-pointer'
                    : 'text-gray-900 hover:bg-gray-100 cursor-pointer'
                }
              `}
            >
              <span>{option.label}</span>
              {option.shortcut && (
                <span className={`ml-4 text-xs ${option.disabled
                    ? 'text-gray-300'
                    : option.danger
                      ? 'text-red-400'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                  {option.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

