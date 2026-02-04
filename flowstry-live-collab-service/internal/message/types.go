package message

import (
	"encoding/json"
	"time"
)

// Client -> Server message types
const (
	MsgTypeJoinSession      = "join_session"
	MsgTypeLeaveSession     = "leave_session"
	MsgTypeAction           = "action"
	MsgTypeCursorMove       = "cursor_move"
	MsgTypeSelectionChange  = "selection_change"
	MsgTypeViewportChange   = "viewport_change"
	MsgTypeLaserPointer     = "laser_pointer"
	MsgTypePing             = "ping"
)

// Server -> Client message types
const (
	MsgTypeSessionJoined    = "session_joined"
	MsgTypeSessionCreated   = "session_created"
	MsgTypeUserJoined       = "user_joined"
	MsgTypeUserLeft         = "user_left"
	MsgTypeActionBroadcast  = "action_broadcast"
	MsgTypePresenceUpdate   = "presence_update"
	MsgTypeUsersPresence    = "users_presence"
	MsgTypePong             = "pong"
	MsgTypeError            = "error"
)

// Action types for shape operations
const (
	ActionShapeCreate     = "shape_create"
	ActionShapeUpdate     = "shape_update"
	ActionShapeDelete     = "shape_delete"
	ActionShapeMove       = "shape_move"
	ActionConnectorCreate = "connector_create"
	ActionConnectorUpdate = "connector_update"
	ActionConnectorDelete = "connector_delete"
	ActionBatch           = "batch"
)

// Message represents the base envelope for all WebSocket messages
type Message struct {
	Type      string          `json:"type"`
	SessionID string          `json:"sessionId,omitempty"`
	UserID    string          `json:"userId,omitempty"`
	Timestamp int64           `json:"timestamp,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

// NewMessage creates a new message with the current timestamp
func NewMessage(msgType string, sessionID string, userID string) *Message {
	return &Message{
		Type:      msgType,
		SessionID: sessionID,
		UserID:    userID,
		Timestamp: time.Now().UnixMilli(),
	}
}

// SetPayload marshals the given payload and sets it on the message
func (m *Message) SetPayload(payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	m.Payload = data
	return nil
}

// GetPayload unmarshals the payload into the given target
func (m *Message) GetPayload(target interface{}) error {
	return json.Unmarshal(m.Payload, target)
}

// ToJSON serializes the message to JSON bytes
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// ParseMessage parses a JSON byte slice into a Message
func ParseMessage(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// JoinSessionPayload is the payload for join_session messages
type JoinSessionPayload struct {
	SessionID   string `json:"sessionId,omitempty"`   // Empty to create new session
	DisplayName string `json:"displayName"`
	DiagramID   string `json:"diagramId,omitempty"`   // Optional: which diagram is being collaborated on
	Token       string `json:"token,omitempty"`       // Auth token from backend
	AvatarURL   string `json:"avatarUrl,omitempty"`
}

// SessionJoinedPayload is the payload for session_joined response
type SessionJoinedPayload struct {
	SessionID string        `json:"sessionId"`
	User      *UserInfo     `json:"user"`
	Users     []*UserInfo   `json:"users"`
	Session   *SessionInfo  `json:"session"`
}

// SessionCreatedPayload is the payload for session_created response
type SessionCreatedPayload struct {
	SessionID string       `json:"sessionId"`
	User      *UserInfo    `json:"user"`
	Session   *SessionInfo `json:"session"`
}

// UserInfo represents user data sent to clients
type UserInfo struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	Color       string  `json:"color"`
	IsAnonymous bool    `json:"isAnonymous"`
	AvatarURL   string  `json:"avatarUrl,omitempty"`
}

// SessionInfo represents session data sent to clients
type SessionInfo struct {
	ID          string                 `json:"id"`
	CreatedAt   int64                  `json:"createdAt"`
	CreatorID   string                 `json:"creatorId"`
	UserCount   int                    `json:"userCount"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UserJoinedPayload is the payload when a user joins
type UserJoinedPayload struct {
	User *UserInfo `json:"user"`
}

// UserLeftPayload is the payload when a user leaves
type UserLeftPayload struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
}

// ActionPayload is the payload for action messages
type ActionPayload struct {
	Operation string                 `json:"operation"`
	ShapeID   string                 `json:"shapeId,omitempty"`
	ShapeIDs  []string               `json:"shapeIds,omitempty"`
	Changes   map[string]interface{} `json:"changes,omitempty"`
	Data      interface{}            `json:"data,omitempty"`
}

// CursorMovePayload is the payload for cursor_move messages
type CursorMovePayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// SelectionChangePayload is the payload for selection_change messages
type SelectionChangePayload struct {
	ShapeIDs []string `json:"shapeIds"`
}

// ViewportChangePayload is the payload for viewport_change messages
type ViewportChangePayload struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

// LaserPointerPayload is the payload for laser_pointer messages
type LaserPointerPayload struct {
	StrokeID string      `json:"strokeId"`
	Phase    string      `json:"phase"`
	Point    LaserPoint  `json:"point"`
}

// LaserPoint represents a laser pointer point
type LaserPoint struct {
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Timestamp int64   `json:"timestamp"`
}

// PresenceUpdatePayload is the payload for presence_update broadcasts
type PresenceUpdatePayload struct {
	UserID    string               `json:"userId"`
	Cursor    *CursorMovePayload   `json:"cursor,omitempty"`
	Selection *SelectionChangePayload `json:"selection,omitempty"`
	Viewport  *ViewportChangePayload  `json:"viewport,omitempty"`
}

// UsersPresencePayload contains presence data for all users
type UsersPresencePayload struct {
	Users []*UserPresence `json:"users"`
}

// UserPresence contains complete presence state for a user
type UserPresence struct {
	UserID      string                  `json:"userId"`
	DisplayName string                  `json:"displayName"`
	Color       string                  `json:"color"`
	AvatarURL   string                  `json:"avatarUrl,omitempty"`
	Cursor      *CursorMovePayload      `json:"cursor,omitempty"`
	Selection   *SelectionChangePayload `json:"selection,omitempty"`
	Viewport    *ViewportChangePayload  `json:"viewport,omitempty"`
}

// ErrorPayload is the payload for error messages
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error codes
const (
	ErrCodeInvalidMessage    = "INVALID_MESSAGE"
	ErrCodeSessionNotFound   = "SESSION_NOT_FOUND"
	ErrCodeSessionFull       = "SESSION_FULL"
	ErrCodeUnauthorized      = "UNAUTHORIZED"
	ErrCodeInternalError     = "INTERNAL_ERROR"
	ErrCodeInvalidPayload    = "INVALID_PAYLOAD"
)
