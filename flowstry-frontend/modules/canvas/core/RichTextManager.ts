
export class RichTextManager {
  /**
   * Toggles the specified format (bold, italic, underline, line-through)
   * on the current selection.
   */
  static toggleFormat(format: 'bold' | 'italic' | 'underline' | 'line-through') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    document.execCommand(format, false);
    
    // For line-through, execCommand might use 'strikeThrough'
    if (format === 'line-through') {
      document.execCommand('strikeThrough', false);
    }
  }

  /**
   * Toggles the specified list type (ordered or unordered)
   */
  static toggleList(type: 'ordered' | 'unordered') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
  }

  /**
   * Applies the specified color to the current selection.
   */
  static setTextColor(color: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    document.execCommand('foreColor', false, color);
  }

  /**
   * Applies the specified font family to the current selection.
   */
  static setFontFamily(fontFamily: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    document.execCommand('fontName', false, fontFamily);
  }

  /**
   * Applies the specified font size to the current selection.
   * Note: execCommand 'fontSize' takes 1-7, so we might need a custom implementation
   * if we want specific pixel values. For now, let's try to use a span with style.
   */
  static setFontSize(fontSize: number) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // execCommand fontSize is limited. Let's use a custom span insertion.
    this.applyStyleToSelection('fontSize', `${fontSize}px`);
  }

  /**
   * Applies the specified text alignment to the current block.
   */
  static setTextAlign(align: 'left' | 'center' | 'right' | 'justify') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`, false);
  }

  /**
   * Helper to apply a specific CSS style to the current selection.
   * This is more robust than execCommand for things like specific font sizes.
   */
  private static applyStyleToSelection(styleName: string, styleValue: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style[styleName as any] = styleValue;

    // If the selection is collapsed, we might want to insert a zero-width space or just the span
    // But usually this is called when text is selected.
    if (range.collapsed) {
        // If collapsed, we can't easily wrap "nothing". 
        // Some editors insert a span with a zero-width space and move cursor inside.
        return; 
    }

    try {
        // This is a simplified version. A full rich text editor needs complex range handling
        // to avoid nesting spans unnecessarily.
        // For now, let's try using execCommand 'insertHTML' which handles some cleanup,
        // or wrapping the content.
        
        // Using surroundContents can fail if the range crosses block boundaries.
        // range.surroundContents(span); 
        
        // Better approach for simple styling:
        // 1. Extract contents
        // 2. Wrap in span
        // 3. Insert back
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        
        // Restore selection to the span
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
    } catch (e) {
        console.error('Failed to apply style', e);
    }
  }

  /**
   * Checks if the current selection has the specified format.
   */
  static isFormatActive(format: 'bold' | 'italic' | 'underline' | 'strikeThrough'): boolean {
    return document.queryCommandState(format);
  }
  
  /**
   * Gets the value of the command for the current selection (e.g. font name)
   */
  static getFormatValue(command: string): string {
      return document.queryCommandValue(command);
  }

  /**
   * Removes color styling from the provided HTML string.
   * This is used when applying a global text color to ensure it overrides specific rich text colors.
   */
  static removeColorStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove color from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      // Remove color property from style
      if (el instanceof HTMLElement) {
        el.style.removeProperty('color');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Remove deprecated <font> tags with color attribute
    const fontTags = container.querySelectorAll('font[color]');
    fontTags.forEach(font => {
      font.removeAttribute('color');
      // If font tag has no other attributes, unwrap it
      if (font.attributes.length === 0) {
        const parent = font.parentNode;
        if (parent) {
          while (font.firstChild) {
            parent.insertBefore(font.firstChild, font);
          }
          parent.removeChild(font);
        }
      }
    });

    return container.innerHTML;
  }

  /**
   * Removes text alignment styling from the provided HTML string.
   * This is used when applying a global text alignment to ensure it overrides specific rich text alignments.
   */
  static removeAlignmentStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove text-align from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('text-align');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Remove deprecated align attribute
    const elementsWithAlign = container.querySelectorAll('[align]');
    elementsWithAlign.forEach(el => el.removeAttribute('align'));

    return container.innerHTML;
  }

  /**
   * Removes bold styling from the provided HTML string.
   * This is used when applying a global font weight to ensure it overrides specific rich text bold formatting.
   */
  static removeBoldStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove font-weight from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('font-weight');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Unwrap <b> and <strong> tags
    const boldTags = container.querySelectorAll('b, strong');
    boldTags.forEach(tag => {
      const parent = tag.parentNode;
      if (parent) {
        while (tag.firstChild) {
          parent.insertBefore(tag.firstChild, tag);
        }
        parent.removeChild(tag);
      }
    });

    return container.innerHTML;
  }

  /**
   * Removes italic styling from the provided HTML string.
   * This is used when applying a global font style to ensure it overrides specific rich text italic formatting.
   */
  static removeItalicStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove font-style from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('font-style');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Unwrap <i> and <em> tags
    const italicTags = container.querySelectorAll('i, em');
    italicTags.forEach(tag => {
      const parent = tag.parentNode;
      if (parent) {
        while (tag.firstChild) {
          parent.insertBefore(tag.firstChild, tag);
        }
        parent.removeChild(tag);
      }
    });

    return container.innerHTML;
  }

  /**
   * Removes font-family styling from the provided HTML string.
   * This is used when applying a global font family to ensure it overrides specific rich text fonts.
   */
  static removeFontFamilyStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove font-family from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('font-family');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Remove deprecated <font> tags with face attribute
    const fontTags = container.querySelectorAll('font[face]');
    fontTags.forEach(font => {
      font.removeAttribute('face');
      // If font tag has no other attributes, unwrap it
      if (font.attributes.length === 0) {
        const parent = font.parentNode;
        if (parent) {
          while (font.firstChild) {
            parent.insertBefore(font.firstChild, font);
          }
          parent.removeChild(font);
        }
      }
    });

    return container.innerHTML;
  }

  /**
   * Removes font-size styling from the provided HTML string.
   * This is used when applying a global font size to ensure it overrides specific rich text sizes.
   */
  static removeFontSizeStyles(html: string): string {
    if (!html) return html;

    // Create a temporary container to parse the HTML
    const container = document.createElement('div');
    container.innerHTML = html;

    // Remove font-size from all elements with style attribute
    const elementsWithStyle = container.querySelectorAll('[style]');
    elementsWithStyle.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('font-size');
        // If style is empty after removal, remove the attribute
        if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
        }
      }
    });

    // Remove deprecated <font> tags with size attribute
    const fontTags = container.querySelectorAll('font[size]');
    fontTags.forEach(font => {
      font.removeAttribute('size');
      // If font tag has no other attributes, unwrap it
      if (font.attributes.length === 0) {
        const parent = font.parentNode;
        if (parent) {
          while (font.firstChild) {
            parent.insertBefore(font.firstChild, font);
          }
          parent.removeChild(font);
        }
      }
    });

    return container.innerHTML;
  }

  /**
   * Applies a format to an HTML string using a temporary hidden div.
   * This allows modifying the HTML content without it being rendered in the DOM.
   */
  static toggleFormatOnHtml(html: string, format: 'bold' | 'italic' | 'underline' | 'line-through'): string {
    // Create a temporary div
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.contentEditable = 'true';
    div.innerHTML = html || ' '; // Ensure there's at least a space to select
    document.body.appendChild(div);

    try {
      // Select all content in the div
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(div);
        selection.addRange(range);

        // Apply format
        document.execCommand(format, false);

        // For line-through, execCommand might use 'strikeThrough'
        if (format === 'line-through') {
          document.execCommand('strikeThrough', false);
        }

        // Clear selection
        selection.removeAllRanges();
      }

      return div.innerHTML;
    } finally {
      // Clean up
      document.body.removeChild(div);
    }
  }

  /**
   * Toggles a list format (ordered or unordered) on an HTML string using a temporary hidden div.
   */
  static toggleListOnHtml(html: string, type: 'ordered' | 'unordered'): string {
    // Create a temporary div
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.contentEditable = 'true';
    div.innerHTML = html || ' '; // Ensure there's at least a space to select
    document.body.appendChild(div);

    try {
      // Select all content in the div
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(div);
        selection.addRange(range);

        // Apply list format
        const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
        document.execCommand(command, false);

        // Clear selection
        selection.removeAllRanges();
      }

      return div.innerHTML;
    } finally {
      // Clean up
      document.body.removeChild(div);
    }
  }
}
