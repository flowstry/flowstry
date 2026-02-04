'use client'
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

export interface MenuAction {
  label?: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  checked?: boolean
  separator?: boolean
  submenu?: MenuAction[]
}

export interface MenuCategory {
  label: string
  items: MenuAction[]
}

interface MainMenuProps {
  theme: 'light' | 'dark'
  filename: string
  onFilenameChange: (name: string) => void
  categories: MenuCategory[]
  onClose?: () => void
  /** Injectable menu items that appear at the top (before File menu) */
  topMenuItems?: MenuAction[]
  /** Injectable menu items that appear at the bottom (before Help and account) */
  bottomMenuItems?: MenuAction[]
}

// Submenu component for nested menus
const Submenu: React.FC<{
  items: MenuAction[]
  theme: 'light' | 'dark'
  onClose: () => void
  onAction: () => void
}> = ({ items, theme, onClose, onAction }) => {
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null)

  return (
    <div className="py-1">
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${index}`}
              className={`my-1 h-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
            />
          )
        }

        const hasSubmenu = item.submenu && item.submenu.length > 0

        return (
          <div
            key={index}
            className="relative"
            onMouseEnter={() => setActiveSubmenu(hasSubmenu ? index : null)}
          >
            <button
              type="button"
              onClick={() => {
                if (!hasSubmenu && item.onClick && !item.disabled) {
                  item.onClick()
                  onAction()
                  onClose()
                }
              }}
              disabled={item.disabled}
              className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center justify-between gap-8 transition-colors ${
                item.disabled
                  ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-200 hover:text-white'
                    : 'text-gray-800 hover:text-white'
              }`}
              onMouseEnter={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '#36C3AD')}
              onMouseLeave={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '')}
            >
              <div className="flex items-center gap-2">
                {item.checked !== undefined && (
                  <span className="w-4 flex items-center justify-center">
                    {item.checked && (
                      <Check size={12} />
                    )}
                  </span>
                )}
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.shortcut && (
                  <span className={`text-xs ${
                    item.disabled
                      ? theme === 'dark' ? 'text-gray-700' : 'text-gray-300'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    {item.shortcut}
                  </span>
                )}
                {hasSubmenu && (
                  <ChevronRight size={12} />
                )}
              </div>
            </button>

            {/* Nested submenu */}
            {hasSubmenu && activeSubmenu === index && (
              <div
                className={`absolute left-full top-0 ml-2 min-w-[200px] rounded-lg border shadow-xl ${
                  theme === 'dark'
                    ? 'bg-[#1A1A1F] border-gray-700'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Submenu
                  items={item.submenu!}
                  theme={theme}
                  onClose={onClose}
                  onAction={onAction}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const MainMenu: React.FC<MainMenuProps> = ({
  theme,
  filename,
  onFilenameChange,
  categories,
  onClose,
  topMenuItems = [],
  bottomMenuItems = []
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setActiveCategory(null)
      }
    }

    // Use both mousedown and pointerdown to ensure we catch all click types
    // Use capture phase to catch events before they're handled by other elements
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('pointerdown', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('pointerdown', handleClickOutside, true)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setActiveCategory(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Keyboard shortcut for opening menu (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    setActiveCategory(null)
    onClose?.()
  }

  // Separate categories into primary and secondary
  const primaryCategories = categories.filter(c => 
    ['File', 'Edit', 'View', 'Object', 'Text', 'Arrange'].includes(c.label)
  )
  const secondaryCategories = categories.filter(c => 
    ['Plugins', 'Widgets', 'Preferences'].includes(c.label)
  )
  const tertiaryCategories = categories.filter(c => 
    ['AI balance', 'Help and account'].includes(c.label)
  )

  return (
    <div className="relative flex items-center gap-3">
      {/* Logo Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-all flex items-center gap-1 ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
        style={isOpen ? { backgroundColor: 'rgba(54, 195, 173, 0.2)' } : undefined}
      >
        {/* Logo Image */}
        <img 
          src={theme === 'dark' ? '/MainLightLogo.svg' : '/MainDarkLogo.svg'} 
          alt="Flowstry Logo" 
          width="24" 
          height="16"
          style={{ objectFit: 'contain' }}
        />
        {/* Dropdown indicator */}
        <ChevronDown size={12} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          data-ui-control
          className={`absolute top-full left-0 mt-2 min-w-[240px] rounded-xl border shadow-2xl backdrop-blur-xl z-[100] ${
            theme === 'dark'
              ? 'bg-[#1A1A1F]/95 border-gray-700'
              : 'bg-white/95 border-gray-200'
          }`}
        >
          {/* Search Bar */}
          <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <Search size={14} className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Actions..."
              className={`flex-1 bg-transparent outline-none text-sm ${
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              }`}
            />
            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              ⌘K
            </span>
          </div>

          {/* Injectable Top Menu Items */}
          {topMenuItems.length > 0 && (
            <>
              <div className="py-1" onMouseEnter={() => setActiveCategory(null)}>
                {topMenuItems.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    type="button"
                    onClick={() => {
                      if (item.onClick && !item.disabled) {
                        item.onClick()
                        handleClose()
                      }
                    }}
                    disabled={item.disabled}
                    className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors ${
                      item.disabled
                        ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'text-gray-200 hover:text-white'
                          : 'text-gray-800 hover:text-white'
                      }`}
                    onMouseEnter={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '#36C3AD')}
                    onMouseLeave={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '')}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className={`h-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </>
          )}
          <div className="py-1">
            {primaryCategories.map((category, catIndex) => (
              <div
                key={catIndex}
                className="relative"
                onMouseEnter={() => setActiveCategory(catIndex)}
              >
                <button
                  type="button"
                  className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center justify-between transition-colors ${
                    activeCategory === catIndex
                      ? 'text-white'
                      : theme === 'dark'
                        ? 'text-gray-200'
                        : 'text-gray-800'
                  }`}
                  style={activeCategory === catIndex ? { backgroundColor: '#36C3AD' } : undefined}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#36C3AD'}
                  onMouseLeave={(e) => activeCategory !== catIndex && (e.currentTarget.style.backgroundColor = '')}
                >
                  <span>{category.label}</span>
                  {category.items.length > 0 && (
                    <ChevronRight size={12} />
                  )}
                </button>

                {/* Submenu */}
                {activeCategory === catIndex && category.items.length > 0 && (
                  <div
                    className={`absolute left-full top-0 ml-2 min-w-[220px] rounded-lg border shadow-xl ${
                      theme === 'dark'
                        ? 'bg-[#1A1A1F] border-gray-700'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Submenu
                      items={category.items}
                      theme={theme}
                      onClose={handleClose}
                      onAction={() => {}}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Separator */}
          {secondaryCategories.length > 0 && (
            <div className={`h-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
          )}

          {/* Secondary Menu Categories */}
          <div className="py-1">
            {secondaryCategories.map((category, catIndex) => {
              const adjustedIndex = primaryCategories.length + catIndex
              return (
                <div
                  key={adjustedIndex}
                  className="relative"
                  onMouseEnter={() => setActiveCategory(adjustedIndex)}
                >
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center justify-between transition-colors ${
                      activeCategory === adjustedIndex
                        ? 'text-white'
                        : theme === 'dark'
                          ? 'text-gray-200'
                          : 'text-gray-800'
                    }`}
                    style={activeCategory === adjustedIndex ? { backgroundColor: '#36C3AD' } : undefined}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#36C3AD'}
                    onMouseLeave={(e) => activeCategory !== adjustedIndex && (e.currentTarget.style.backgroundColor = '')}
                  >
                    <span>{category.label}</span>
                    {category.items.length > 0 && (
                      <ChevronRight size={12} />
                    )}
                  </button>

                  {/* Submenu */}
                  {activeCategory === adjustedIndex && category.items.length > 0 && (
                    <div
                      className={`absolute left-full top-0 ml-2 min-w-[220px] rounded-lg border shadow-xl ${
                        theme === 'dark'
                          ? 'bg-[#1A1A1F] border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Submenu
                        items={category.items}
                        theme={theme}
                        onClose={handleClose}
                        onAction={() => {}}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Injectable Bottom Menu Items */}
          {bottomMenuItems.length > 0 && (
            <>
              <div className="py-1" onMouseEnter={() => setActiveCategory(null)}>
                {bottomMenuItems.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    type="button"
                    onClick={() => {
                      if (item.onClick && !item.disabled) {
                        item.onClick()
                        handleClose()
                      }
                    }}
                    disabled={item.disabled}
                    className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors ${
                      item.disabled
                        ? theme === 'dark' ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'text-gray-200 hover:text-white'
                          : 'text-gray-800 hover:text-white'
                      }`}
                    onMouseEnter={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '#36C3AD')}
                    onMouseLeave={(e) => !item.disabled && (e.currentTarget.style.backgroundColor = '')}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className={`h-px mx-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
            </>
          )}

          {/* Tertiary Menu Categories */}
          <div className="py-1">
            {tertiaryCategories.map((category, catIndex) => {
              const adjustedIndex = primaryCategories.length + secondaryCategories.length + catIndex
              return (
                <div
                  key={adjustedIndex}
                  className="relative"
                  onMouseEnter={() => setActiveCategory(adjustedIndex)}
                >
                  <button
                    type="button"
                    className={`w-full px-3 py-1.5 text-left text-[13px] flex items-center justify-between transition-colors ${
                      activeCategory === adjustedIndex
                        ? 'text-white'
                        : theme === 'dark'
                          ? 'text-gray-200'
                          : 'text-gray-800'
                    }`}
                    style={activeCategory === adjustedIndex ? { backgroundColor: '#36C3AD' } : undefined}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#36C3AD'}
                    onMouseLeave={(e) => activeCategory !== adjustedIndex && (e.currentTarget.style.backgroundColor = '')}
                  >
                    <span>{category.label}</span>
                    {category.items.length > 0 && (
                      <ChevronRight size={12} />
                    )}
                  </button>

                  {/* Submenu */}
                  {activeCategory === adjustedIndex && category.items.length > 0 && (
                    <div
                      className={`absolute left-full top-0 ml-2 min-w-[220px] rounded-lg border shadow-xl ${
                        theme === 'dark'
                          ? 'bg-[#1A1A1F] border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Submenu
                        items={category.items}
                        theme={theme}
                        onClose={handleClose}
                        onAction={() => {}}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}


    </div>
  )
}
