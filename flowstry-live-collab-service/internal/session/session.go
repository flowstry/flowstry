package session

import (
	"errors"
	"sync"
	"time"

	"github.com/flowstry/live-collab-service/internal/user"
	"github.com/flowstry/live-collab-service/pkg/id"
)

var (
	// ErrSessionFull is returned when a session has reached its max user limit
	ErrSessionFull = errors.New("session is full")
	// ErrUserNotFound is returned when a user is not found in the session
	ErrUserNotFound = errors.New("user not found in session")
	// ErrUserAlreadyInSession is returned when a user is already in the session
	ErrUserAlreadyInSession = errors.New("user already in session")
)

// Session represents a live collaboration session
type Session struct {
	ID        string                 `json:"id"`
	CreatedAt time.Time              `json:"createdAt"`
	CreatorID string                 `json:"creatorId"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`

	// Configuration
	MaxUsers int `json:"-"`

	// Users currently in the session
	users      map[string]*user.User
	colorIndex int // Track next color to assign

	// Last activity for session cleanup
	lastActivity time.Time

	mu sync.RWMutex
}

// NewSession creates a new collaboration session
func NewSession(creatorID string, maxUsers int, metadata map[string]interface{}) (*Session, error) {
	sessionID, err := id.GenerateSessionID()
	if err != nil {
		return nil, err
	}

	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	return &Session{
		ID:           sessionID,
		CreatedAt:    time.Now(),
		CreatorID:    creatorID,
		Metadata:     metadata,
		MaxUsers:     maxUsers,
		users:        make(map[string]*user.User),
		colorIndex:   0,
		lastActivity: time.Now(),
	}, nil
}

// AddUser adds a user to the session
func (s *Session) AddUser(u *user.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.users) >= s.MaxUsers {
		return ErrSessionFull
	}

	if _, exists := s.users[u.ID]; exists {
		return ErrUserAlreadyInSession
	}

	s.users[u.ID] = u
	s.lastActivity = time.Now()
	return nil
}

// RemoveUser removes a user from the session
func (s *Session) RemoveUser(userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[userID]; !exists {
		return ErrUserNotFound
	}

	delete(s.users, userID)
	s.lastActivity = time.Now()
	return nil
}

// GetUser returns a user by ID
func (s *Session) GetUser(userID string) (*user.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u, exists := s.users[userID]
	return u, exists
}

// GetUsers returns all users in the session
func (s *Session) GetUsers() []*user.User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	users := make([]*user.User, 0, len(s.users))
	for _, u := range s.users {
		users = append(users, u)
	}
	return users
}

// GetUserIDs returns all user IDs in the session
func (s *Session) GetUserIDs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ids := make([]string, 0, len(s.users))
	for id := range s.users {
		ids = append(ids, id)
	}
	return ids
}

// UserCount returns the number of users in the session
func (s *Session) UserCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.users)
}

// IsEmpty returns true if the session has no users
func (s *Session) IsEmpty() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.users) == 0
}

// NextColorIndex returns and increments the color index for user assignment
func (s *Session) NextColorIndex() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := s.colorIndex
	s.colorIndex++
	return index
}

// Touch updates the last activity timestamp
func (s *Session) Touch() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastActivity = time.Now()
}

// LastActivity returns the last activity timestamp
func (s *Session) LastActivity() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastActivity
}

// IsExpired returns true if the session has been inactive for longer than the given duration
func (s *Session) IsExpired(ttl time.Duration) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return time.Since(s.lastActivity) > ttl
}

// SetMetadata sets a metadata value
func (s *Session) SetMetadata(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Metadata[key] = value
}

// GetMetadata gets a metadata value
func (s *Session) GetMetadata(key string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	val, exists := s.Metadata[key]
	return val, exists
}
