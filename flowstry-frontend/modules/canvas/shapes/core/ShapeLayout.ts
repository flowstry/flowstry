
import { ShapeLayoutData } from '../../core/storage/types'

export class ShapeLayout {
  private _data: ShapeLayoutData
  private _listeners: Array<(detail: {
    prevX: number, prevY: number, prevWidth: number, prevHeight: number,
    newX: number, newY: number, newWidth: number, newHeight: number
  }) => void> = []

  constructor(xOrData: number | ShapeLayoutData, y?: number, width?: number, height?: number) {
    if (typeof xOrData === 'object') {
      this._data = xOrData
    } else {
      this._data = {
        x: xOrData,
        y: y!,
        width: width!,
        height: height!
      }
    }
  }

  setOnChange(callback: (detail: {
    prevX: number, prevY: number, prevWidth: number, prevHeight: number,
    newX: number, newY: number, newWidth: number, newHeight: number
  }) => void) {
    this._listeners = [callback]
  }

  addOnChange(callback: (detail: {
    prevX: number, prevY: number, prevWidth: number, prevHeight: number,
    newX: number, newY: number, newWidth: number, newHeight: number
  }) => void) {
    this._listeners.push(callback)
  }

  removeOnChange(callback: (detail: {
    prevX: number, prevY: number, prevWidth: number, prevHeight: number,
    newX: number, newY: number, newWidth: number, newHeight: number
  }) => void) {
    this._listeners = this._listeners.filter(l => l !== callback)
  }

  private notifyChange(prevX: number, prevY: number, prevWidth: number, prevHeight: number) {
    const detail = {
      prevX, prevY, prevWidth, prevHeight,
      newX: this._data.x, newY: this._data.y, newWidth: this._data.width, newHeight: this._data.height
    }
    this._listeners.forEach(l => l(detail))
  }

  // Position Accessors
  get x(): number { return this._data.x }
  set x(val: number) { 
    if (this._data.x !== val) {
      this._data.x = val
    }
  }

  get y(): number { return this._data.y }
  set y(val: number) { 
    if (this._data.y !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.y = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  get width(): number { return this._data.width }
  set width(val: number) { 
    if (this._data.width !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.width = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  get height(): number { return this._data.height }
  set height(val: number) { 
    if (this._data.height !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.height = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  get rotation(): number { return (this._data as any).rotation || 0 }
  set rotation(val: number) { 
    if ((this._data as any).rotation !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
        ; (this._data as any).rotation = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  get parentId(): string | null { return this._data.parentId ?? null }
  set parentId(val: string | null) { 
    if (this._data.parentId !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.parentId = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  get frameId(): string | null { return this._data.frameId ?? null }
  set frameId(val: string | null) { 
    if (this._data.frameId !== val) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.frameId = val
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  // Geometry Methods
  get center(): { x: number; y: number } {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2
    }
  }

  get bounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    }
  }

  getBBox(): DOMRect {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      top: this.y,
      left: this.x,
      right: this.x + this.width,
      bottom: this.y + this.height,
      toJSON: () => ({})
    } as unknown as DOMRect
  }

  // Logic
  containsPoint(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height
  }

  move(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
    this._data.x += dx
    this._data.y += dy
    this.notifyChange(prevX, prevY, prevW, prevH)
  }

  resize(x: number, y: number, width: number, height: number): void {
    if (this._data.x !== x || this._data.y !== y || this._data.width !== width || this._data.height !== height) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.x = x
      this._data.y = y
      this._data.width = width
      this._data.height = height
      this.notifyChange(prevX, prevY, prevW, prevH)
    }
  }

  // Updates layout bounds and returns true if changed
  updateBounds(x: number, y: number, width: number, height: number, minSize: number = 1): boolean {
    const newWidth = Math.max(minSize, width)
    const newHeight = Math.max(minSize, height)
    
    if (this._data.x !== x || this._data.y !== y || this._data.width !== newWidth || this._data.height !== newHeight) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.x = x
      this._data.y = y
      this._data.width = newWidth
      this._data.height = newHeight
      this.notifyChange(prevX, prevY, prevW, prevH)
      return true
    }
    return false
  }

  // Updates position and returns true if changed
  updatePosition(x: number, y: number): boolean {
    if (this._data.x !== x || this._data.y !== y) {
      const prevX = this._data.x, prevY = this._data.y, prevW = this._data.width, prevH = this._data.height
      this._data.x = x
      this._data.y = y
      this.notifyChange(prevX, prevY, prevW, prevH)
      return true
    }
    return false
  }
  
  // Render layout properties
  render(_element: SVGGraphicsElement | SVGElement): void {
    // Layout rendering is typically handled by specific shape subclasses
    // or by the resize() method, as different shapes map x/y/w/h to different attributes
    // (e.g. rect uses x/y/width/height, ellipse uses cx/cy/rx/ry)
  }

  // Serialization
  toJSON(): ShapeLayoutData {
    return { ...this._data }
  }
}
