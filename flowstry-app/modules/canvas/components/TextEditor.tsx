import React, { useEffect, useRef, useState } from 'react';
import type { DiagramShape } from '../shapes/base';

interface TextEditorProps {
  shape: DiagramShape;
  scale: number;
  translation: { x: number; y: number };
  onComplete: (text: string) => void;
  onCancel: () => void;
  onChange: (text: string) => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({
  shape,
  scale,
  translation,
  onComplete,
  onCancel,
  onChange
}) => {
  const [text, setText] = useState(shape.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleChange = (newText: string) => {
    setText(newText);
    onChange(newText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle ESC to cancel editing
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      e.stopPropagation();
      return;
    }
    // Handle Command/Ctrl + Enter to complete editing
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onComplete(text);
      e.stopPropagation();
      return;
    }
    // Allow Enter for new lines (don't stop propagation for regular Enter)
  };

  // Calculate position in screen coordinates
  const textPos = shape.shapeText.getPosition();
  const textBounds = shape.shapeText.getBounds();
  
  const screenX = textPos.x * scale + translation.x;
  const screenY = textPos.y * scale + translation.y;
  const screenWidth = textBounds.width * scale;
  const screenHeight = textBounds.height * scale;

  return (
    <div
      data-text-editor
      style={{
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenWidth}px`,
        height: `${screenHeight}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'all',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <textarea
        ref={textareaRef}
        autoFocus={true}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '100%',
          padding: '8px',
          fontSize: '14px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          lineHeight: '1.4',
          border: '2px solid #3b82f6',
          borderRadius: '4px',
          outline: 'none',
          resize: 'none',
          overflow: 'auto',
          background: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          textAlign: 'center',
        }}
      />
    </div>
  );
};

