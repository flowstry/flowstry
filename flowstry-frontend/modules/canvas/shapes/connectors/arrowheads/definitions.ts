import { ArrowheadType } from './types'

export interface ArrowheadDefinition {
    width: number
    height: number
    refX: number
    refY: number
    pathD: string
    fill?: string | 'stroke' // 'stroke' means use the stroke color
}

// Note: refX should generally match width to ensure the marker tip aligns with the connection point
// when the line is shortened by the marker size.
export const ARROWHEAD_DEFINITIONS: Record<Exclude<ArrowheadType, 'none'>, ArrowheadDefinition> = {
    'open-arrow': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 0,0 L 12,6 L 0,12"
    },
    'filled-triangle': {
        width: 14, height: 14, refX: 14, refY: 7,
        pathD: "M 0,0 L 14,7 L 0,14 Z",
        fill: 'stroke'
    },
    'hollow-triangle': {
        width: 14, height: 14, refX: 14, refY: 7,
        pathD: "M 0,0 L 14,7 L 0,14 Z",
        fill: '#ffffff'
    },
    'hollow-diamond': {
        width: 16, height: 16, refX: 16, refY: 8,
        pathD: "M 8,0 L 16,8 L 8,16 L 0,8 Z",
        fill: '#ffffff'
    },
    'filled-diamond': {
        width: 16, height: 16, refX: 16, refY: 8,
        pathD: "M 8,0 L 16,8 L 8,16 L 0,8 Z",
        fill: 'stroke'
    },
    'circle': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 6,0 A 6 6 0 1 1 6 12 A 6 6 0 1 1 6 0 Z",
        fill: '#ffffff'
    },
    'filled-circle': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 6,0 A 6 6 0 1 1 6 12 A 6 6 0 1 1 6 0 Z",
        fill: 'stroke'
    },
    'bar': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 0,6 L 12,6 M 12,0 L 12,12"
    },
    'half-arrow-top': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 0,6 L 12,6 L 0,0"
    },
    'half-arrow-bottom': {
        width: 12, height: 12, refX: 12, refY: 6,
        pathD: "M 0,6 L 12,6 L 0,12"
    },
    'crows-foot-one': {
        width: 32, height: 12, refX: 32, refY: 6,
        pathD: "M 0,6 L 32,6 M 22,0 L 22,12 M 14,0 L 14,12"
    },
    'crows-foot-many': {
        width: 32, height: 12, refX: 32, refY: 6,
        pathD: "M 0,6 L 32,6 M 32,0 L 22,6 L 32,12"
    },
    'crows-foot-zero-one': {
        width: 22, height: 12, refX: 22, refY: 6,
        pathD: "M 8,6 L 22,6 M 14,0 L 14,12 M 4,6 m -4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0",
        fill: 'none'
    },
    'crows-foot-zero-many': {
        width: 24, height: 12, refX: 24, refY: 6,
        pathD: "M 8,6 L 24,6 M 24,0 L 14,6 L 24,12 M 4,6 m -4,0 a 4,4 0 1,0 8,0 a 4,4 0 1,0 -8,0",
        fill: 'none'
    },
    'crows-foot-one-many': {
        width: 32, height: 12, refX: 32, refY: 6,
        pathD: "M 0,6 L 32,6 M 14,0 L 14,12 M 32,0 L 22,6 L 32,12"
    }
}
