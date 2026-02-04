
export class ShapeIntent<T = any> {
  private _data: T

  constructor(data: T) {
    this._data = data
  }

  get data(): T { return this._data }
  set data(val: T) { this._data = val }
  
  // Logic for intent updates can go here
}
