import React, { useEffect, useRef, useState } from 'react';
import type { UserPresence } from '../types/collaboration';

interface ActiveUsersProps {
  users: UserPresence[];
  currentUserId: string | null;
  currentUser?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  theme: 'light' | 'dark';
}

/**
 * ActiveUsers component
 * Shows active remote collaborators with overlapping avatars
 * Clicking opens a popover showing all remote users
 */
export const ActiveUsers: React.FC<ActiveUsersProps> = ({
  users,
  currentUserId,
  currentUser,
  theme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Filter out current user - only show remote users
  const resolvedCurrentUserId = currentUser?.id || currentUserId;
  const remoteUsers = users.filter((u) => u.userId !== resolvedCurrentUserId);
  const currentUserPresence = currentUser
    ? {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        color: currentUser.color || '#36C3AD',
        avatarUrl: currentUser.avatarUrl || undefined,
      }
    : null;
  const allUsers = currentUserPresence ? [currentUserPresence, ...remoteUsers] : remoteUsers;

  const visibleUsers = allUsers.slice(0, 5);
  const stackUsers = [
    ...visibleUsers.filter((user) => user.userId === resolvedCurrentUserId),
    ...visibleUsers.filter((user) => user.userId !== resolvedCurrentUserId),
  ];
  const overflowCount = Math.max(0, allUsers.length - 5);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsExpanded(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (allUsers.length === 0) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative">
      {/* Clickable avatar stack */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center flex-row-reverse sm:flex-row cursor-pointer transition-transform hover:scale-105"
        title={`${allUsers.length} active ${allUsers.length === 1 ? 'user' : 'users'}`}
      >
        {stackUsers.map((user, index) => {
          const initials = getInitials(user.displayName);

          return (
            <div
              key={user.userId}
              className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold transition-all hover:z-20 hover:scale-110 overflow-hidden ${index === 0 ? '' : '-mr-[19px] sm:mr-0 sm:-ml-[19px]'
                }`}
              style={{
                backgroundColor: user.color,
                borderColor: theme === 'dark' ? '#1A1A1F' : '#fff',
                zIndex: stackUsers.length - index,
              }}
              title={user.displayName}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          );
        })}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div
            className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold -mr-[19px] sm:mr-0 sm:-ml-[19px] ${
              theme === 'dark'
                ? 'bg-gray-700 text-gray-300 border-[#1A1A1F]'
                : 'bg-gray-200 text-gray-700 border-white'
            }`}
            style={{ zIndex: 0 }}
            title={`${overflowCount} more`}
          >
            +{overflowCount}
          </div>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute right-0 top-full mt-2 w-64 rounded-lg shadow-lg border z-9999 ${
            theme === 'dark'
              ? 'bg-[#1A1A1F] border-gray-700'
              : 'bg-white border-gray-200'
          }`}
          style={{ maxHeight: '400px' }}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Active Users ({allUsers.length})
            </h3>
          </div>

          {/* Scrollable user list */}
          <div className="max-h-[320px] overflow-y-auto py-2">
            {(isExpanded ? allUsers : allUsers.slice(0, 5)).map((user) => {
              const initials = getInitials(user.displayName);

              return (
                <div
                  key={user.userId}
                  className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {user.displayName}
                    </p>
                  </div>

                  {/* Online indicator */}
                  <div className="shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-500" title="Online" />
                  </div>
                </div>
              );
            })}
            {allUsers.length > 5 && (
              <div className="px-4 py-2">
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isExpanded ? 'Show less' : `Show all (${allUsers.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
