import { ShapeAppearance } from "../shapes/base";

export interface ColorPalette {
    id: string;
    name: string;
    colors: {
        fill: string;
        stroke: string;
        textColor: string;
    };
}

export const COLOR_PALETTES: ColorPalette[] = [
    {
        id: 'default',
        name: 'Default',
        colors: {
            fill: '#ffffff',
            stroke: '#000000',
            textColor: '#000000'
        }
    },
    {
        id: 'soft-blue',
        name: 'Soft Blue',
        colors: {
            fill: '#E3F2FD',
            stroke: '#1E88E5',
            textColor: '#0D47A1'
        }
    },
    {
        id: 'mint-fresh',
        name: 'Mint Fresh',
        colors: {
            fill: '#E0F2F1',
            stroke: '#00897B',
            textColor: '#004D40'
        }
    },
    {
        id: 'sunset-glow',
        name: 'Sunset Glow',
        colors: {
            fill: '#FFF3E0',
            stroke: '#FB8C00',
            textColor: '#E65100'
        }
    },
    {
        id: 'lavender-dream',
        name: 'Lavender Dream',
        colors: {
            fill: '#F3E5F5',
            stroke: '#8E24AA',
            textColor: '#4A148C'
        }
    },
    {
        id: 'slate-modern',
        name: 'Slate Modern',
        colors: {
            fill: '#ECEFF1',
            stroke: '#546E7A',
            textColor: '#263238'
        }
    },
    {
        id: 'dark-mode',
        name: 'Dark Mode',
        colors: {
            fill: '#262626',
            stroke: '#525252',
            textColor: '#E5E5E5'
        }
    },
    {
        id: 'rose-gold',
        name: 'Rose Gold',
        colors: {
            fill: '#FCE4EC',
            stroke: '#D81B60',
            textColor: '#880E4F'
        }
    }
];

export const getColorPaletteById = (id: string): ColorPalette | undefined => {
    return COLOR_PALETTES.find(p => p.id === id);
};

export const applyPaletteToAppearance = (appearance: ShapeAppearance, palette: ColorPalette) => {
    appearance.fill = palette.colors.fill;
    appearance.stroke = palette.colors.stroke;
    appearance.textColor = palette.colors.textColor;
};
