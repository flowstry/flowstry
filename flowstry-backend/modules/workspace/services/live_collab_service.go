package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/flowstry/flowstry-backend/database"
	authModels "github.com/flowstry/flowstry-backend/modules/auth/models"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LiveCollabService integrates the backend with the live-collab service.
type LiveCollabService struct {
	baseURL     string
	wsURL       string
	jwtSecret   []byte
	jwtIssuer   string
	jwtAudience string
}

// NewLiveCollabService creates a new live collaboration service client.
func NewLiveCollabService(baseURL, wsURL, jwtSecret, jwtIssuer, jwtAudience string) *LiveCollabService {
	if baseURL != "" {
		baseURL = strings.TrimRight(baseURL, "/")
	}
	if wsURL == "" && baseURL != "" {
		wsURL = deriveWSURL(baseURL)
	}
	return &LiveCollabService{
		baseURL:     baseURL,
		wsURL:       strings.TrimRight(wsURL, "/"),
		jwtSecret:   []byte(jwtSecret),
		jwtIssuer:   jwtIssuer,
		jwtAudience: jwtAudience,
	}
}

// GetWSURL returns the live-collab WebSocket URL.
func (s *LiveCollabService) GetWSURL() string {
	return s.wsURL
}

// GetUserProfile returns the user's display name and avatar URL.
func (s *LiveCollabService) GetUserProfile(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	collection := database.GetCollection("users")
	if collection == nil {
		return "", "", errors.New("database not connected")
	}

	var user authModels.User
	if err := collection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		return "", "", err
	}

	name := user.Name
	if name == "" {
		name = user.Email
	}
	return name, user.AvatarURL, nil
}

// GenerateJoinToken creates a short-lived token for live collaboration.
func (s *LiveCollabService) GenerateJoinToken(userID primitive.ObjectID, displayName, avatarURL string, workspaceID, diagramID primitive.ObjectID, ttl time.Duration) (string, error) {
	if len(s.jwtSecret) == 0 {
		return "", errors.New("live-collab jwt secret not configured")
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"userId":      userID.Hex(),
		"displayName": displayName,
		"avatarUrl":   avatarURL,
		"workspaceId": workspaceID.Hex(),
		"diagramId":   diagramID.Hex(),
		"iss":         s.jwtIssuer,
		"aud":         s.jwtAudience,
		"iat":         now.Unix(),
		"exp":         now.Add(ttl).Unix(),
		"sub":         userID.Hex(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func deriveWSURL(baseURL string) string {
	if strings.HasPrefix(baseURL, "https://") {
		return "wss://" + strings.TrimPrefix(baseURL, "https://") + "/ws"
	}
	if strings.HasPrefix(baseURL, "http://") {
		return "ws://" + strings.TrimPrefix(baseURL, "http://") + "/ws"
	}
	return baseURL + "/ws"
}
