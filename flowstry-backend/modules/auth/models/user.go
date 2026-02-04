package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AuthProvider represents the authentication method
type AuthProvider string

const (
	AuthProviderEmail  AuthProvider = "email"
	AuthProviderGoogle AuthProvider = "google"
)

// UserPreferences stores user-specific UI settings
type UserPreferences struct {
	Theme string `bson:"theme" json:"theme"` // "light" | "dark"
}

// User represents a user in the system
type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash,omitempty" json:"-"`
	Name         string             `bson:"name" json:"name"`
	AvatarURL    string             `bson:"avatar_url,omitempty" json:"avatar_url,omitempty"`
	AuthProvider AuthProvider       `bson:"auth_provider" json:"auth_provider"`
	GoogleID     string             `bson:"google_id,omitempty" json:"-"`
	Preferences  UserPreferences    `bson:"preferences" json:"preferences"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

// SignUpRequest represents the signup request body
type SignUpRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// SignInRequest represents the signin request body
type SignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RefreshRequest represents the token refresh request body
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         *User  `json:"user"`
}

// UserResponse represents a safe user response (without sensitive data)
// UserResponse represents a safe user response (without sensitive data)
type UserResponse struct {
	ID          primitive.ObjectID `json:"id"`
	Email       string             `json:"email"`
	Name        string             `json:"name"`
	AvatarURL   string             `json:"avatar_url,omitempty"`
	Preferences UserPreferences    `json:"preferences"`
	CreatedAt   time.Time          `json:"created_at"`
}

// ToResponse converts User to UserResponse
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		Name:        u.Name,
		AvatarURL:   u.AvatarURL,
		Preferences: u.Preferences,
		CreatedAt:   u.CreatedAt,
	}
}
