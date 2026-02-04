package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/flowstry/flowstry-backend/config"
	"github.com/flowstry/flowstry-backend/database"
	"github.com/flowstry/flowstry-backend/modules/auth/models"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrExpiredToken     = errors.New("token has expired")
	ErrRevokedToken     = errors.New("token has been revoked")
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailExists      = errors.New("email already exists")
)

// Claims represents JWT claims
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// AuthService handles authentication operations
type AuthService struct {
	cfg *config.Config
}

// NewAuthService creates a new auth service
func NewAuthService(cfg *config.Config) *AuthService {
	return &AuthService{cfg: cfg}
}

// GenerateAccessToken creates a new JWT access token
func (s *AuthService) GenerateAccessToken(userID, email string) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.cfg.AccessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "flowstry-backend",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// GenerateRefreshToken creates a new refresh token and stores it in the database
func (s *AuthService) GenerateRefreshToken(ctx context.Context, userID primitive.ObjectID) (string, error) {
	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	rawToken := hex.EncodeToString(tokenBytes)

	// Hash token for storage
	hash := sha256.Sum256([]byte(rawToken))
	hashedToken := hex.EncodeToString(hash[:])

	// Store in database
	refreshToken := &models.RefreshToken{
		UserID:    userID,
		Token:     hashedToken,
		ExpiresAt: time.Now().Add(s.cfg.RefreshTokenExpiry),
		CreatedAt: time.Now(),
		Revoked:   false,
	}

	collection := database.GetCollection("refresh_tokens")
	if collection == nil {
		return "", errors.New("database not connected")
	}

	_, err := collection.InsertOne(ctx, refreshToken)
	if err != nil {
		return "", err
	}

	return rawToken, nil
}

// ValidateAccessToken validates a JWT access token
func (s *AuthService) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.cfg.JWTSecret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token and returns the user ID
func (s *AuthService) ValidateRefreshToken(ctx context.Context, rawToken string) (primitive.ObjectID, error) {
	// Hash the token
	hash := sha256.Sum256([]byte(rawToken))
	hashedToken := hex.EncodeToString(hash[:])

	collection := database.GetCollection("refresh_tokens")
	if collection == nil {
		return primitive.NilObjectID, errors.New("database not connected")
	}

	var refreshToken models.RefreshToken
	err := collection.FindOne(ctx, bson.M{"token": hashedToken}).Decode(&refreshToken)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return primitive.NilObjectID, ErrInvalidToken
		}
		return primitive.NilObjectID, err
	}

	if refreshToken.Revoked {
		return primitive.NilObjectID, ErrRevokedToken
	}

	if refreshToken.IsExpired() {
		return primitive.NilObjectID, ErrExpiredToken
	}

	return refreshToken.UserID, nil
}

// RevokeRefreshToken revokes a refresh token
func (s *AuthService) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	hash := sha256.Sum256([]byte(rawToken))
	hashedToken := hex.EncodeToString(hash[:])

	collection := database.GetCollection("refresh_tokens")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.UpdateOne(
		ctx,
		bson.M{"token": hashedToken},
		bson.M{"$set": bson.M{"revoked": true}},
	)
	return err
}

// RevokeAllUserTokens revokes all refresh tokens for a user
func (s *AuthService) RevokeAllUserTokens(ctx context.Context, userID primitive.ObjectID) error {
	collection := database.GetCollection("refresh_tokens")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.UpdateMany(
		ctx,
		bson.M{"user_id": userID},
		bson.M{"$set": bson.M{"revoked": true}},
	)
	return err
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, userID primitive.ObjectID) (*models.User, error) {
	collection := database.GetCollection("users")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var user models.User
	err := collection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (s *AuthService) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	collection := database.GetCollection("users")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var user models.User
	err := collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// CreateUser creates a new user
func (s *AuthService) CreateUser(ctx context.Context, user *models.User) error {
	collection := database.GetCollection("users")
	if collection == nil {
		return errors.New("database not connected")
	}

	// Check if email exists
	existing, _ := s.GetUserByEmail(ctx, user.Email)
	if existing != nil {
		return ErrEmailExists
	}

	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	result, err := collection.InsertOne(ctx, user)
	if err != nil {
		return err
	}

	user.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetOrCreateGoogleUser finds or creates a user from Google OAuth
func (s *AuthService) GetOrCreateGoogleUser(ctx context.Context, googleID, email, name, avatarURL string) (*models.User, error) {
	collection := database.GetCollection("users")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	// Try to find by Google ID first
	var user models.User
	err := collection.FindOne(ctx, bson.M{"google_id": googleID}).Decode(&user)
	if err == nil {
		return &user, nil
	}

	// Try to find by email
	err = collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err == nil {
		// Link Google account to existing user
		user.GoogleID = googleID
		user.AuthProvider = models.AuthProviderGoogle
		if user.AvatarURL == "" {
			user.AvatarURL = avatarURL
		}
		_, err = collection.UpdateOne(
			ctx,
			bson.M{"_id": user.ID},
			bson.M{"$set": bson.M{
				"google_id":     googleID,
				"auth_provider": models.AuthProviderGoogle,
				"avatar_url":    user.AvatarURL,
				"updated_at":    time.Now(),
			}},
		)
		if err != nil {
			return nil, err
		}
		return &user, nil
	}

	// Create new user
	newUser := &models.User{
		Email:        email,
		Name:         name,
		AvatarURL:    avatarURL,
		AuthProvider: models.AuthProviderGoogle,
		GoogleID:     googleID,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	result, err := collection.InsertOne(ctx, newUser)
	if err != nil {
		return nil, err
	}

	newUser.ID = result.InsertedID.(primitive.ObjectID)
	return newUser, nil
}

// UpdateUserPreferences updates a user's preferences
func (s *AuthService) UpdateUserPreferences(ctx context.Context, userID primitive.ObjectID, prefs models.UserPreferences) error {
	collection := database.GetCollection("users")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{
			"$set": bson.M{
				"preferences": prefs,
				"updated_at":  time.Now(),
			},
		},
	)
	return err
}
