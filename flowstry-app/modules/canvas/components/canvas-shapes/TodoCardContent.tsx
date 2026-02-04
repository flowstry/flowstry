'use client'

import type { ReactShapeContentProps } from '@/src/shapes/react/ReactShape'
import React, { useEffect, useRef, useState } from 'react'

// Types
interface TodoItem {
  id: string
  text: string
  completed: boolean
}

// Sizing constants
const PADDING = 12
const TITLE_HEIGHT = 32
const TODO_ITEM_HEIGHT = 32
const MIN_WIDTH = 200

/**
 * TodoCardContent - React component for the Todo card shape
 */
export const TodoCardContent: React.FC<ReactShapeContentProps> = ({
  theme,
  isSelected,
  scale,
  data,
  onDataChange,
  onMinDimensionsChange,
  onSelect
}) => {
  const title = (data.title as string) || ''
  const todos = (data.todos as TodoItem[]) || []
  
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [localTitle, setLocalTitle] = useState(title)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoText, setEditingTodoText] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [justDropped, setJustDropped] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const todoInputRef = useRef<HTMLInputElement>(null)

  // Store dismiss handler ref so it can be called externally
  const dismissHandlerRef = useRef<() => void>(() => { })

  const bgColor = theme === 'dark' ? 'bg-[#1E1E24]' : 'bg-white'
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const mutedColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
  const hoverBg = theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100'


  // Calculate and report min dimensions
  useEffect(() => {
    const headerHeight = PADDING + (title ? TITLE_HEIGHT : 0)
    const contentHeight = Math.max(TODO_ITEM_HEIGHT, todos.length * TODO_ITEM_HEIGHT)
    const minHeight = headerHeight + contentHeight + PADDING
    onMinDimensionsChange(MIN_WIDTH, minHeight)
  }, [title, todos, onMinDimensionsChange])

  // Reset justDropped after render completes
  useEffect(() => {
    if (justDropped) {
      requestAnimationFrame(() => {
        setJustDropped(false)
      })
    }
  }, [justDropped])

  // Update dismiss handler when state changes (needs to capture current state)
  dismissHandlerRef.current = () => {
    if (isEditingTitle && localTitle !== title) {
      onDataChange({ title: localTitle })
    }
    setIsEditingTitle(false)
    if (editingTodoId) {
      // Save any pending edit
      if (editingTodoText.trim()) {
        const updated = todos.map(t =>
          t.id === editingTodoId ? { ...t, text: editingTodoText.trim() } : t
        )
        onDataChange({ todos: updated })
      }
    }
    setEditingTodoId(null)
    setEditingTodoText('')
    setDraggedId(null)
    setDragOffsetY(0)
    // Blur any focused inputs
    titleInputRef.current?.blur()
    todoInputRef.current?.blur()
  }

  // Close editing when deselected
  useEffect(() => {
    if (!isSelected) {
      dismissHandlerRef.current()
    }
  }, [isSelected])

  // Listen for global dismiss event (fired when clicking outside shapes on canvas)
  useEffect(() => {
    const handleGlobalDismiss = () => {
      dismissHandlerRef.current()
    }
    window.addEventListener('reactshape-dismiss', handleGlobalDismiss)
    return () => {
      window.removeEventListener('reactshape-dismiss', handleGlobalDismiss)
    }
  }, [])

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Focus todo input when editing
  useEffect(() => {
    if (editingTodoId && todoInputRef.current) {
      todoInputRef.current.focus()
      todoInputRef.current.select()
    }
  }, [editingTodoId])

  // Sync local title
  useEffect(() => {
    if (!isEditingTitle) {
      setLocalTitle(title)
    }
  }, [title, isEditingTitle])

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect() // Select the shape when clicking title
    setIsEditingTitle(true)
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    if (localTitle !== title) {
      onDataChange({ title: localTitle })
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      titleInputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setLocalTitle(title)
      setIsEditingTitle(false)
    }
  }

  const addTodo = () => {
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      text: 'New task',
      completed: false
    }
    onDataChange({ todos: [...todos, newTodo] })
    // Start editing the new todo
    setEditingTodoId(newTodo.id)
    setEditingTodoText(newTodo.text)
  }

  const toggleTodo = (id: string) => {
    const updated = todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    )
    onDataChange({ todos: updated })
  }

  const deleteTodo = (id: string) => {
    onDataChange({ todos: todos.filter(t => t.id !== id) })
  }

  const startEditTodo = (todo: TodoItem) => {
    setEditingTodoId(todo.id)
    setEditingTodoText(todo.text)
  }

  const saveTodoEdit = () => {
    if (editingTodoId && editingTodoText.trim()) {
      const updated = todos.map(t =>
        t.id === editingTodoId ? { ...t, text: editingTodoText.trim() } : t
      )
      onDataChange({ todos: updated })
    }
    setEditingTodoId(null)
    setEditingTodoText('')
  }

  const handleTodoKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTodoEdit()
    }
    if (e.key === 'Escape') {
      setEditingTodoId(null)
      setEditingTodoText('')
    }
  }

  // Refs for pointer-based drag
  const listContainerRef = useRef<HTMLDivElement>(null)
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const dragStartYRef = useRef<number>(0)
  const itemHeightRef = useRef<number>(40) // Will be updated on drag start
  const originalIndexRef = useRef<number>(-1) // Track original position

  // Track where the dragged item would drop
  const [dropTargetIndex, setDropTargetIndex] = useState<number>(-1)

  // Pointer-based drag handlers
  const handleDragPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect() // Select the shape when starting to drag

    // Capture pointer to receive events even if cursor leaves element
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    // Store item height for shift calculations (in world coordinates)
    const draggedElement = itemRefsMap.current.get(id)
    if (draggedElement) {
      // Divide by scale to convert screen pixels to world coordinates
      itemHeightRef.current = draggedElement.getBoundingClientRect().height / scale
    }

    dragStartYRef.current = e.clientY
    setDragOffsetY(0)
    setDraggedId(id)

    // Store original index
    const currentIndex = todos.findIndex(t => t.id === id)
    originalIndexRef.current = currentIndex
    setDropTargetIndex(currentIndex)
  }

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!draggedId || !listContainerRef.current) return

    e.stopPropagation()

    // Update the visual offset for the dragged item - simple cursor follow
    const offsetY = (e.clientY - dragStartYRef.current) / scale
    setDragOffsetY(offsetY)

    const originalIndex = originalIndexRef.current
    if (originalIndex === -1) return

    // Calculate which position the item should go based on cursor
    const containerRect = listContainerRef.current.getBoundingClientRect()
    const cursorRelativeY = e.clientY - containerRect.top + listContainerRef.current.scrollTop
    const itemHeight = itemHeightRef.current * scale

    // Find target slot based on cursor position
    // We need to account for the fact that items shift when we're dragging
    let targetSlot = 0
    let accumulatedHeight = 0

    for (let i = 0; i < todos.length; i++) {
      // Skip the dragged item when calculating positions
      if (i === originalIndex) continue

      const slotMidpoint = accumulatedHeight + itemHeight / 2

      if (cursorRelativeY < slotMidpoint) {
        break
      }

      accumulatedHeight += itemHeight
      targetSlot++
    }

    // Clamp to valid range
    targetSlot = Math.max(0, Math.min(targetSlot, todos.length - 1))

    if (targetSlot !== dropTargetIndex) {
      setDropTargetIndex(targetSlot)
    }
  }

  const handleDragPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)

    // Reorder data if position changed
    const originalIndex = originalIndexRef.current
    if (draggedId && dropTargetIndex !== -1 && originalIndex !== -1 && originalIndex !== dropTargetIndex) {
      // Disable transitions, reorder data, then re-enable
      setJustDropped(true)
      const newTodos = [...todos]
      const [draggedItem] = newTodos.splice(originalIndex, 1)
      newTodos.splice(dropTargetIndex, 0, draggedItem)
      onDataChange({ todos: newTodos })
    }

    // Clear drag state
    setDraggedId(null)
    setDragOffsetY(0)
    setDropTargetIndex(-1)
    originalIndexRef.current = -1
  }

  // Calculate the transform offset for non-dragged items to make room
  const getItemShiftOffset = (itemId: string, itemIndex: number): number => {
    if (!draggedId || dropTargetIndex === -1) return 0
    if (itemId === draggedId) return 0

    const originalIndex = originalIndexRef.current
    if (originalIndex === -1) return 0

    const itemHeight = itemHeightRef.current

    // Items need to shift to make room for the dragged item at dropTargetIndex
    if (originalIndex < dropTargetIndex) {
      // Dragging down: items between original+1 and target shift UP
      if (itemIndex > originalIndex && itemIndex <= dropTargetIndex) {
        return -itemHeight
      }
    } else if (originalIndex > dropTargetIndex) {
      // Dragging up: items between target and original-1 shift DOWN  
      if (itemIndex >= dropTargetIndex && itemIndex < originalIndex) {
        return itemHeight
      }
    }

    return 0
  }

  // Register item ref
  const setItemRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefsMap.current.set(id, element)
    } else {
      itemRefsMap.current.delete(id)
    }
  }

  return (
    <div
      className={`w-full h-full flex flex-col rounded-xl ${bgColor} overflow-hidden`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${borderColor}`}>
        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Add title..."
              className={`w-full text-sm font-semibold bg-transparent border-b border-purple-500 outline-none ${textColor}`}
            />
          ) : (
            <div
              onClick={handleTitleClick}
                onPointerDown={(e) => e.stopPropagation()}
              className={`text-sm font-semibold truncate cursor-text ${title ? textColor : mutedColor}`}
            >
              {title || 'Add title...'}
            </div>
          )}
        </div>

        {/* Add Todo Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect() // Select the shape when clicking add button
            addTodo()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex-shrink-0 ml-2 p-1 rounded ${hoverBg} transition-colors`}
          title="Add task"
        >
          <svg className={`w-5 h-5 ${mutedColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Todo List */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto pl-0.5 pr-2 py-1"
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      >
        {todos.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-sm ${mutedColor}`}>
            No tasks yet
          </div>
        ) : (
            todos.map((todo, index) => {
              const isDragging = draggedId === todo.id
              const shiftOffset = getItemShiftOffset(todo.id, index)

              return (
                <div
                  key={todo.id}
                  ref={(el) => setItemRef(todo.id, el)}
                  className="group flex items-center pr-0.5"
                  style={{
                    transform: isDragging
                      ? `translateY(${dragOffsetY}px)`
                      : shiftOffset !== 0
                        ? `translateY(${shiftOffset}px)`
                        : 'none',
                    transition: isDragging || justDropped ? 'none' : 'transform 150ms ease',
                    zIndex: isDragging ? 10 : 1
                  }}
                >
                  {/* Drag Handle - sits in the gap */}
                  <div
                    onPointerDown={(e) => handleDragPointerDown(e, todo.id)}
                    className={`flex-shrink-0 w-3 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity ${mutedColor} ${draggedId === todo.id ? 'opacity-100' : ''
                      }`}
                    title="Drag to reorder"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </div>

                  {/* Todo Content Box */}
                  <div
                    className={`flex-1 flex items-center gap-1.5 py-1.5 pl-1 pr-2 rounded ${hoverBg} ${isDragging ? 'shadow-lg bg-gray-500/20' : ''
                      }`}
                    style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect() // Select the shape when clicking checkbox
                        toggleTodo(todo.id)
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex-shrink-0 w-4 h-4 rounded border ${todo.completed ? 'bg-green-500 border-green-500' : borderColor}`}
                    >
                      {todo.completed && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Todo Text */}
                    <div className="flex-1 min-w-0">
                      {editingTodoId === todo.id ? (
                        <input
                          ref={todoInputRef}
                          type="text"
                          value={editingTodoText}
                          onChange={(e) => setEditingTodoText(e.target.value)}
                          onBlur={saveTodoEdit}
                          onKeyDown={handleTodoKeyDown}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`w-full text-sm bg-transparent border-b border-purple-500 outline-none ${textColor}`}
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                              onSelect() // Select the shape when clicking todo text
                            startEditTodo(todo)
                          }}
                            onPointerDown={(e) => e.stopPropagation()}
                          className={`text-sm cursor-text ${todo.completed ? 'line-through ' + mutedColor : textColor}`}
                        >
                          {todo.text}
                        </span>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect() // Select the shape when clicking delete
                        deleteTodo(todo.id)
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded ${hoverBg} transition-opacity`}
                      title="Delete task"
                    >
                      <svg className={`w-4 h-4 ${mutedColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

