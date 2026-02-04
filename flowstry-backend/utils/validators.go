package utils

import (
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// ValidateEmail checks if an email is valid
func ValidateEmail(email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	if len(email) == 0 || len(email) > 254 {
		return false
	}
	return emailRegex.MatchString(email)
}

// NormalizeEmail normalizes an email address
func NormalizeEmail(email string) string {
	return strings.TrimSpace(strings.ToLower(email))
}

// ValidatePassword checks if a password meets requirements
func ValidatePassword(password string) (bool, string) {
	if len(password) < 8 {
		return false, "Password must be at least 8 characters long"
	}
	if len(password) > 128 {
		return false, "Password must be less than 128 characters"
	}
	return true, ""
}

// ValidateName checks if a name is valid
func ValidateName(name string) (bool, string) {
	name = strings.TrimSpace(name)
	if len(name) == 0 {
		return false, "Name is required"
	}
	if len(name) > 100 {
		return false, "Name must be less than 100 characters"
	}
	return true, ""
}

// SanitizeString trims and limits string length
func SanitizeString(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}
