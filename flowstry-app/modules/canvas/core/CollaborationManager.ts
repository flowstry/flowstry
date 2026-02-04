/**
 * CollaborationManager
 * WebSocket client manager for handling real-time collaboration
 */

import {
  type ActionBroadcastPayload,
  type CollabMessage,
  type CollaborationEvent,
  type CollaborationEventType,
  type CollaborationState,
  type CursorPosition,
  type JoinSessionPayload,
  type LaserPointerPayload,
  MSG_TYPE_ACTION,
  MSG_TYPE_ACTION_BROADCAST,
  MSG_TYPE_CURSOR_MOVE,
  MSG_TYPE_JOIN_SESSION,
  MSG_TYPE_LASER_POINTER,
  MSG_TYPE_LEAVE_SESSION,
  MSG_TYPE_PRESENCE_UPDATE,
  MSG_TYPE_SELECTION_CHANGE,
  MSG_TYPE_SESSION_CREATED,
  MSG_TYPE_SESSION_JOINED,
  MSG_TYPE_USER_JOINED,
  MSG_TYPE_USER_LEFT,
  type PresenceUpdatePayload,
  type SessionCreatedPayload,
  type SessionJoinedPayload,
  type UserJoinedPayload,
  type UserLeftPayload,
  type UserPresence,
} from '../types/collaboration';

const RECONNECT_DELAY = 3000; // 3 seconds
const CURSOR_THROTTLE_MS = 50; // 50ms throttle for cursor updates
const PING_INTERVAL_MS = 30000; // 30 seconds

export class CollaborationManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private state: CollaborationState;
  private eventListeners: Map<CollaborationEventType, Set<(event: CollaborationEvent) => void>>;
  private reconnectTimeout: number | null = null;
  private pingInterval: number | null = null;
  private lastCursorUpdate: number = 0;
  private pendingCursorUpdate: CursorPosition | null = null;
  private cursorThrottleTimeout: number | null = null;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.state = {
      isConnected: false,
      sessionId: null,
      currentUser: null,
      remoteUsers: new Map(),
      diagramId: null,
    };
    this.eventListeners = new Map();
  }

  /**
   * Connect to collaboration service and join/create a session
   */
  public connect(diagramId: string, displayName: string, avatarUrl?: string, token?: string): void {
    this.state.diagramId = diagramId;

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[CollaborationManager] WebSocket connected');
        this.startPingInterval();
        this.joinSession(diagramId, displayName, avatarUrl, token);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[CollaborationManager] WebSocket error:', error);
        this.emit('error', { error });
      };

      this.ws.onclose = () => {
        console.log('[CollaborationManager] WebSocket closed');
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('[CollaborationManager] Failed to create WebSocket:', error);
      this.emit('error', { error });
    }
  }

  /**
   * Disconnect from collaboration service
   */
  public disconnect(): void {
    clearTimeout(this.reconnectTimeout ?? undefined);
    this.stopPingInterval();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send leave message
      this.send({
        type: MSG_TYPE_LEAVE_SESSION,
        sessionId: this.state.sessionId ?? undefined,
        userId: this.state.currentUser?.id ?? undefined,
      });
      this.ws.close();
    }

    this.ws = null;
    this.state.isConnected = false;
    this.state.sessionId = null;
    this.state.currentUser = null;
    this.state.remoteUsers.clear();
  }

  /**
   * Send cursor position update (throttled)
   */
  public updateCursor(x: number, y: number): void {
    if (!this.state.isConnected || !this.state.sessionId) return;

    const now = Date.now();
    this.pendingCursorUpdate = { x, y };

    // If we haven't sent an update recently, send immediately
    if (now - this.lastCursorUpdate >= CURSOR_THROTTLE_MS) {
      this.sendCursorUpdate();
    } else {
      // Otherwise, schedule a throttled update
      if (this.cursorThrottleTimeout === null) {
        this.cursorThrottleTimeout = window.setTimeout(() => {
          this.sendCursorUpdate();
        }, CURSOR_THROTTLE_MS - (now - this.lastCursorUpdate));
      }
    }
  }

  /**
   * Send selection change update
   */
  public updateSelection(shapeIds: string[]): void {
    if (!this.state.isConnected || !this.state.sessionId) return;

    this.send({
      type: MSG_TYPE_SELECTION_CHANGE,
      sessionId: this.state.sessionId,
      userId: this.state.currentUser?.id,
      payload: {
        shapeIds,
      },
    });
  }

  /**
   * Send an action (canvas state change) to other users
   */
  public sendAction(snapshot: any): void {
    if (!this.state.isConnected || !this.state.sessionId) return;

    this.send({
      type: MSG_TYPE_ACTION,
      sessionId: this.state.sessionId,
      userId: this.state.currentUser?.id,
      payload: {
        action: snapshot,
        actionType: 'snapshot',
      },
    });
  }

  /**
   * Send laser pointer event to other users
   */
  public sendLaserPointer(payload: LaserPointerPayload): void {
    if (!this.state.isConnected || !this.state.sessionId) return;

    this.send({
      type: MSG_TYPE_LASER_POINTER,
      sessionId: this.state.sessionId,
      userId: this.state.currentUser?.id,
      payload,
    });
  }


  /**
   * Get current collaboration state
   */
  public getState(): Readonly<CollaborationState> {
    return this.state;
  }

  /**
   * Get remote users as array
   */
  public getRemoteUsers(): UserPresence[] {
    return Array.from(this.state.remoteUsers.values());
  }

  /**
   * Subscribe to collaboration events
   */
  public on(eventType: CollaborationEventType, callback: (event: CollaborationEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  /**
   * Unsubscribe from collaboration events
   */
  public off(eventType: CollaborationEventType, callback: (event: CollaborationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // Private methods

  private joinSession(diagramId: string, displayName: string, avatarUrl?: string, token?: string): void {
    const payload: JoinSessionPayload = {
      sessionId: '', // Let server find or create session based on diagramId
      displayName,
      avatarUrl,
      diagramId,
      token,
    };

    this.send({
      type: MSG_TYPE_JOIN_SESSION,
      payload,
    });
  }

  private send(message: CollabMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendCursorUpdate(): void {
    if (!this.pendingCursorUpdate) return;

    this.send({
      type: MSG_TYPE_CURSOR_MOVE,
      sessionId: this.state.sessionId ?? undefined,
      userId: this.state.currentUser?.id ?? undefined,
      payload: this.pendingCursorUpdate,
    });

    this.lastCursorUpdate = Date.now();
    this.pendingCursorUpdate = null;
    this.cursorThrottleTimeout = null;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as CollabMessage;

      switch (message.type) {
        case MSG_TYPE_SESSION_CREATED:
          this.handleSessionCreated(message.payload as SessionCreatedPayload);
          break;
        case MSG_TYPE_SESSION_JOINED:
          this.handleSessionJoined(message.payload as SessionJoinedPayload);
          break;
        case MSG_TYPE_USER_JOINED:
          this.handleUserJoined(message.payload as UserJoinedPayload);
          break;
        case MSG_TYPE_USER_LEFT:
          this.handleUserLeft(message.payload as UserLeftPayload);
          break;
        case MSG_TYPE_ACTION_BROADCAST:
          this.handleActionBroadcast(message.payload as ActionBroadcastPayload);
          break;
        case MSG_TYPE_SELECTION_CHANGE:
          // Convert selection change to presence update
          if (message.userId) {
            this.handlePresenceUpdate({
              userId: message.userId,
              selection: message.payload,
            });
          }
          break;
        case MSG_TYPE_CURSOR_MOVE:
          if (message.userId) {
            this.handlePresenceUpdate({
              userId: message.userId,
              cursor: message.payload,
            });
          }
          break;
        case MSG_TYPE_LASER_POINTER:
          if (message.userId) {
            this.emit('laser-pointer', { userId: message.userId, payload: message.payload });
          }
          break;
        case MSG_TYPE_PRESENCE_UPDATE:
          this.handlePresenceUpdate(message.payload as PresenceUpdatePayload);
          break;
        default:
          // console.log('[CollaborationManager] Unhandled message type:', message.type);
          break;
      }
    } catch (error) {
      console.error('[CollaborationManager] Failed to parse message:', error);
    }
  }

  private handleSessionCreated(payload: SessionCreatedPayload): void {
    console.log('[CollaborationManager] Session created:', payload.sessionId);
    this.state.isConnected = true;
    this.state.sessionId = payload.sessionId;
    this.state.currentUser = payload.user;
    this.emit('connected', { sessionId: payload.sessionId, user: payload.user });
  }

  private handleSessionJoined(payload: SessionJoinedPayload): void {
    console.log('[CollaborationManager] Session joined:', payload.sessionId);
    this.state.isConnected = true;
    this.state.sessionId = payload.sessionId;
    this.state.currentUser = payload.user;

    // Add existing users to remote users map
    payload.users.forEach((user) => {
      this.state.remoteUsers.set(user.id, {
        userId: user.id,
        displayName: user.displayName,
        color: user.color,
        avatarUrl: user.avatarUrl,
      });
    });

    this.emit('connected', {
      sessionId: payload.sessionId,
      user: payload.user,
      existingUsers: payload.users,
    });
  }

  private handleUserJoined(payload: UserJoinedPayload): void {
    console.log('[CollaborationManager] User joined:', payload.user.displayName);
    this.state.remoteUsers.set(payload.user.id, {
      userId: payload.user.id,
      displayName: payload.user.displayName,
      color: payload.user.color,
      avatarUrl: payload.user.avatarUrl,
    });
    this.emit('user-joined', { user: payload.user });
  }

  private handleUserLeft(payload: UserLeftPayload): void {
    console.log('[CollaborationManager] User left:', payload.displayName);
    this.state.remoteUsers.delete(payload.userId);
    this.emit('user-left', { userId: payload.userId, displayName: payload.displayName });
  }

  private handleActionBroadcast(payload: ActionBroadcastPayload): void {
    console.log('[CollaborationManager] Action broadcast received');
    // Emit action-received event with the snapshot data
    this.emit('action-received', { snapshot: payload.action });
  }


  private handlePresenceUpdate(payload: PresenceUpdatePayload): void {
    // Don't process our own presence updates
    if (payload.userId === this.state.currentUser?.id) return;

    const existingUser = this.state.remoteUsers.get(payload.userId);
    if (!existingUser) return;

    // Update user presence
    const updatedUser: UserPresence = {
      ...existingUser,
      cursor: payload.cursor ?? existingUser.cursor,
      selection: payload.selection ?? existingUser.selection,
      viewport: payload.viewport ?? existingUser.viewport,
    };

    this.state.remoteUsers.set(payload.userId, updatedUser);
    this.emit('presence-update', { userId: payload.userId, presence: updatedUser });
  }

  private handleDisconnect(): void {
    this.state.isConnected = false;
    this.stopPingInterval();
    this.emit('disconnected', {});

    // Attempt to reconnect
    if (this.state.diagramId) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout !== null) return;

    console.log(`[CollaborationManager] Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.state.diagramId && this.state.currentUser) {
        this.connect(this.state.diagramId, this.state.currentUser.displayName);
      }
    }, RECONNECT_DELAY);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, PING_INTERVAL_MS);
  }

  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private emit(eventType: CollaborationEventType, data?: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const event: CollaborationEvent = { type: eventType, data };
      listeners.forEach((callback) => callback(event));
    }
  }
}
