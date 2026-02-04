'use client'
import React, { useEffect, useRef, useState } from 'react'

interface AccountBarProps {
  theme: 'light' | 'dark'
  isAuthenticated?: boolean
  user?: {
    name?: string
    email?: string
    avatarUrl?: string
  }
  onSignInClick?: () => void
  onSignOutClick?: () => void
  onWorkspacesClick?: () => void
}

export const AccountBar: React.FC<AccountBarProps> = ({
  theme,
  isAuthenticated = false,
  user,
  onSignInClick,
  onSignOutClick,
  onWorkspacesClick
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const handleSignOut = () => {
    setIsDropdownOpen(false)
    onSignOutClick?.()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Workspaces Button */}
      <button
        onClick={onWorkspacesClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          theme === 'dark'
            ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {/* Grid icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span className="hidden sm:inline">Workspaces</span>
      </button>

      {/* User / Sign In */}
      {isAuthenticated && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center justify-center w-8 h-8 rounded-full overflow-hidden border-2 transition-colors ${theme === 'dark'
              ? 'border-gray-600 hover:border-[#36C3AD]'
              : 'border-gray-200 hover:border-[#36C3AD]'
              } ${isDropdownOpen ? 'border-[#36C3AD]' : ''}`}
            title={user.name || user.email || 'Account'}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center text-sm font-semibold ${theme === 'dark' ? 'bg-[#36C3AD] text-zinc-900' : 'bg-[#36C3AD] text-zinc-900'
                  }`}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className={`absolute top-full right-0 mt-2 w-56 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden z-[100] ${theme === 'dark'
                ? 'bg-[#1A1A1F]/95 border-gray-700'
                : 'bg-white/95 border-gray-200'
                }`}
            >
              {/* User Info */}
              <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {user.name || 'User'}
                </p>
                <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {user.email}
                </p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false)
                    onWorkspacesClick?.()
                  }}
                  className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition-colors ${theme === 'dark'
                      ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  My Workspaces
                </button>
              </div>

              {/* Sign Out */}
              <div className={`py-1 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  onClick={handleSignOut}
                  className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition-colors ${theme === 'dark'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-red-600 hover:bg-red-50'
                    }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onSignInClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#36C3AD] hover:bg-[#2eb39e] text-zinc-900 text-sm font-semibold transition-colors"
        >
          {/* Log in icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span>Sign In</span>
        </button>
      )}
    </div>
  )
}
