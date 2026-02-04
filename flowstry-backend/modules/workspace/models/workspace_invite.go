package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InviteExpiryDuration is the duration after which an invite expires
const InviteExpiryDuration = 7 * 24 * time.Hour // 7 days

// WorkspaceInvite represents an invitation to join a workspace
type WorkspaceInvite struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	WorkspaceID primitive.ObjectID `bson:"workspace_id" json:"workspace_id"`
	Email       string             `bson:"email" json:"email"`
	Role        WorkspaceRole      `bson:"role" json:"role"`
	Token       string             `bson:"token" json:"token"`
	InvitedBy   primitive.ObjectID `bson:"invited_by" json:"invited_by"`
	ExpiresAt   time.Time          `bson:"expires_at" json:"expires_at"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
}

// IsExpired checks if the invite has expired
func (i *WorkspaceInvite) IsExpired() bool {
	return time.Now().After(i.ExpiresAt)
}

// CreateInviteRequest represents a request to create an invite
type CreateInviteRequest struct {
	Email string        `json:"email"`
	Role  WorkspaceRole `json:"role"`
}

// WorkspaceInviteResponse represents an invite for API responses
type WorkspaceInviteResponse struct {
	ID            primitive.ObjectID `json:"id"`
	WorkspaceID   primitive.ObjectID `json:"workspace_id"`
	WorkspaceName string             `json:"workspace_name,omitempty"`
	Email         string             `json:"email"`
	Role          WorkspaceRole      `json:"role"`
	Token         string             `json:"token,omitempty"`
	InvitedBy     primitive.ObjectID `json:"invited_by"`
	InviterName   string             `json:"inviter_name,omitempty"`
	ExpiresAt     time.Time          `json:"expires_at"`
	CreatedAt     time.Time          `json:"created_at"`
}

// ToResponse converts WorkspaceInvite to WorkspaceInviteResponse
func (i *WorkspaceInvite) ToResponse() *WorkspaceInviteResponse {
	return &WorkspaceInviteResponse{
		ID:          i.ID,
		WorkspaceID: i.WorkspaceID,
		Email:       i.Email,
		Role:        i.Role,
		InvitedBy:   i.InvitedBy,
		ExpiresAt:   i.ExpiresAt,
		CreatedAt:   i.CreatedAt,
	}
}

// InviteDetailsResponse is returned when fetching invite by token (for accept flow)
type InviteDetailsResponse struct {
	ID            primitive.ObjectID `json:"id"`
	WorkspaceName string             `json:"workspace_name"`
	Role          WorkspaceRole      `json:"role"`
	InviterName   string             `json:"inviter_name"`
	ExpiresAt     time.Time          `json:"expires_at"`
}
