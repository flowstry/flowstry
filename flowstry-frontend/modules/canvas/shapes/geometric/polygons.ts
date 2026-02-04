import { PolygonShape } from './polygon'

export class HexagonShape extends PolygonShape {
	constructor(x: number, y: number, width = 1, height = 1, fill = '#ffffff', stroke = '#575757', strokeWidth = 4) {
		super('hexagon', 6, x, y, width, height, fill, stroke, strokeWidth)
	}
}

export class PentagonShape extends PolygonShape {
	constructor(x: number, y: number, width = 1, height = 1, fill = '#ffffff', stroke = '#575757', strokeWidth = 4) {
		super('pentagon', 5, x, y, width, height, fill, stroke, strokeWidth)
	}
}
