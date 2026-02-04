
import { ShapeAppearanceData } from '../../core/storage/types'

import { DEFAULT_FONT_FAMILY } from '../../consts/fonts'

export class ShapeAppearance {
  private _data: ShapeAppearanceData
  private _onChange?: () => void

  constructor(data?: ShapeAppearanceData) {
    this._data = data || {
      fill: '#ffffff',
      fillOpacity: 1,
      fillStyle: 'solid',
      stroke: '#575757',
      strokeWidth: 4,
      strokeOpacity: 1,
      strokeStyle: 'solid',
      fontSize: 14,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'center',
      textJustify: 'middle',
      textColor: '#000000',
      fillDrawStyle: 'standard',
      strokeDrawStyle: 'standard'
    }
  }

  setOnChange(callback: () => void) {
    this._onChange = callback
  }

  private notifyChange() {
    this._onChange?.()
  }

  // Accessors
  get fill(): string { return this._data.fill || '#ffffff' }
  set fill(val: string) { 
    if (this._data.fill !== val) {
      this._data.fill = val; 
      this.notifyChange();
    }
  }

  get fillOpacity(): number { return this._data.fillOpacity ?? 1 }
  set fillOpacity(val: number) { 
    if (this._data.fillOpacity !== val) {
      this._data.fillOpacity = val; 
      this.notifyChange();
    }
  }

  get stroke(): string { return this._data.stroke || '#575757' }
  set stroke(val: string) { 
    if (this._data.stroke !== val) {
      this._data.stroke = val; 
      this.notifyChange();
    }
  }

  get strokeWidth(): number { return this._data.strokeWidth ?? 4 }
  set strokeWidth(val: number) { 
    if (this._data.strokeWidth !== val) {
      this._data.strokeWidth = val; 
      this.notifyChange();
    }
  }
  
  get strokeOpacity(): number { return this._data.strokeOpacity ?? 1 }
  set strokeOpacity(val: number) { 
    if (this._data.strokeOpacity !== val) {
      this._data.strokeOpacity = val; 
      this.notifyChange();
    }
  }
  
  get opacity(): number { return this._data.opacity ?? 1 }
  set opacity(val: number) { 
    if (this._data.opacity !== val) {
      this._data.opacity = val; 
      this.notifyChange();
    }
  }

  get strokeStyle(): 'solid' | 'dashed' | 'dotted' | 'none' { return this._data.strokeStyle || 'solid' }
  set strokeStyle(val: 'solid' | 'dashed' | 'dotted' | 'none') { 
    if (this._data.strokeStyle !== val) {
      this._data.strokeStyle = val; 
      this.notifyChange();
    }
  }
  
  get fillStyle(): 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none' { return this._data.fillStyle || 'solid' }
  set fillStyle(val: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none') { 
    if (this._data.fillStyle !== val) {
      this._data.fillStyle = val; 
      this.notifyChange();
    }
  }

  // Text Styles
  get fontSize(): number { return this._data.fontSize ?? 14 }
  set fontSize(val: number) { 
    if (this._data.fontSize !== val) {
      this._data.fontSize = val; 
      this.notifyChange();
    }
  }

  get fontFamily(): string {
    return this._data.fontFamily || 'Inter, system-ui, -apple-system, sans-serif'
  }
  set fontFamily(val: string) { 
    if (this._data.fontFamily !== val) {
      this._data.fontFamily = val; 
      this.notifyChange();
    }
  }

  get fontWeight(): 'normal' | 'bold' { return this._data.fontWeight || 'normal' }
  set fontWeight(val: 'normal' | 'bold') { 
    if (this._data.fontWeight !== val) {
      this._data.fontWeight = val; 
      this.notifyChange();
    }
  }

  get fontStyle(): 'normal' | 'italic' { return this._data.fontStyle || 'normal' }
  set fontStyle(val: 'normal' | 'italic') { 
    if (this._data.fontStyle !== val) {
      this._data.fontStyle = val; 
      this.notifyChange();
    }
  }

  get textDecoration(): string { return this._data.textDecoration || 'none' }
  set textDecoration(val: string) { 
    if (this._data.textDecoration !== val) {
      this._data.textDecoration = val; 
      this.notifyChange();
    }
  }

  get textAlign(): 'left' | 'center' | 'right' { return this._data.textAlign || 'center' }
  set textAlign(val: 'left' | 'center' | 'right') { 
    if (this._data.textAlign !== val) {
      this._data.textAlign = val; 
      this.notifyChange();
    }
  }

  get textJustify(): 'top' | 'middle' | 'bottom' { return this._data.textJustify || 'middle' }
  set textJustify(val: 'top' | 'middle' | 'bottom') { 
    if (this._data.textJustify !== val) {
      this._data.textJustify = val; 
      this.notifyChange();
    }
  }

  get textColor(): string { return this._data.textColor || '#000000' }
  set textColor(val: string) { 
    if (this._data.textColor !== val) {
      this._data.textColor = val; 
      this.notifyChange();
    }
  }




  get fillDrawStyle(): 'standard' | 'handdrawn' { return this._data.fillDrawStyle || 'standard' }
  set fillDrawStyle(val: 'standard' | 'handdrawn') {
    if (this._data.fillDrawStyle !== val) {
      this._data.fillDrawStyle = val;
      this.notifyChange();
    }
  }

  get strokeDrawStyle(): 'standard' | 'handdrawn' { return this._data.strokeDrawStyle || 'standard' }
  set strokeDrawStyle(val: 'standard' | 'handdrawn') {
    if (this._data.strokeDrawStyle !== val) {
      this._data.strokeDrawStyle = val;
      this.notifyChange();
    }
  }

  get drawStyle(): 'standard' | 'handdrawn' { return this._data.strokeDrawStyle || 'standard' }
  set drawStyle(val: 'standard' | 'handdrawn') {
    // Deprecated: Acts as alias for strokeDrawStyle
    this.strokeDrawStyle = val;
  }

  // Setters (return true if changed)
  setFill(color: string): boolean {
    if (this._data.fill !== color) {
      this._data.fill = color;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFillOpacity(opacity: number): boolean {
    if (this._data.fillOpacity !== opacity) {
      this._data.fillOpacity = opacity;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setStroke(color: string): boolean {
    if (this._data.stroke !== color) {
      this._data.stroke = color;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setStrokeWidth(px: number): boolean {
    if (this._data.strokeWidth !== px) {
      this._data.strokeWidth = px;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setStrokeOpacity(opacity: number): boolean {
    if (this._data.strokeOpacity !== opacity) {
      this._data.strokeOpacity = opacity;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setStrokeStyle(style: 'solid' | 'dashed' | 'dotted' | 'none'): boolean {
    if (this._data.strokeStyle !== style) {
      this._data.strokeStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFillStyle(style: 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'none'): boolean {
    if (this._data.fillStyle !== style) {
      this._data.fillStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFontSize(size: number): boolean {
    if (this._data.fontSize !== size) {
      this._data.fontSize = size;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFontFamily(family: string): boolean {
    if (this._data.fontFamily !== family) {
      this._data.fontFamily = family;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFontWeight(weight: 'normal' | 'bold'): boolean {
    if (this._data.fontWeight !== weight) {
      this._data.fontWeight = weight;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFontStyle(style: 'normal' | 'italic'): boolean {
    if (this._data.fontStyle !== style) {
      this._data.fontStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setTextDecoration(decoration: string): boolean {
    if (this._data.textDecoration !== decoration) {
      this._data.textDecoration = decoration;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setTextAlign(align: 'left' | 'center' | 'right'): boolean {
    if (this._data.textAlign !== align) {
      this._data.textAlign = align;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setTextJustify(justify: 'top' | 'middle' | 'bottom'): boolean {
    if (this._data.textJustify !== justify) {
      this._data.textJustify = justify;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setTextColor(color: string): boolean {
    if (this._data.textColor !== color) {
      this._data.textColor = color;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setDrawStyle(style: 'standard' | 'handdrawn'): boolean {
    if (this._data.drawStyle !== style) {
      this._data.drawStyle = style;
      this._data.fillDrawStyle = style;
      this._data.strokeDrawStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setFillDrawStyle(style: 'standard' | 'handdrawn'): boolean {
    if (this._data.fillDrawStyle !== style) {
      this._data.fillDrawStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }

  setStrokeDrawStyle(style: 'standard' | 'handdrawn'): boolean {
    if (this._data.strokeDrawStyle !== style) {
      this._data.strokeDrawStyle = style;
      this.notifyChange();
      return true;
    }
    return false;
  }
  
  // Render appearance properties to an SVG element
  render(element: SVGGraphicsElement | SVGElement): void {
    // Render fill
    // If fillStyle suggests a rough fill (hachure/cross-hatch) OR fillDrawStyle is handdrawn,
    // we should NOT render the standard SVG fill here (it will continue to be handled by the specific shape's renderer).
    // However, some shapes might use appearance.render as the ONLY render method.
    // Ideally, ShapeAppearance should render the standard attributes, and the Shape class should override if needed.
    // BUT, to fix the reported bug where standard attributes persist, we explicitly clear them if handdrawn.
    const isRoughFill = this.fillStyle === 'hachure' || this.fillStyle === 'cross-hatch' || this.fillDrawStyle === 'handdrawn'

    if (this.fillStyle === 'none' || (isRoughFill && this.fillStyle !== 'solid')) {
      // If it's a rough fill (and not explicitly solid which might act as background), we generally don't want standard fill.
      // But wait, hachure fills in rough.js often have NO background.
      // Recent logic change: hachure takes precedence.
      // If hachure, we don't want standard fill.
      if (isRoughFill) {
        element.setAttribute('fill', 'none')
        // Don't set opacity to 0, just 'none' fill
      } else {
        element.setAttribute('fill', 'none')
      }
    } else {
      element.setAttribute('fill', this.fill)
      element.setAttribute('fill-opacity', String(this.fillOpacity))
    }

    // Render stroke
    if (this.strokeStyle === 'none' || this.strokeDrawStyle === 'handdrawn') {
      element.setAttribute('stroke', 'none')
      element.removeAttribute('stroke-dasharray')
    } else {
      element.setAttribute('stroke', this.stroke)
      element.setAttribute('stroke-width', String(this.strokeWidth))
      element.setAttribute('stroke-opacity', String(this.strokeOpacity))

      element.setAttribute('stroke-linecap', 'round')

      // Map stroke style to dasharray (scaled to strokeWidth)
      const sw = this.strokeWidth
      if (this.strokeStyle === 'dashed') {
        element.setAttribute('stroke-dasharray', `16 ${16 + sw}`)
      } else if (this.strokeStyle === 'dotted') {
        element.setAttribute('stroke-dasharray', `${Math.max(1, sw * 0.5)} ${sw * 2.2}`)
      } else {
        element.removeAttribute('stroke-dasharray')
      }
    }
  }

  // Serialization
  toJSON(): ShapeAppearanceData {
    return { ...this._data }
  }
}
