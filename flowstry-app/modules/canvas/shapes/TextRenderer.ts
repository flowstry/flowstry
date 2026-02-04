import { SVG_NAMESPACE } from '../consts/svg';
import type { DiagramShape } from './base';

export class TextRenderer {
  private static readonly LINE_HEIGHT = 1.4;
  private static readonly PLACEHOLDER_TEXT = 'Add Text';
  private static readonly PLACEHOLDER_OPACITY = 0.5;
  private static textEditingStopCallback: (() => void) | null = null;

  public static setTextEditingStopCallback(callback: (() => void) | null): void {
    this.textEditingStopCallback = callback;
  }

  /**
   * Create or update text elements for a shape
   * Note: Frames and React shapes are excluded - they have their own rendering
   */
  static renderText(shape: DiagramShape, selectedCount: number): void {
    // Frames have their own label system, skip base text rendering
    // React shapes (service-card, todo-card) handle their own content via React components
    if (shape.type === 'frame' || shape.type === 'service-card' || shape.type === 'todo-card') {
      this.removeTextElement(shape);
      return;
    }

    const textPos = shape.shapeText.getPosition();
    const textBounds = shape.shapeText.getBounds();

    // Check if shape is ready for text editing (single selected shape with text, and hovered)
    const isReadyForEditing = shape.state.selected && selectedCount === 1 && shape.text && shape.state.hovered;

    // Show text editor if editing
    if (shape.state.isEditingText) {
      this.createOrUpdateTextElement(shape, textPos, textBounds, true, false, false);
    }
    // Show placeholder if no text, shape is hovered, selected, and only one shape is selected
    else if (!shape.text && shape.state.hovered && shape.state.selected && selectedCount === 1) {
      this.createOrUpdateTextElement(shape, textPos, textBounds, false, true, false);
    }
    // Show text ready for editing (contentEditable but not in editing mode yet)
    else if (isReadyForEditing) {
      this.createOrUpdateTextElement(shape, textPos, textBounds, false, false, true);
    }
    // Show regular text
    else if (shape.text) {
      this.createOrUpdateTextElement(shape, textPos, textBounds, false, false, false);
    }
    // No text and not editing
    else {
      this.removeTextElement(shape);
    }
  }

  /**
   * Create or update text element with two-div structure
   */
  private static createOrUpdateTextElement(
    shape: DiagramShape,
    pos: { x: number; y: number },
    bounds: { width: number; height: number },
    isEditing: boolean,
    isPlaceholder: boolean,
    isReadyForEditing: boolean
  ): void {
    // Create foreignObject if it doesn't exist
    if (!shape.textElement) {
      shape.textElement = document.createElementNS(SVG_NAMESPACE, 'foreignObject');
      shape.element.appendChild(shape.textElement);
    }

    // Check if this is a connector (needs dynamic text sizing)
    const isConnector = shape.type === 'connector';

    // For connectors: use large fixed dimensions so text can flow naturally
    // For shapes: use the provided bounds
    const width = isConnector ? 500 : Math.max(15, bounds.width);
    const height = isConnector ? 200 : Math.max(15, bounds.height);

    // Position - for connectors, center the large box on the label position
    shape.textElement.setAttribute('x', String(pos.x - width / 2));
    shape.textElement.setAttribute('y', String(pos.y - height / 2));
    shape.textElement.setAttribute('width', String(width));
    shape.textElement.setAttribute('height', String(height));
    // For connectors: foreignObject should NOT receive pointer events - only the text-block inside should
    // This prevents clicks on empty area of foreignObject from triggering text selection
    const foreignObjectPointerEvents = isConnector ? 'none' : ((isEditing || isReadyForEditing || !!shape.text || isPlaceholder) ? 'all' : 'none');
    shape.textElement.setAttribute('pointer-events', foreignObjectPointerEvents);
    // For connectors: always visible overflow; for shapes: visible when editing only
    shape.textElement.setAttribute('overflow', (isConnector || isEditing) ? 'visible' : 'hidden');

    // Get or create wrapper div
    let wrapper = shape.textElement.querySelector('.wrapper') as HTMLDivElement;
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'wrapper';
      shape.textElement.innerHTML = '';
      shape.textElement.appendChild(wrapper);
    }

    // Wrapper styles will be set after we get text alignment properties

    // Get or create text-block div
    let textBlock = wrapper.querySelector('.text-block') as HTMLDivElement;
    const isNewTextBlock = !textBlock;
    if (isNewTextBlock) {
      textBlock = document.createElement('div');
      textBlock.className = 'text-block';
      wrapper.innerHTML = '';
      wrapper.appendChild(textBlock);
    }

    // Check if we're transitioning into/out of edit mode
    const wasEditing = textBlock.getAttribute('data-editing') === 'true';
    const wasReadyForEditing = textBlock.getAttribute('data-ready-for-editing') === 'true';
    const isStartingEdit = isEditing && !wasEditing;
    const isStoppingEdit = !isEditing && wasEditing;
    const isStartingReadyState = isReadyForEditing && !wasReadyForEditing;
    const isStoppingReadyState = !isReadyForEditing && wasReadyForEditing;

    // Set contentEditable based on state:
    // - true when actively editing
    // - true when ready for editing (hovered, selected, has text)
    // - false otherwise
    textBlock.contentEditable = (isEditing || isReadyForEditing) ? 'true' : 'false';
    
    // Track editing state with data attributes
    if (isEditing) {
      textBlock.setAttribute('data-editing', 'true');
      textBlock.setAttribute('data-text-editor', '');
      textBlock.removeAttribute('data-ready-for-editing');
    } else if (isReadyForEditing) {
      textBlock.setAttribute('data-ready-for-editing', 'true');
      textBlock.setAttribute('data-editing', 'false');
      textBlock.removeAttribute('data-text-editor');
    } else {
      textBlock.setAttribute('data-editing', 'false');
      textBlock.removeAttribute('data-text-editor');
      textBlock.removeAttribute('data-ready-for-editing');
    }

    // Clear text selection when stopping edit or entering ready state
    if (isStoppingEdit || isStartingReadyState) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      textBlock.blur(); // Remove focus
    }
    
    // Clear text selection when leaving ready state (but not entering edit)
    if (isStoppingReadyState && !isEditing) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }

    // Text-block styles - responsible only for text behaviors
    // When ready for editing: enable pointer events but prevent selection (default cursor)
    // When actively editing: enable both pointer events and selection (text cursor)
    // Otherwise: disable both
    const cursorStyle = isEditing ? 'text' : 'default';
    const pointerEvents = (isEditing || isReadyForEditing) ? 'auto' : 'none';
    const userSelect = isEditing ? 'text' : 'none';
    
    // Calculate maximum number of lines that can fit (no padding now)
    const availableHeight = bounds.height;
    const fontSize = shape.appearance.fontSize || 14;
    const lineHeightPx = fontSize * this.LINE_HEIGHT;
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightPx));
    
    // When actively editing, use block display to allow full overflow
    // When ready for editing (hover) or viewing, use webkit-box with ellipsis
    const displayStyle = isEditing ? 'block' : '-webkit-box';
    const webkitLineClamp = isEditing ? 'unset' : String(maxLines);
    const webkitBoxOrient = isEditing ? 'unset' : 'vertical';
    
    // Get text style properties from shape
    const fontFamily = shape.appearance.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
    const fontWeight = shape.appearance.fontWeight || 'normal';
    const fontStyle = shape.appearance.fontStyle || 'normal';
    // const textDecoration = shape.appearance.textDecoration || 'none';
    const textAlign = shape.appearance.textAlign || 'center';
    const textJustify = shape.appearance.textJustify || 'middle';
    const textColor = shape.appearance.textColor || '#000000';
    
    // Map textAlign to flexbox align-items
    const alignItemsMap: Record<'left' | 'center' | 'right', string> = {
      'left': 'flex-start',
      'center': 'center',
      'right': 'flex-end'
    };
    
    // Map textJustify to flexbox justify-content
    const justifyContentMap: Record<'top' | 'middle' | 'bottom', string> = {
      'top': 'flex-start',
      'middle': 'center',
      'bottom': 'flex-end'
    };
    
    // Update wrapper flexbox alignment
    // For connectors: use inline-flex to allow text to size naturally
    wrapper.style.cssText = isConnector ? `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      box-sizing: border-box;
      padding: 0;
      pointer-events: none;
    ` : `
      width: 100%;
      height: ${isEditing ? 'auto' : '100%'};
      min-height: ${isEditing ? '100%' : 'auto'};
      display: flex;
      flex-direction: column;
      align-items: ${alignItemsMap[textAlign]};
      justify-content: ${justifyContentMap[textJustify]};
      overflow-x: hidden;
      overflow-y: ${isEditing ? 'visible' : 'hidden'};
      box-sizing: border-box;
      padding: 0;
    `;
    
    // Add styles for lists if not present
    if (!wrapper.querySelector('style')) {
      const style = document.createElement('style');
      style.textContent = `
        .text-block ul, .text-block ol {
          padding-left: 20px;
          margin: 0.5em 0;
          list-style-position: inside;
        }
        .text-block ul {
          list-style-type: disc;
        }
        .text-block ol {
          list-style-type: decimal;
        }
        .text-block li {
          display: list-item;
          margin: 0.25em 0;
        }
      `;
      wrapper.appendChild(style);
    }


    // Determine if connector should show selection visual (isConnector already defined above)
    // Show border when selected (both editing and not editing)
    const showConnectorSelectionBorder = isConnector && shape.state.selected;
    const selectionBorder = showConnectorSelectionBorder ? '1px solid #60a5fa' : 'none';
    const selectionBorderRadius = showConnectorSelectionBorder ? '2px' : '0';
    const selectionPadding = showConnectorSelectionBorder ? '2px 4px' : '0';

    // For connectors: simpler styling with visible overflow and auto sizing
    // For shapes: existing styling with clipping and ellipsis
    textBlock.style.cssText = isConnector ? `
      display: inline-block;
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      font-weight: ${fontWeight};
      font-style: ${fontStyle};
      line-height: ${this.LINE_HEIGHT};
      text-align: center;
      color: ${isPlaceholder ? '#999' : textColor};
      ${isPlaceholder ? `opacity: ${this.PLACEHOLDER_OPACITY};` : ''}
      white-space: nowrap;
      overflow: visible;
      width: auto;
      height: auto;
      box-sizing: border-box;
      outline: none;
      border: ${selectionBorder};
      border-radius: ${selectionBorderRadius};
      background: transparent;
      padding: ${selectionPadding};
      cursor: ${cursorStyle};
      pointer-events: all;
      user-select: ${userSelect};
      -webkit-user-select: ${userSelect};
    ` : `
      display: ${displayStyle};
      ${displayStyle === '-webkit-box' ? `-webkit-line-clamp: ${webkitLineClamp};` : ''}
      ${displayStyle === '-webkit-box' ? `-webkit-box-orient: ${webkitBoxOrient};` : ''}
      font-family: ${fontFamily};
      font-size: ${fontSize}px;
      font-weight: ${fontWeight};
      font-style: ${fontStyle};
      line-height: ${this.LINE_HEIGHT};
      text-align: ${textAlign};
      color: ${isPlaceholder ? '#999' : textColor};
      ${isPlaceholder ? `opacity: ${this.PLACEHOLDER_OPACITY};` : ''}
      white-space: pre-wrap;
      overflow-wrap: break-word;
      overflow: ${isEditing ? 'visible' : 'hidden'};
      text-overflow: ${isEditing ? 'clip' : 'ellipsis'};
      width: 100%;
      min-width: 15px;
      height: auto;
      box-sizing: border-box;
      outline: none;
      border: none;
      border-radius: 0;
      background: transparent;
      padding: 0;
      cursor: ${cursorStyle};
      pointer-events: ${pointerEvents};
      user-select: ${userSelect};
      -webkit-user-select: ${userSelect};
    `;

    // Update content only when not actively editing (prevents caret reset)
    const displayText = isPlaceholder ? this.PLACEHOLDER_TEXT : (shape.text || '');
    if (!isEditing || isNewTextBlock || isStartingEdit) {
      // Use innerHTML to support rich text
      if (textBlock.innerHTML !== displayText) {
        textBlock.innerHTML = displayText;
      }
    }

    // Apply opacity effect to overflowing text when editing using CSS mask
    // Hard cutoff at available height - full opacity inside, reduced opacity for overflow
    // Skip this for connectors - they use dynamic sizing with visible overflow
    if (isEditing && !isConnector) {
      textBlock.style.position = 'relative';
      // Use a CSS mask with hard cutoff: full opacity within bounds, 30% opacity for overflow
      const maskGradient = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${availableHeight}px, rgba(0,0,0,0.35) ${availableHeight}px, rgba(0,0,0,0.35) 100%)`;
      textBlock.style.setProperty('-webkit-mask-image', maskGradient);
      textBlock.style.setProperty('mask-image', maskGradient);
    } else {
      textBlock.style.position = '';
      textBlock.style.removeProperty('-webkit-mask-image');
      textBlock.style.removeProperty('mask-image');
    }

    // Setup event listeners only once
    const hasListeners = textBlock.hasAttribute('data-listeners-attached');
    if (!hasListeners) {
      textBlock.setAttribute('data-listeners-attached', 'true');
      
      textBlock.addEventListener('input', (e) => {
        const target = e.target as HTMLDivElement;
        // Use setText to trigger needsRender, which will update the mask for connectors
        const newText = target.innerHTML || '';
        if (shape.text !== newText) {
          shape.text = newText;
        }
      });

      textBlock.addEventListener('keydown', (e) => {
        // Handle ESC to stop text editing
        if (e.key === 'Escape') {
          e.preventDefault();
          if (this.textEditingStopCallback) {
            this.textEditingStopCallback();
          }
        }
        // Handle Command/Ctrl + Enter to stop text editing
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (this.textEditingStopCallback) {
            this.textEditingStopCallback();
          }
        }
        // Handle Enter key to insert <br /> tag
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const br = document.createElement('br');
            range.deleteContents();
            range.insertNode(br);
            // Move cursor after the <br />
            range.setStartAfter(br);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        // Don't stop propagation - let Canvas handler also process Escape to switch tools
        // The TextEditTool will handle stopping text editing, and Canvas will switch to Select tool
      });
    }

    // Focus when starting to edit
    if (isStartingEdit) {
      setTimeout(() => {
        textBlock.focus();
        
        // Handle cursor placement based on trigger
        if (!shape.state.editingTriggeredByClick) {
          // Keyboard trigger (Enter) - select all text
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(textBlock);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else if (shape.state.editingClickPosition) {
          // Click trigger on text-block - place cursor at click position
          const clickPos = shape.state.editingClickPosition;
          
          // Use caretRangeFromPoint or caretPositionFromPoint to get cursor position
          let range: Range | null = null;
          
          if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(clickPos.x, clickPos.y);
          } else if ((document as any).caretPositionFromPoint) {
            // Firefox
            const caretPos = (document as any).caretPositionFromPoint(clickPos.x, clickPos.y);
            if (caretPos) {
              range = document.createRange();
              range.setStart(caretPos.offsetNode, caretPos.offset);
              range.collapse(true);
            }
          }
          
          if (range) {
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else {
            // Click was outside text area (e.g., on resize handle) - place cursor at end
            const selection = window.getSelection();
            if (selection) {
              const fallbackRange = document.createRange();
              fallbackRange.selectNodeContents(textBlock);
              fallbackRange.collapse(false); // false = collapse to end
              selection.removeAllRanges();
              selection.addRange(fallbackRange);
            }
          }
          
          // Clear the click position after using it
          shape.state.editingClickPosition = undefined;
        } else {
          // Click trigger on shape (outside text-block) - place cursor at the end
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(textBlock);
            range.collapse(false); // false = collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }, 0);
    }
  }

  /**
   * Remove text element
   */
  static removeTextElement(shape: DiagramShape): void {
    if (shape.textElement) {
      shape.textElement.remove();
      shape.textElement = null;
    }
  }
}
