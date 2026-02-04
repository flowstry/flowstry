package session

import (
	"errors"
	"log"
	"sync"
	"time"

	"github.com/flowstry/live-collab-service/internal/user"
)

var (
	// ErrSessionNotFound is returned when a session is not found
	ErrSessionNotFound = errors.New("session not found")
)

// Manager handles session lifecycle and storage
type Manager struct {
	sessions map[string]*Session
	mu       sync.RWMutex

	// Configuration
	maxUsersPerSession int
	sessionTTL         time.Duration
	cleanupInterval    time.Duration

	// Cleanup control
	stopCleanup chan struct{}
}

// NewManager creates a new session manager
func NewManager(maxUsersPerSession int, sessionTTL, cleanupInterval time.Duration) *Manager {
	m := &Manager{
		sessions:           make(map[string]*Session),
		maxUsersPerSession: maxUsersPerSession,
		sessionTTL:         sessionTTL,
		cleanupInterval:    cleanupInterval,
		stopCleanup:        make(chan struct{}),
	}

	// Start background cleanup
	go m.cleanupLoop()

	return m
}

// CreateSession creates a new collaboration session
func (m *Manager) CreateSession(creatorID string, metadata map[string]interface{}) (*Session, error) {
	session, err := NewSession(creatorID, m.maxUsersPerSession, metadata)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.sessions[session.ID] = session
	m.mu.Unlock()

	log.Printf("Session created: %s by user %s", session.ID, creatorID)
	return session, nil
}

// GetSession returns a session by ID
func (m *Manager) GetSession(sessionID string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[sessionID]
	if !exists {
		return nil, ErrSessionNotFound
	}

	return session, nil
}

// JoinSession adds a user to an existing session
func (m *Manager) JoinSession(sessionID string, displayName, avatarURL string) (*Session, *user.User, error) {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, nil, ErrSessionNotFound
	}

	// Get next color index for the user
	colorIndex := session.NextColorIndex()

	// Create new user
	u, err := user.NewUser(displayName, avatarURL, colorIndex)
	if err != nil {
		return nil, nil, err
	}

	// Add user to session
	if err := session.AddUser(u); err != nil {
		return nil, nil, err
	}

	session.Touch()
	log.Printf("User %s (%s) joined session %s", u.DisplayName, u.ID, sessionID)

	return session, u, nil
}

// JoinSessionWithUser adds an authenticated user with a fixed ID to an existing session.
func (m *Manager) JoinSessionWithUser(sessionID, userID, displayName, avatarURL string) (*Session, *user.User, error) {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, nil, ErrSessionNotFound
	}

	colorIndex := session.NextColorIndex()
	u := user.NewAuthenticatedUser(userID, displayName, avatarURL, colorIndex)

	if err := session.AddUser(u); err != nil {
		return nil, nil, err
	}

	session.Touch()
	log.Printf("User %s (%s) joined session %s", u.DisplayName, u.ID, sessionID)

	return session, u, nil
}

// CreateAndJoinSession creates a new session and adds the creator as a user
func (m *Manager) CreateAndJoinSession(displayName, avatarURL string, metadata map[string]interface{}) (*Session, *user.User, error) {
	// Create user first to get their ID
	u, err := user.NewUser(displayName, avatarURL, 0)
	if err != nil {
		return nil, nil, err
	}

	// Create session with user as creator
	session, err := NewSession(u.ID, m.maxUsersPerSession, metadata)
	if err != nil {
		return nil, nil, err
	}

	// Add user to session
	if err := session.AddUser(u); err != nil {
		return nil, nil, err
	}

	// Store session
	m.mu.Lock()
	m.sessions[session.ID] = session
	m.mu.Unlock()

	log.Printf("Session created and joined: %s by user %s (%s)", session.ID, u.DisplayName, u.ID)
	return session, u, nil
}

// CreateAndJoinSessionWithUser creates a new session and adds an authenticated user.
func (m *Manager) CreateAndJoinSessionWithUser(userID, displayName, avatarURL string, metadata map[string]interface{}) (*Session, *user.User, error) {
	u := user.NewAuthenticatedUser(userID, displayName, avatarURL, 0)

	session, err := NewSession(u.ID, m.maxUsersPerSession, metadata)
	if err != nil {
		return nil, nil, err
	}

	if err := session.AddUser(u); err != nil {
		return nil, nil, err
	}

	m.mu.Lock()
	m.sessions[session.ID] = session
	m.mu.Unlock()

	log.Printf("Session created and joined: %s by user %s (%s)", session.ID, u.DisplayName, u.ID)
	return session, u, nil
}

// FindSessionByDiagramID returns an active session for the given diagram ID.
func (m *Manager) FindSessionByDiagramID(diagramID string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, session := range m.sessions {
		if value, ok := session.GetMetadata("diagramId"); ok {
			if v, ok := value.(string); ok && v == diagramID {
				return session, true
			}
		}
	}
	return nil, false
}

// LeaveSession removes a user from a session
func (m *Manager) LeaveSession(sessionID, userID string) error {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return ErrSessionNotFound
	}

	if err := session.RemoveUser(userID); err != nil {
		return err
	}

	session.Touch()
	log.Printf("User %s left session %s", userID, sessionID)

	// Check if session is empty and should be cleaned up
	if session.IsEmpty() {
		m.mu.Lock()
		delete(m.sessions, sessionID)
		m.mu.Unlock()
		log.Printf("Session %s is empty, removed", sessionID)
	}

	return nil
}

// CloseSession explicitly closes and removes a session
func (m *Manager) CloseSession(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.sessions[sessionID]; !exists {
		return ErrSessionNotFound
	}

	delete(m.sessions, sessionID)
	log.Printf("Session %s closed", sessionID)
	return nil
}

// GetSessionUsers returns all users in a session
func (m *Manager) GetSessionUsers(sessionID string) ([]*user.User, error) {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, ErrSessionNotFound
	}

	return session.GetUsers(), nil
}

// GetSessionCount returns the number of active sessions
func (m *Manager) GetSessionCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// GetAllSessionIDs returns all active session IDs
func (m *Manager) GetAllSessionIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	return ids
}

// cleanupLoop periodically removes expired and empty sessions
func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(m.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.cleanup()
		case <-m.stopCleanup:
			return
		}
	}
}

// cleanup removes expired and empty sessions
func (m *Manager) cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	var toRemove []string
	for sessionID, session := range m.sessions {
		if session.IsEmpty() || session.IsExpired(m.sessionTTL) {
			toRemove = append(toRemove, sessionID)
		}
	}

	for _, sessionID := range toRemove {
		delete(m.sessions, sessionID)
		log.Printf("Session %s cleaned up (expired or empty)", sessionID)
	}

	if len(toRemove) > 0 {
		log.Printf("Cleaned up %d sessions, %d remaining", len(toRemove), len(m.sessions))
	}
}

// Stop stops the cleanup goroutine
func (m *Manager) Stop() {
	close(m.stopCleanup)
}
