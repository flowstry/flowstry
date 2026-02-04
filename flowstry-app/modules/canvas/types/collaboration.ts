// Collaboration Types for Live Collaboration Feature
// These types mirror the Go backend message types from the live-collab-service

export interface CollabMessage<T = any> {
  type: string;
  sessionId?: string;
  userId?: string;
  timestamp?: number;
  payload?: T;
}

// Client → Server message types
export const MSG_TYPE_JOIN_SESSION = 'join_session';
export const MSG_TYPE_LEAVE_SESSION = 'leave_session';
export const MSG_TYPE_ACTION = 'action';
export const MSG_TYPE_CURSOR_MOVE = 'cursor_move';
export const MSG_TYPE_SELECTION_CHANGE = 'selection_change';
export const MSG_TYPE_VIEWPORT_CHANGE = 'viewport_change';
export const MSG_TYPE_LASER_POINTER = 'laser_pointer';
export const MSG_TYPE_PING = 'ping';

// Server → Client message types
export const MSG_TYPE_SESSION_JOINED = 'session_joined';
export const MSG_TYPE_SESSION_CREATED = 'session_created';
export const MSG_TYPE_USER_JOINED = 'user_joined';
export const MSG_TYPE_USER_LEFT = 'user_left';
export const MSG_TYPE_ACTION_BROADCAST = 'action_broadcast';
export const MSG_TYPE_PRESENCE_UPDATE = 'presence_update';
export const MSG_TYPE_USERS_PRESENCE = 'users_presence';
export const MSG_TYPE_PONG = 'pong';
export const MSG_TYPE_ERROR = 'error';

// Payloads
export interface JoinSessionPayload {
  sessionId?: string;  // Empty to create new session
  displayName: string;
  diagramId?: string;
  token?: string;
  avatarUrl?: string;
}

export interface UserInfo {
  id: string;
  displayName: string;
  color: string;
  isAnonymous: boolean;
  avatarUrl?: string;
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  creatorId: string;
  userCount: number;
  metadata?: Record<string, any>;
}

export interface SessionJoinedPayload {
  sessionId: string;
  user: UserInfo;
  users: UserInfo[];  // Existing users in the session
  session: SessionInfo;
}

export interface SessionCreatedPayload {
  sessionId: string;
  user: UserInfo;
  session: SessionInfo;
}

export interface UserJoinedPayload {
  user: UserInfo;
}

export interface UserLeftPayload {
  userId: string;
  displayName: string;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface SelectionChangePayload {
  shapeIds: string[];
}

export interface ViewportChangePayload {
  x: number;
  y: number;
  zoom: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  timestamp: number;
}

export type LaserPointerPhase = 'start' | 'move' | 'end';

export interface LaserPointerPayload {
  strokeId: string;
  phase: LaserPointerPhase;
  point: LaserPoint;
}

export interface PresenceUpdatePayload {
  userId: string;
  cursor?: CursorPosition;
  selection?: SelectionChangePayload;
  viewport?: ViewportChangePayload;
}

export interface UserPresence {
  userId: string;
  displayName: string;
  color: string;
  avatarUrl?: string;
  cursor?: CursorPosition;
  selection?: SelectionChangePayload;
  viewport?: ViewportChangePayload;
}

export interface UsersPresencePayload {
  users: UserPresence[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface ActionBroadcastPayload {
  action: any;  // Serialized action/snapshot data
  actionType: 'snapshot' | 'incremental';  // Type of action
}

// Frontend collaboration state
export interface CollaborationState {
  isConnected: boolean;
  sessionId: string | null;
  currentUser: UserInfo | null;
  remoteUsers: Map<string, UserPresence>;  // userId -> presence
  diagramId: string | null;
}

// Event types for collaboration events
export type CollaborationEventType = 
  | 'connected'
  | 'disconnected'
  | 'user-joined'
  | 'user-left'
  | 'presence-update'
  | 'action-received'
  | 'laser-pointer'
  | 'error';

export interface CollaborationEvent {
  type: CollaborationEventType;
  data?: any;
}
