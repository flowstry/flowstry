/**
 * RemoteSelections Component
 * 
 * Renders selection borders for shapes selected by other users
 */

import React from 'react';
import type { UserPresence } from '../types/collaboration';

interface RemoteSelectionsProps {
  remoteUsers: UserPresence[];
  canvasScale: number;
  canvasTranslation: { x: number; y: number };
}

export const RemoteSelections: React.FC<RemoteSelectionsProps> = ({
  remoteUsers,
  canvasScale,
  canvasTranslation,
}) => {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50, // Below cursors but above canvas
        overflow: 'visible'
      }}
    >
      <g transform={`translate(${canvasTranslation.x}, ${canvasTranslation.y}) scale(${canvasScale})`}>
        {remoteUsers.map((user) => {
          if (!user.selection?.shapeIds || user.selection.shapeIds.length === 0) {
            return null;
          }

          return user.selection.shapeIds.map((shapeId) => {
            const shapeElement = document.querySelector(`[data-shape-id="${shapeId}"]`);
            if (!shapeElement) return null;

            // We need to be careful here - if the shape is not rendered yet, querySelector might fail
            const bbox = (shapeElement as SVGGraphicsElement).getBBox();
            const BORDER_OFFSET = 4; // Pixels of space between shape and selection border
            const BORDER_WIDTH = 2; // Width of the selection border

            // We divide stroke width by scale because this group IS scaled, 
            // so we want the stroke to remain constant width on screen (counter-scaling)
            return (
              <rect
                key={`${user.userId}-${shapeId}`}
                x={bbox.x - BORDER_OFFSET}
                y={bbox.y - BORDER_OFFSET}
                width={bbox.width + BORDER_OFFSET * 2}
                height={bbox.height + BORDER_OFFSET * 2}
                fill="none"
                stroke={user.color}
                strokeWidth={BORDER_WIDTH / canvasScale}
                strokeDasharray={`${6 / canvasScale} ${3 / canvasScale}`}
                pointerEvents="none"
                style={{
                  opacity: 0.8,
                }}
              />
            );
          });
        })}
      </g>
    </svg>
  );
};
