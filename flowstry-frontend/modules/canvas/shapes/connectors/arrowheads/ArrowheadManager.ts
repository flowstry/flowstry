import { ARROWHEAD_DEFINITIONS } from './definitions'
import { ArrowheadType } from './types'

export class ArrowheadManager {
    /**
     * Get the arrowhead size (refX) for a given arrowhead type, scaled by stroke width
     * @param arrowheadType The arrowhead type
     * @param strokeWidth The stroke width of the connector
     * @returns The scaled refX value (distance from endpoint to arrowhead start)
     */
    static getArrowheadSize(arrowheadType: ArrowheadType, strokeWidth: number): number {
        if (arrowheadType === 'none') return 0

        const baseStrokeWidth = 2
        const scale = strokeWidth / baseStrokeWidth
        
        const def = ARROWHEAD_DEFINITIONS[arrowheadType]
        if (!def) return 12 * scale // Default fallback

        // For crows-foot types, we use specific baseRefX values that might differ from the definition's refX
        // The definition's refX is for the marker attachment point
        // This function returns the "size" or offset to shorten the line
        
        // Logic from original base.ts:
        let baseRefX = 12
        
        switch (arrowheadType) {
            case 'open-arrow':
                baseRefX = 12
                break
            case 'filled-triangle':
            case 'hollow-triangle':
                baseRefX = 14
                break
            case 'hollow-diamond':
            case 'filled-diamond':
                baseRefX = 16
                break
            case 'circle':
            case 'filled-circle':
            case 'bar':
            case 'half-arrow-top':
            case 'half-arrow-bottom':
                baseRefX = 12
                break
            case 'crows-foot-one':
            case 'crows-foot-many':
            case 'crows-foot-one-many':
                baseRefX = 32
                break
            case 'crows-foot-zero-one':
                baseRefX = 22
                break
            case 'crows-foot-zero-many':
                baseRefX = 24
                break
            default:
                baseRefX = 12
        }
        
        return baseRefX * scale
    }

    /**
     * Create a local marker element
     */
    static createMarker(
        defsElement: SVGDefsElement,
        type: ArrowheadType,
        id: string,
        orientAngle: number,
        stroke: string,
        strokeWidth: number
    ): void {
        if (type === 'none') return

        const def = ARROWHEAD_DEFINITIONS[type]
        if (!def) return

        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')
        marker.setAttribute('id', id)
        marker.setAttribute('markerUnits', 'userSpaceOnUse')
        marker.setAttribute('orient', String(orientAngle))
        marker.setAttribute('overflow', 'visible')

        // Scale factor: base stroke width is 2px, scale proportionally
        const baseStrokeWidth = 2
        const scale = strokeWidth / baseStrokeWidth

        // Scale dimensions and path coordinates
        const width = def.width * scale
        const height = def.height * scale
        const refX = def.refX * scale
        const refY = def.refY * scale
        const pathD = this.scalePath(def.pathD, scale)

        marker.setAttribute('markerWidth', String(width))
        marker.setAttribute('markerHeight', String(height))
        marker.setAttribute('refX', String(refX))
        marker.setAttribute('refY', String(refY))

        // Determine fill
        let fill = 'none'
        if (def.fill === 'stroke') {
            fill = stroke
        } else if (def.fill) {
            fill = def.fill
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', pathD)
        path.setAttribute('stroke', stroke)
        path.setAttribute('stroke-width', String(strokeWidth))
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('stroke-linejoin', 'round')
        path.setAttribute('fill', fill)

        marker.appendChild(path)
        defsElement.appendChild(marker)
    }

    /**
     * Scale SVG path coordinates by a factor
     */
    /**
     * Update an existing path element to represent an arrowhead
     */
    static updateArrowheadPath(
        pathElement: SVGPathElement,
        type: ArrowheadType,
        point: { x: number; y: number },
        angle: number,
        stroke: string,
        strokeWidth: number
    ): void {
        if (type === 'none') {
            pathElement.setAttribute('d', '')
            return
        }

        const def = ARROWHEAD_DEFINITIONS[type as Exclude<ArrowheadType, 'none'>]
        if (!def) {
            pathElement.setAttribute('d', '')
            return
        }

        // Scale factor: base stroke width is 2px, scale proportionally
        const baseStrokeWidth = 2
        const scale = strokeWidth / baseStrokeWidth

        // Apply styles
        pathElement.setAttribute('stroke', stroke)
        // Fix: Use baseStrokeWidth because the scale transform already scales the stroke
        pathElement.setAttribute('stroke-width', String(baseStrokeWidth))

        // Determine fill
        let fill = 'none'
        if (def.fill === 'stroke') {
            fill = stroke
        } else if (def.fill) {
            fill = def.fill
        }
        pathElement.setAttribute('fill', fill)

        // Set path data (unscaled, we use transform for scaling)
        pathElement.setAttribute('d', def.pathD)

        // Calculate transform
        // 1. Translate to the connection point
        // 2. Rotate by the calculated angle
        // 3. Scale by stroke width ratio
        // 4. Translate by -refX, -refY to align the attachment point to (0,0)

        const transform = `translate(${point.x}, ${point.y}) rotate(${angle}) scale(${scale}) translate(${-def.refX}, ${-def.refY})`
        pathElement.setAttribute('transform', transform)
    }

    /**
     * Scale SVG path coordinates by a factor
     * @deprecated Used for markers, now we use CSS transform scale
     */
    private static scalePath(pathD: string, scale: number): string {
        const commands = pathD.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []
        
        return commands.map(cmd => {
            const command = cmd[0]
            const coords = cmd.slice(1).trim()
            
            if (command === 'Z' || command === 'z') {
                return command
            }
            
            if (command === 'A' || command === 'a') {
                const parts = coords.split(/[\s,]+/).filter(p => p !== '')
                if (parts.length >= 7) {
                    parts[0] = String(parseFloat(parts[0]) * scale)
                    parts[1] = String(parseFloat(parts[1]) * scale)
                    parts[5] = String(parseFloat(parts[5]) * scale)
                    parts[6] = String(parseFloat(parts[6]) * scale)
                    return command + ' ' + parts.join(' ')
                }
            }
            
            const scaled = coords.replace(/(-?\d+\.?\d*)/g, (match) => {
                return String(parseFloat(match) * scale)
            })
            return command + scaled
        }).join(' ')
    }
}
