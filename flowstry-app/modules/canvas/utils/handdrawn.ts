import type { ShapeAppearance } from '../shapes/core/ShapeAppearance'

export function getRoughOptions(appearance: ShapeAppearance, seed: number, width: number = 0, height: number = 0) {
    const strokeWidth = appearance.strokeStyle !== 'none' ? appearance.strokeWidth : 0
    // Dashed/Dotted lines are slightly thicker visually
    const effectiveStrokeWidth = (appearance.strokeStyle === 'dashed' || appearance.strokeStyle === 'dotted') 
        ? strokeWidth + 0.5 
        : strokeWidth

    // Dynamic roughness based on size
    // Default base roughness 1 (Artist) or user preference 
    const baseRoughness = 1
    const maxDim = Math.max(width, height)
    let roughness = baseRoughness

    // Reduce roughness for small shapes
    if (maxDim < 20) {
        roughness = baseRoughness / 3
    } else if (maxDim < 50) {
        roughness = baseRoughness / 2
    }
    // Cap roughness
    roughness = Math.min(roughness, 2.5)

    const options: any = {
        seed,
        roughness,
        bowing: 1, // Default Excalidraw bowing
        stroke: appearance.strokeStyle !== 'none' ? appearance.stroke : 'none',
        strokeWidth: effectiveStrokeWidth,
        fill: appearance.fillStyle !== 'none' ? appearance.fill : undefined,
        fillStyle: appearance.fillStyle === 'solid' ? 'solid' : (appearance.fillStyle === 'none' ? undefined : appearance.fillStyle),
        fillWeight: appearance.fillStyle !== 'solid' ? strokeWidth / 2 : undefined,
        hachureGap: appearance.fillStyle !== 'solid' ? strokeWidth * 4 : undefined,
        disableMultiStroke: appearance.strokeStyle !== 'solid', // True for dashed/dotted
        maxRandomnessOffset: effectiveStrokeWidth * 1.1,
        disableMultiStrokeFill: true,
        preserveVertices: true, // Critical for continuous paths
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
    }

    if (appearance.strokeStyle === 'dashed') {
        options.strokeLineDash = [16, 16 + effectiveStrokeWidth]
    } else if (appearance.strokeStyle === 'dotted') {
        options.strokeLineDash = [Math.max(1, effectiveStrokeWidth * 0.5), (strokeWidth * 1.2) + effectiveStrokeWidth]
    }

    return options
}
