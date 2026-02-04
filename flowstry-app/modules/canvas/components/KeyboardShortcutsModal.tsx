'use client'
import React, { useEffect, useRef } from 'react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark'
}

// Detect if user is on Mac
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

// Shortcut display helpers
const cmd = isMac ? '⌘' : 'Ctrl'
const shift = isMac ? '⇧' : 'Shift'
const del = isMac ? '⌫' : 'Del'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutCategory {
  title: string
  icon: React.ReactNode
  shortcuts: ShortcutItem[]
}

// Define all shortcuts organized by category
const shortcutCategories: ShortcutCategory[] = [
  {
    title: 'General',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
      </svg>
    ),
    shortcuts: [
      { keys: ['Esc'], description: 'Deselect all / Cancel operation / Switch to Select tool' },
      { keys: ['Enter'], description: 'Start editing text (single shape selected)' },
      { keys: ['Tab'], description: 'Select next shape' },
      { keys: [shift, 'Tab'], description: 'Select previous shape' },
      { keys: ['↑', '↓', '←', '→'], description: 'Move selected shapes / Pan canvas' },
    ]
  },
  {
    title: 'File',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    shortcuts: [
      { keys: [cmd, 'O'], description: 'Open file' },
      { keys: [cmd, 'S'], description: 'Save diagram' },
      { keys: [shift, cmd, 'E'], description: 'Export image' },
    ]
  },
  {
    title: 'Edit',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    shortcuts: [
      { keys: [cmd, 'Z'], description: 'Undo' },
      { keys: [shift, cmd, 'Z'], description: 'Redo' },
      { keys: [cmd, 'C'], description: 'Copy' },
      { keys: [cmd, 'X'], description: 'Cut' },
      { keys: [cmd, 'V'], description: 'Paste' },
      { keys: [cmd, 'D'], description: 'Duplicate' },
      { keys: [shift, cmd, 'R'], description: 'Paste to replace selected' },
      { keys: [shift, cmd, 'C'], description: 'Copy as PNG to clipboard' },
      { keys: [cmd, 'A'], description: 'Select all' },
      { keys: [del], description: 'Delete selected' },
    ]
  },
  {
    title: 'View',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    shortcuts: [
      { keys: [cmd, '+'], description: 'Zoom in' },
      { keys: [cmd, '-'], description: 'Zoom out' },
      { keys: [cmd, '0'], description: 'Reset zoom to 100%' },
      { keys: [shift, '1'], description: 'Zoom to fit content' },
    ]
  },
  {
    title: 'Object',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      </svg>
    ),
    shortcuts: [
      { keys: [']'], description: 'Bring to front' },
      { keys: ['['], description: 'Send to back' },
    ]
  },
  {
    title: 'Text Formatting',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
    shortcuts: [
      { keys: [cmd, 'B'], description: 'Bold' },
      { keys: [cmd, 'I'], description: 'Italic' },
      { keys: [cmd, 'U'], description: 'Underline' },
    ]
  },
]

interface ToolItem {
  name: string
  description: string
  icon: React.ReactNode
}

// Define all tools
const toolCategories: { title: string; tools: ToolItem[] }[] = [
  {
    title: 'Selection & Navigation',
    tools: [
      {
        name: 'Select',
        description: 'Select, move, and resize shapes. Double-click to edit text.',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
        )
      },
      {
        name: 'Pan',
        description: 'Click and drag to pan the canvas. Also use scroll wheel or trackpad.',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        )
      },
    ]
  },
  {
    title: 'Shapes',
    tools: [
      {
        name: 'Rectangle',
        description: 'Draw rectangles. Hold Shift for squares.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      },
      {
        name: 'Ellipse',
        description: 'Draw ellipses. Hold Shift for circles.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="8" /></svg>
      },
      {
        name: 'Diamond',
        description: 'Draw diamond shapes for decision nodes.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L22 12L12 22L2 12Z" /></svg>
      },
      {
        name: 'Triangle',
        description: 'Draw triangles in various orientations.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L22 21H2Z" /></svg>
      },
      {
        name: 'Polygon',
        description: 'Hexagon, Pentagon, and Octagon shapes.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L21 8.5V15.5L12 22L3 15.5V8.5L12 2Z" /></svg>
      },
    ]
  },
  {
    title: 'Connectors',
    tools: [
      {
        name: 'Straight',
        description: 'Direct line between two points.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5" /></svg>
      },
      {
        name: 'Elbow',
        description: 'Right-angle connector with bends.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19V12H19V5" /></svg>
      },
      {
        name: 'Curved',
        description: 'Smooth bezier curve connector.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19C5 12 19 12 19 5" /></svg>
      },
    ]
  },
  {
    title: 'Drawing',
    tools: [
      {
        name: 'Pen',
        description: 'Smooth freehand drawing with consistent width.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>
      },
      {
        name: 'Brush',
        description: 'Variable width brush strokes based on pressure.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" /><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" /></svg>
      },
      {
        name: 'Pencil',
        description: 'Rough pencil-like strokes with texture.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
      },
      {
        name: 'Highlighter',
        description: 'Semi-transparent highlighting strokes.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l-6 6v3h9l3-3" /><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></svg>
      },
      {
        name: 'Laser Pointer',
        description: 'Temporary highlighting for presentations. Strokes fade after a moment.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
      },
    ]
  },
  {
    title: 'Insert',
    tools: [
      {
        name: 'Image',
        description: 'Insert images from your device.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
      },
      {
        name: 'Service Card',
        description: 'Pre-designed card with icon and label for service diagrams.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><line x1="8" y1="16" x2="16" y2="16" /></svg>
      },
      {
        name: 'Todo Card',
        description: 'Checklist card component for task tracking.',
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 11l2 2 4-4" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
      },
    ]
  },
]

// Canvas settings section
const canvasSettings = [
  { name: 'Dark/Light Mode', description: 'Toggle between dark and light UI themes.' },
  { name: 'Canvas Theme', description: 'Choose from preset canvas background colors and styles.' },
  { name: 'Show Grid', description: 'Toggle the dot or line grid visibility.' },
  { name: 'Snap to Grid', description: 'Align shapes to the grid when moving or resizing.' },
  { name: 'Grid Style', description: 'Switch between dots and lines grid patterns.' },
]

// Cloud provider icons - using the same image files as the Sidebar
const getProviderIcons = (isDark: boolean): { name: string; description: string; count: string; logo: React.ReactNode }[] => [
  {
    name: 'AWS',
    description: 'Amazon Web Services icons including EC2, S3, Lambda, RDS, and 300+ more services.',
    count: '309',
    logo: <img src={isDark ? "/icons/providers/aws-dark.svg" : "/icons/providers/aws.svg"} alt="AWS" className="w-8 h-8 object-contain" />
  },
  {
    name: 'Azure',
    description: 'Microsoft Azure icons for compute, storage, networking, databases, and more.',
    count: '705',
    logo: <img src="/icons/providers/azure.svg" alt="Azure" className="w-8 h-8 object-contain" />
  },
  {
    name: 'GCP',
    description: 'Google Cloud Platform icons for Cloud Run, BigQuery, Pub/Sub, and other services.',
    count: '216',
    logo: <img src="/icons/providers/gcp.svg" alt="GCP" className="w-8 h-8 object-contain" />
  },
  {
    name: 'Kubernetes',
    description: 'Kubernetes icons for pods, deployments, services, ingress, and cluster resources.',
    count: '39',
    logo: <img src="/icons/providers/kubernetes.svg" alt="Kubernetes" className="w-8 h-8 object-contain" />
  },
]

// Tech icons (programming languages, frameworks, etc.)
const techIcons = {
  description: 'Programming languages, frameworks, databases, and development tools.',
  examples: ['React', 'Node.js', 'Python', 'Docker', 'PostgreSQL', 'Redis', 'GraphQL', 'TypeScript']
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  theme
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-ui-control>
      <div
        ref={modalRef}
        className={`rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col ${
          isDark ? 'bg-[#1A1A1F] border border-gray-700' : 'bg-white'
        }`}
        data-ui-control
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-8 py-5 border-b flex items-center justify-between ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-[#36C3AD]/20 text-[#36C3AD]' : 'bg-teal-100 text-teal-600'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Keyboard Shortcuts & Tools
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Master Flowstry with these shortcuts and tools
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Keyboard Shortcuts Section */}
          <div className="mb-10">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
              </svg>
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shortcutCategories.map((category) => (
                <div
                  key={category.title}
                  className={`rounded-xl border p-4 ${
                    isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    <span className={isDark ? 'text-[#36C3AD]' : 'text-teal-600'}>{category.icon}</span>
                    <span className="font-medium">{category.title}</span>
                  </div>
                  <div className="space-y-2">
                    {category.shortcuts.map((shortcut, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {shortcut.keys.map((key, keyIdx) => {
                            // Check if this is a Mac modifier symbol that needs to be larger
                            const isMacSymbol = ['⌘', '⇧', '⌥', '⌫', '↑', '↓', '←', '→'].includes(key)
                            return (
                              <kbd 
                                key={keyIdx} 
                                className={`px-2 py-1 rounded font-mono whitespace-nowrap h-6 flex items-center justify-center min-w-[24px] ${
                                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border border-gray-300 shadow-sm'
                                }`}
                                style={isMacSymbol ? { fontSize: '16px', lineHeight: 1 } : { fontSize: '12px', lineHeight: 1 }}
                              >
                                {key}
                              </kbd>
                            )
                          })}
                        </div>
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tools Section */}
          <div className="mb-10">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Canvas Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {toolCategories.map((category) => (
                <div
                  key={category.title}
                  className={`rounded-xl border p-4 ${
                    isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <h4 className={`font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {category.title}
                  </h4>
                  <div className="space-y-3">
                    {category.tools.map((tool) => (
                      <div key={tool.name} className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                          {tool.icon}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                            {tool.name}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {tool.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connectors Section */}
          <div className="mb-10">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
              Connectors
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Connect shapes together with smart, auto-routing connectors. Click a shape's connection point and drag to another shape.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Connector Types */}
              <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Connector Types
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Straight</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Direct line between two points</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19V12H19V5" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Elbow</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Right-angle connector with bends</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19C5 12 19 12 19 5" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Curved</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Smooth bezier curve connector</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrowhead Styles */}
              <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Arrowhead Styles
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M19 12l-4-4M19 12l-4 4" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Open Arrow</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Simple directional arrow</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h10M15 12l5-4v8z" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Hollow Triangle</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>UML inheritance/generalization</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h10M15 8l4 4-4 4-4-4z" /></svg>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Diamond</div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Hollow (aggregation) or filled (composition)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Connect */}
              <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Quick Connect
                </h4>
                <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Hover over a selected shape to reveal quick connect buttons on each side. Click a button to create a copy of the selected shape, automatically connected.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <kbd className={`px-2 py-1 rounded font-mono h-6 flex items-center justify-center min-w-[24px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border border-gray-300 shadow-sm'}`} style={{ fontSize: '16px', lineHeight: 1 }}>{cmd}</kbd>
                      <kbd className={`px-2 py-1 rounded font-mono h-6 flex items-center justify-center min-w-[24px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border border-gray-300 shadow-sm'}`} style={{ fontSize: '16px', lineHeight: 1 }}>↑↓←→</kbd>
                    </div>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Quick connect: Create a copy of the selected shape in the arrow direction, automatically connected</span>
                  </div>
                  <div className={`flex items-start gap-2 pt-2 mt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className={`p-1 rounded ${isDark ? 'bg-[#36C3AD]/20 text-[#36C3AD]' : 'bg-teal-100 text-teal-600'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    </div>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}><strong>Multi-preview:</strong> Press the same shortcut multiple times to chain multiple shapes in that direction</span>
                  </div>
                </div>
              </div>

              {/* Flow Animation */}
              <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Flow Animation
                </h4>
                <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Add animated dashed lines to connectors to indicate data flow or process direction.
                </p>
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${isDark ? 'bg-[#36C3AD]/20 text-[#36C3AD]' : 'bg-teal-100 text-teal-600'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Toggle Animation</div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Select a connector and click the animation button in the style menu</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cloud Provider Icons Section */}
          <div className="mb-10">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              Cloud Provider Icons
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Access 1,200+ official cloud provider icons from the sidebar. Drag and drop to create architecture diagrams.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {getProviderIcons(isDark).map((provider) => (
                <div 
                  key={provider.name} 
                  className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {provider.logo}
                    </div>
                    <div>
                      <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {provider.name}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {provider.count} icons
                      </div>
                    </div>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {provider.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Icons Section */}
          <div className="mb-10">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Tech & Development Icons
            </h3>
            <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {techIcons.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {techIcons.examples.map((tech) => (
                  <span 
                    key={tech} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    {tech}
                  </span>
                ))}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isDark ? 'bg-[#36C3AD]/20 text-[#36C3AD]' : 'bg-teal-100 text-teal-700'
                }`}>
                  + many more
                </span>
              </div>
            </div>
          </div>

          {/* Canvas Settings Section */}
          <div>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Canvas Settings
            </h3>
            <div className={`rounded-xl border p-4 ${
              isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
            }`}>
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Access these settings from the bottom-right corner of the canvas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {canvasSettings.map((setting) => (
                  <div key={setting.name} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-white border border-gray-200'}`}>
                    <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {setting.name}
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {setting.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-8 py-4 border-t flex items-center justify-between ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Press <kbd className={`px-1.5 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>Esc</kbd> to close
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDark 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
