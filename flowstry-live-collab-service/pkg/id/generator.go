package id

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
)

const (
	// SessionPrefix is the prefix for session IDs
	SessionPrefix = "collab_"
	// UserPrefix is the prefix for user IDs
	UserPrefix = "user_"
	// DefaultIDLength is the default length of the random part of IDs
	DefaultIDLength = 12
)

// alphabet for nanoid-style generation (URL-safe)
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// Generate creates a random ID of the specified length using the given alphabet
func Generate(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	for i := range bytes {
		bytes[i] = alphabet[bytes[i]%byte(len(alphabet))]
	}

	return string(bytes), nil
}

// GenerateSessionID creates a new unique session ID with the session prefix
func GenerateSessionID() (string, error) {
	id, err := Generate(DefaultIDLength)
	if err != nil {
		return "", err
	}
	return SessionPrefix + id, nil
}

// GenerateUserID creates a new unique user ID with the user prefix
func GenerateUserID() (string, error) {
	id, err := Generate(DefaultIDLength)
	if err != nil {
		return "", err
	}
	return UserPrefix + id, nil
}

// GenerateSecureToken creates a cryptographically secure token
// suitable for authentication or session tokens
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	// Use URL-safe base64 encoding without padding
	return strings.TrimRight(base64.URLEncoding.EncodeToString(bytes), "="), nil
}

// IsValidSessionID checks if a string is a valid session ID format
func IsValidSessionID(id string) bool {
	if !strings.HasPrefix(id, SessionPrefix) {
		return false
	}
	suffix := strings.TrimPrefix(id, SessionPrefix)
	if len(suffix) != DefaultIDLength {
		return false
	}
	for _, c := range suffix {
		if !strings.ContainsRune(alphabet, c) {
			return false
		}
	}
	return true
}

// IsValidUserID checks if a string is a valid user ID format
func IsValidUserID(id string) bool {
	if !strings.HasPrefix(id, UserPrefix) {
		return false
	}
	suffix := strings.TrimPrefix(id, UserPrefix)
	if len(suffix) != DefaultIDLength {
		return false
	}
	for _, c := range suffix {
		if !strings.ContainsRune(alphabet, c) {
			return false
		}
	}
	return true
}
