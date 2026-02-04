/**
 * CollaborationPlugin
 * 
 * Pluggable collaboration system for Canvas.
 * Can be configured for:
 * - Member-only mode (authenticated workspace users)
 * - Public mode (unauthenticated link sharing) [future]
 */

import { CollaborationManager } from '../../core/CollaborationManager';
import type { LaserPointerPayload, UserPresence } from '../../types/collaboration';

export interface CollaborationPluginConfig {
  mode: 'member-only' | 'public';
  wsUrl: string;
  diagramId: string;
  displayName: string;
  avatarUrl?: string;
  token?: string; // For member-only mode
}

export class CollaborationPlugin {
  private manager: CollaborationManager;
  private config: CollaborationPluginConfig;
  private onRemoteUsersChange: ((users: UserPresence[]) => void) | null = null;
  private onActionReceived: ((snapshot: any) => void) | null = null;
  private onLaserPointerReceived: ((event: { userId: string; payload: LaserPointerPayload }) => void) | null = null;

  constructor(config: CollaborationPluginConfig) {
    this.config = config;
    this.manager = new CollaborationManager(config.wsUrl);
  }

  /**
   * Initialize and connect to collaboration service
   */
  public initialize(): void {
    // Subscribe to remote users changes
    this.manager.on('presence-update', () => {
      this.notifyRemoteUsersChange();
    });

    this.manager.on('user-joined', () => {
      this.notifyRemoteUsersChange();
    });

    this.manager.on('user-left', () => {
      this.notifyRemoteUsersChange();
    });

    this.manager.on('connected', () => {
      this.notifyRemoteUsersChange();
    });

    // Subscribe to remote actions
    this.manager.on('action-received', (event) => {
      if (this.onActionReceived) {
        this.onActionReceived(event.data.snapshot);
      }
    });

    // Subscribe to remote laser pointer events
    this.manager.on('laser-pointer', (event) => {
      if (this.onLaserPointerReceived) {
        this.onLaserPointerReceived(event.data);
      }
    });

    // Connect to service
    this.manager.connect(this.config.diagramId, this.config.displayName, this.config.avatarUrl, this.config.token);
  }

  /**
   * Disconnect and cleanup
   */
  public destroy(): void {
    this.manager.disconnect();
    this.onRemoteUsersChange = null;
    this.onLaserPointerReceived = null;
  }

  /**
   * Update cursor position (throttled automatically)
   */
  public updateCursor(canvasX: number, canvasY: number, scale: number, translation: { x: number; y: number }): void {
    // Convert screen coordinates to canvas coordinates
    const worldX = (canvasX - translation.x) / scale;
    const worldY = (canvasY - translation.y) / scale;
    this.manager.updateCursor(worldX, worldY);
  }

  /**
   * Update selection (which shapes current user has selected)
   */
  public updateSelection(shapeIds: string[]): void {
    this.manager.updateSelection(shapeIds);
  }

  /**
   * Get current remote users
   */
  public getRemoteUsers(): UserPresence[] {
    return this.manager.getRemoteUsers();
  }

  /**
   * Subscribe to remote users changes
   */
  public onRemoteUsers(callback: (users: UserPresence[]) => void): void {
    this.onRemoteUsersChange = callback;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.manager.getState().isConnected;
  }

  /**
   * Send an action (canvas state change) to other users
   */
  public sendAction(snapshot: any): void {
    this.manager.sendAction(snapshot);
  }

  /**
   * Send laser pointer event to other users
   */
  public sendLaserPointer(payload: LaserPointerPayload): void {
    this.manager.sendLaserPointer(payload);
  }

  /**
   * Subscribe to action received events
   */
  public onAction(callback: (snapshot: any) => void): void {
    this.onActionReceived = callback;
  }

  /**
   * Subscribe to laser pointer events
   */
  public onLaserPointer(callback: ((event: { userId: string; payload: LaserPointerPayload }) => void) | null): void {
    this.onLaserPointerReceived = callback;
  }

  private notifyRemoteUsersChange(): void {
    if (this.onRemoteUsersChange) {
      this.onRemoteUsersChange(this.manager.getRemoteUsers());
    }
  }
}
