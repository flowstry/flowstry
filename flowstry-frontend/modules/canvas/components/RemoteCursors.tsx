import React from 'react';
import type { UserPresence } from '../types/collaboration';

interface RemoteCursorsProps {
  users: UserPresence[];
  canvasScale: number;
  canvasTranslation: { x: number; y: number };
}

/**
 * RemoteCursors component
 * Displays cursors for other users in the collaboration session
 */
export const RemoteCursors: React.FC<RemoteCursorsProps> = ({
  users,
  canvasScale,
  canvasTranslation,
}) => {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 1000,
      }}
    >
      {users.map((user) => {
        if (!user.cursor) return null;

        // Transform cursor position to screen coordinates
        const screenX = user.cursor.x * canvasScale + canvasTranslation.x;
        const screenY = user.cursor.y * canvasScale + canvasTranslation.y;

        // Extract first name from display name
        const firstName = user.displayName.split(' ')[0];

        return (
          <g
            key={user.userId}
            style={{
              transition: 'transform 0.1s ease-out',
              transform: `translate(${screenX}px, ${screenY}px)`,
            }}
          >
            {/* Cursor pointer (arrow) */}
            <path
              d="M0 0 L0 16 L4 12 L7 18 L9 17 L6 11 L12 11 Z"
              fill={user.color}
              stroke="white"
              strokeWidth="1"
              strokeLinejoin="round"
            />

            {/* User name label */}
            <g transform="translate(12, 2)">
              <rect
                x="0"
                y="0"
                rx="4"
                ry="4"
                height="20"
                width={`${firstName.length * 7 + 12}`}
                fill={user.color}
                opacity="0.95"
              />
              <text
                x="6"
                y="14"
                fill="white"
                fontSize="12"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
                style={{ userSelect: 'none' }}
              >
                {firstName}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
