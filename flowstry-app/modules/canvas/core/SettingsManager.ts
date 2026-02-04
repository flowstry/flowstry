import { authClient } from "@/lib/auth-client";
import { UserPreferences } from "@/lib/auth-types";
import { GRID_DOT_COLOR } from "../consts/canvas";
import { ShapeAppearanceData } from "./storage/types";

// Canvas theme includes all visual settings AND grid configuration
export interface CanvasTheme {
    name: string;
    backgroundColor: string;
    gridColor: string;
    gridStyle: 'dots' | 'lines';
    showGrid: boolean;  // Whether grid is visible for this theme
}

export interface CanvasSettings {
    uiTheme: 'light' | 'dark';  // UI elements theme (menus, modals, etc.)
    canvasTheme: CanvasTheme;    // Canvas visual style including grid settings
    snapToGrid: boolean;         // Snap behavior (only works when showGrid is true)
    defaultShapeAppearance?: Partial<ShapeAppearanceData>; // Default styles for new shapes
}

export const DEFAULT_CANVAS_THEME: CanvasTheme = {
    name: 'Default',
    backgroundColor: '#F2F2F2',
    gridColor: GRID_DOT_COLOR,
    gridStyle: 'dots',
    showGrid: true
};

// Canvas visual presets - each has its own grid configuration
export const CANVAS_THEMES: CanvasTheme[] = [
    DEFAULT_CANVAS_THEME,
    {
        name: 'Paper',
        backgroundColor: '#FFFFFF',
        gridColor: '#E0E0E0',
        gridStyle: 'lines',
        showGrid: true
    },
    {
        name: 'Blueprint',
        backgroundColor: '#E3F2FD',
        gridColor: '#BBDEFB',
        gridStyle: 'lines',
        showGrid: true
    },
    {
        name: 'Warm',
        backgroundColor: '#FDFBF7',
        gridColor: '#EFEBE9',
        gridStyle: 'dots',
        showGrid: true
    },
    {
        name: 'Dark',
        backgroundColor: '#1E1E1E',
        gridColor: '#333333',
        gridStyle: 'dots',
        showGrid: true
    },
    {
        name: 'Midnight',
        backgroundColor: '#0F172A',
        gridColor: '#1E293B',
        gridStyle: 'dots',
        showGrid: true
    },
    {
        name: 'Terminal',
        backgroundColor: '#000000',
        gridColor: '#00FF00',
        gridStyle: 'lines',
        showGrid: true
    },
    {
        name: 'OLED',
        backgroundColor: '#000000',
        gridColor: '#333333',
        gridStyle: 'dots',
        showGrid: true
    }
];

// For backward compatibility
export const DEFAULT_THEME = DEFAULT_CANVAS_THEME;
export const LIGHT_THEMES = CANVAS_THEMES.slice(0, 4);
export const DARK_THEMES = CANVAS_THEMES.slice(4);


// UI Theme storage key
const UI_THEME_KEY = 'flowstry_ui_theme';


export class SettingsManager {
    private settings: CanvasSettings;
    private listeners: Set<(settings: CanvasSettings) => void> = new Set();

    constructor() {
        this.settings = {
            uiTheme: 'light',
            canvasTheme: DEFAULT_CANVAS_THEME,
            snapToGrid: true,
            defaultShapeAppearance: {}
        };

        // Load global settings (UI theme) immediately
        this.loadGlobalSettings();
    }

    /**
     * Load global settings (UI Theme) from localStorage
     * Optionally sync with cloud user preferences if provided
     */
    public loadGlobalSettings(userPrefs?: UserPreferences): void {
        try {
            let loadedTheme: 'light' | 'dark' | null = null;

            // Priority 1: User preferences from cloud (if logged in)
            if (userPrefs?.theme) {
                loadedTheme = userPrefs.theme;
            }

            // Priority 2: LocalStorage (if not logged in or no cloud pref)
            if (!loadedTheme && typeof window !== 'undefined' && window.localStorage) {
                const savedUiTheme = localStorage.getItem(UI_THEME_KEY);
                if (savedUiTheme === 'light' || savedUiTheme === 'dark') {
                    loadedTheme = savedUiTheme;
                }
            }

            if (loadedTheme) {
                const changed = this.settings.uiTheme !== loadedTheme;
                this.settings.uiTheme = loadedTheme;

                // If we synced from cloud, ensure local storage is up to date
                if (userPrefs?.theme && typeof window !== 'undefined' && window.localStorage) {
                    localStorage.setItem(UI_THEME_KEY, loadedTheme);
                }

                if (changed) {
                    this.notifySettingsChange();
                }
            }
        } catch (e) {
            console.error('Failed to load global settings', e);
        }
    }

    /**
     * Save global settings (UI Theme) to localStorage and optionally cloud
     */
    private async saveGlobalSettings(): Promise<void> {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(UI_THEME_KEY, this.settings.uiTheme);
            }

            // Sync with cloud user profile
            try {
                // Sync with cloud user profile
                await authClient.updatePreferences({ theme: this.settings.uiTheme });
            } catch (e) {
            // Ignore auth errors/connectivity issues silently
            }
        } catch (e) {
            console.error('Failed to save global settings', e);
        }
    }

    /**
     * Load canvas settings (Theme, Snap) from diagram data
     * Called by InteractionEngine/StorageManager when loading a diagram
     */
    public loadCanvasSettings(settings: Partial<CanvasSettings>) {
        // Validate and merge with defaults to ensure all properties exist
        const newSettings = {
            ...this.settings,
            // Keep existing UI theme (global), unless strictly required to override? 
            // Usually we don't override global UI theme from diagram data

            // Apply canvas theme from diagram
            canvasTheme: {
                ...this.settings.canvasTheme,
                ...(settings.canvasTheme || (settings as any).theme) // Backward compat
            },

            // Apply snap to grid from diagram
            snapToGrid: settings.snapToGrid !== undefined ? settings.snapToGrid : this.settings.snapToGrid,

            // Apply default shape appearance from diagram
            defaultShapeAppearance: settings.defaultShapeAppearance || this.settings.defaultShapeAppearance || {}
        };

        // Only update and notify if settings actually changed
        const settingsChanged =
            JSON.stringify(newSettings.canvasTheme) !== JSON.stringify(this.settings.canvasTheme) ||
            newSettings.snapToGrid !== this.settings.snapToGrid ||
            JSON.stringify(newSettings.defaultShapeAppearance) !== JSON.stringify(this.settings.defaultShapeAppearance);

        if (settingsChanged) {
            this.settings = newSettings;
            this.notifySettingsChange();
        }
    }

    public getSettings(): CanvasSettings {
        return {
            ...this.settings,
            canvasTheme: { ...this.settings.canvasTheme }
        };
    }

    public updateSettings(newSettings: Partial<CanvasSettings>) {
        const prevUiTheme = this.settings.uiTheme;

        this.settings = { ...this.settings, ...newSettings };

        // If UI theme changed, save globally
        if (newSettings.uiTheme && newSettings.uiTheme !== prevUiTheme) {
            this.saveGlobalSettings();
        }

        this.notifySettingsChange();
    }

    public setUITheme(theme: 'light' | 'dark') {
        const changed = this.settings.uiTheme !== theme;
        this.settings.uiTheme = theme;

        if (changed) {
            this.saveGlobalSettings();
            this.notifySettingsChange();
        }
    }

    public setCanvasTheme(theme: CanvasTheme) {
        this.settings.canvasTheme = theme;
        // Sync snap-to-grid with grid visibility
        if (!theme.showGrid) {
            this.settings.snapToGrid = false;
        }
        this.notifySettingsChange();
    }

    // Backward compatibility - maps to canvasTheme
    public updateTheme(theme: CanvasTheme) {
        this.setCanvasTheme(theme);
    }

    // Update individual canvas theme properties - creates "Custom" theme
    public updateCanvasThemeProperty(updates: Partial<Omit<CanvasTheme, 'name'>>) {
        this.settings.canvasTheme = {
            ...this.settings.canvasTheme,
            ...updates,
            name: 'Custom'  // Any modification creates a custom theme
        };
        
        // Sync snap-to-grid with grid visibility
        if (updates.showGrid === false && this.settings.snapToGrid) {
            this.settings.snapToGrid = false;
        }
        
        this.notifySettingsChange();
    }

    public setSnapToGrid(enabled: boolean) {
        // Only allow snap-to-grid when grid is visible
        if (enabled && !this.settings.canvasTheme.showGrid) {
            return;
        }
        this.settings.snapToGrid = enabled;
        this.notifySettingsChange();
    }

    public setDefaultShapeAppearance(appearance: Partial<ShapeAppearanceData>) {
        this.settings.defaultShapeAppearance = {
            ...this.settings.defaultShapeAppearance,
            ...appearance
        };
        this.notifySettingsChange();
    }

    public setOnSettingsChange(callback: (settings: CanvasSettings) => void) {
        this.listeners.add(callback);
        // Return a cleanup function
        return () => {
            this.listeners.delete(callback);
        };
    }

    // Explicit subscribe alias for clarity
    public subscribe(callback: (settings: CanvasSettings) => void) {
        return this.setOnSettingsChange(callback);
    }

    private notifySettingsChange() {
        const settings = this.getSettings();
        this.listeners.forEach(listener => listener(settings));
    }
}
