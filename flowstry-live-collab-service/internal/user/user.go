package user

import (
	"sync"
	"time"

	"github.com/flowstry/live-collab-service/pkg/id"
)

// UserColors is the palette of colors assigned to users for their cursors
var UserColors = []string{
	"#FF6B6B", // Red
	"#4ECDC4", // Teal
	"#45B7D1", // Blue
	"#96CEB4", // Green
	"#FFEAA7", // Yellow
	"#DDA0DD", // Plum
	"#98D8C8", // Mint
	"#F7DC6F", // Gold
	"#BB8FCE", // Purple
	"#85C1E9", // Light Blue
	"#F8B500", // Orange
	"#58D68D", // Emerald
	"#AF7AC5", // Violet
	"#5DADE2", // Sky Blue
	"#F1948A", // Salmon
}

// CursorPosition represents a user's cursor location on the canvas
type CursorPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Viewport represents the user's current view of the canvas
type Viewport struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

// User represents a connected user in a collaboration session
type User struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"displayName"`
	Color       string    `json:"color"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
	JoinedAt    time.Time `json:"joinedAt"`
	IsAnonymous bool      `json:"isAnonymous"`

	// Presence data
	Cursor    *CursorPosition `json:"cursor,omitempty"`
	Selection []string        `json:"selection,omitempty"`
	Viewport  *Viewport       `json:"viewport,omitempty"`

	// Last activity timestamp for presence tracking
	LastActivity time.Time `json:"-"`

	mu sync.RWMutex
}

// NewUser creates a new user with the given display name
func NewUser(displayName string, avatarURL string, colorIndex int) (*User, error) {
	userID, err := id.GenerateUserID()
	if err != nil {
		return nil, err
	}

	// Assign color from palette based on index
	color := UserColors[colorIndex%len(UserColors)]

	return &User{
		ID:           userID,
		DisplayName:  displayName,
		Color:        color,
		AvatarURL:    avatarURL,
		JoinedAt:     time.Now(),
		IsAnonymous:  true,
		Selection:    []string{},
		LastActivity: time.Now(),
	}, nil
}

// NewAuthenticatedUser creates a user with an existing ID (for authenticated users)
func NewAuthenticatedUser(userID, displayName, avatarURL string, colorIndex int) *User {
	color := UserColors[colorIndex%len(UserColors)]

	return &User{
		ID:           userID,
		DisplayName:  displayName,
		Color:        color,
		AvatarURL:    avatarURL,
		JoinedAt:     time.Now(),
		IsAnonymous:  false,
		Selection:    []string{},
		LastActivity: time.Now(),
	}
}

// UpdateCursor updates the user's cursor position
func (u *User) UpdateCursor(x, y float64) {
	u.mu.Lock()
	defer u.mu.Unlock()

	u.Cursor = &CursorPosition{X: x, Y: y}
	u.LastActivity = time.Now()
}

// UpdateSelection updates the user's current selection
func (u *User) UpdateSelection(shapeIDs []string) {
	u.mu.Lock()
	defer u.mu.Unlock()

	u.Selection = shapeIDs
	u.LastActivity = time.Now()
}

// UpdateViewport updates the user's current viewport
func (u *User) UpdateViewport(x, y, zoom float64) {
	u.mu.Lock()
	defer u.mu.Unlock()

	u.Viewport = &Viewport{X: x, Y: y, Zoom: zoom}
	u.LastActivity = time.Now()
}

// GetCursor returns a copy of the user's cursor position
func (u *User) GetCursor() *CursorPosition {
	u.mu.RLock()
	defer u.mu.RUnlock()

	if u.Cursor == nil {
		return nil
	}
	return &CursorPosition{X: u.Cursor.X, Y: u.Cursor.Y}
}

// GetSelection returns a copy of the user's selection
func (u *User) GetSelection() []string {
	u.mu.RLock()
	defer u.mu.RUnlock()

	if u.Selection == nil {
		return []string{}
	}
	result := make([]string, len(u.Selection))
	copy(result, u.Selection)
	return result
}

// GetViewport returns a copy of the user's viewport
func (u *User) GetViewport() *Viewport {
	u.mu.RLock()
	defer u.mu.RUnlock()

	if u.Viewport == nil {
		return nil
	}
	return &Viewport{X: u.Viewport.X, Y: u.Viewport.Y, Zoom: u.Viewport.Zoom}
}

// Touch updates the last activity timestamp
func (u *User) Touch() {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.LastActivity = time.Now()
}

// IsActive returns true if the user has been active within the given duration
func (u *User) IsActive(within time.Duration) bool {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return time.Since(u.LastActivity) < within
}
