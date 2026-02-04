/**
 * Base interface for storage plugins
 * Allows for different storage backends (localStorage, file, cloud, etc.)
 */
import { CanvasSettings } from '../SettingsManager';
import { DiagramData, LoadOptions, SaveOptions } from './types';

export type { DiagramData, LoadOptions, SaveOptions, ShapeData } from './types';

/**
 * Abstract base class for storage plugins
 */
export abstract class StoragePlugin {
  abstract readonly name: string;
  abstract readonly type: 'local' | 'file' | 'cloud';

  /**
   * Save diagram data
   * @returns Promise that resolves to true if save was successful
   */
  abstract save(data: DiagramData, options?: SaveOptions): Promise<boolean>;

  /**
   * Load diagram data
   * @returns Promise that resolves to diagram data or null if not found
   */
  abstract load(options?: LoadOptions): Promise<DiagramData | null>;

  /**
   * Check if data exists
   */
  abstract hasData(): Promise<boolean>;

  /**
   * Clear/delete saved data
   */
  abstract clear(): Promise<boolean>;

  /**
   * Get metadata about saved data (e.g., last saved time)
   */
  abstract getMetadata(): Promise<Record<string, any> | null>;

  /**
   * Save settings data
   * @returns Promise that resolves to true if save was successful
   */
  abstract saveSettings(settings: CanvasSettings): Promise<boolean>;

  /**
   * Load settings data
   * @returns Promise that resolves to settings or null if not found
   */
  abstract loadSettings(): Promise<CanvasSettings | null>;
}

