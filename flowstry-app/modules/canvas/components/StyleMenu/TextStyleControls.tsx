import React from 'react'
import { FontFamilySelector } from './FontFamilySelector'
import { FontSizeSelector } from './FontSizeSelector'
import { ListButtons } from './ListButtons'
import { TextAlignSelector } from './TextAlignSelector'
import { TextColorSelector } from './TextColorSelector'
import { TextFormatButtons } from './TextFormatButtons'
import { TextJustifySelector } from './TextJustifySelector'

export interface TextStyleControlsProps {
  // Values
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold' | string
  fontStyle: 'normal' | 'italic' | string
  textDecoration: 'none' | 'underline' | 'line-through' | string
  textAlign: 'left' | 'center' | 'right'
  textJustify: 'top' | 'middle' | 'bottom'
  textColor: string
  
  // Handlers
  onFontFamilyChange: (fontFamily: string) => void
  onFontSizeChange: (fontSize: number) => void
  onFontWeightToggle: () => void
  onFontStyleToggle: () => void
  onTextDecorationChange: (format: 'underline' | 'line-through') => void
  onListChange: (type: 'ordered' | 'unordered') => void
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void
  onTextJustifyChange: (justify: 'top' | 'middle' | 'bottom') => void
  onTextColorChange: (color: string) => void
  onRecordHistory: () => void

  // UI State
  openPanel: string | null
  togglePanel: (panel: string) => void
  closeAllPanels: () => void
  theme: 'light' | 'dark'
  placement: 'top' | 'bottom'
  canvasState: { scale: number; translation: { x: number; y: number } }
  isEditingText: boolean
  
  // Conditionally hide specific sections if needed
  hideColor?: boolean
  hideAlignment?: boolean
  isMobile?: boolean
}

export const TextStyleControls: React.FC<TextStyleControlsProps> = ({
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  textDecoration,
  textAlign,
  textJustify,
  textColor,
  onFontFamilyChange,
  onFontSizeChange,
  onFontWeightToggle,
  onFontStyleToggle,
  onTextDecorationChange,
  onListChange,
  onTextAlignChange,
  onTextJustifyChange,
  onTextColorChange,
  onRecordHistory,
  openPanel,
  togglePanel,
  closeAllPanels,
  theme,
  placement,
  canvasState,
  isEditingText,
  hideColor = false,
  hideAlignment = false,
  isMobile = false
}) => {
  return (
    <>
      {!hideColor && (
        <>
          <TextColorSelector
            isOpen={openPanel === 'textColor'}
            onToggle={() => togglePanel('textColor')}
            onClose={closeAllPanels}
            onTextColorChange={onTextColorChange}
            onRecordHistory={onRecordHistory}
            toolbarPlacement={placement}
            canvasState={canvasState}
            isEditingText={isEditingText}
            value={textColor}
            theme={theme}
            isMobile={isMobile}
          />
          <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        </>
      )}

      {/* Font Family Selector */}
      <FontFamilySelector
        value={fontFamily}
        isOpen={openPanel === 'fontFamily'}
        onToggle={() => togglePanel('fontFamily')}
        onChange={onFontFamilyChange}
        onClose={closeAllPanels}
        toolbarPlacement={placement}
        canvasState={canvasState}
        isEditingText={isEditingText}
        theme={theme}
        isMobile={isMobile}
      />

      <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

      {/* Font Size Selector */}
      <FontSizeSelector
        value={fontSize}
        isOpen={openPanel === 'fontSize'}
        onToggle={() => togglePanel('fontSize')}
        onChange={onFontSizeChange}
        onClose={closeAllPanels}
        toolbarPlacement={placement}
        canvasState={canvasState}
        isEditingText={isEditingText}
        theme={theme}
        isMobile={isMobile}
      />

      {/* Text Format Buttons */}
      <TextFormatButtons
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        textDecoration={textDecoration}
        onFontWeightToggle={onFontWeightToggle}
        onFontStyleToggle={onFontStyleToggle}
        onTextDecorationChange={onTextDecorationChange}
        onRecordHistory={onRecordHistory}
        isEditingText={isEditingText}
        theme={theme}
      />

      <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

      {/* List Buttons */}
      <ListButtons
        isEditingText={isEditingText}
        onListChange={onListChange}
        onRecordHistory={onRecordHistory}
      />

      {!hideAlignment && (
        <>
          <div className={`w-px h-6 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

          {/* Text Align Selector */}
          <TextAlignSelector
            value={textAlign}
            isOpen={openPanel === 'textAlign'}
            onToggle={() => togglePanel('textAlign')}
            onChange={onTextAlignChange}
            onClose={closeAllPanels}
            toolbarPlacement={placement}
            canvasState={canvasState}
            isEditingText={isEditingText}
            theme={theme}
            isMobile={isMobile}
          />

          {/* Text Justify Selector */}
          <TextJustifySelector
            value={textJustify}
            isOpen={openPanel === 'textJustify'}
            onToggle={() => togglePanel('textJustify')}
            onChange={onTextJustifyChange}
            onClose={closeAllPanels}
            toolbarPlacement={placement}
            canvasState={canvasState}
            theme={theme}
            isMobile={isMobile}
          />
        </>
      )}
    </>
  )
}
