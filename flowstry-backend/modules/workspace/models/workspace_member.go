package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// WorkspaceRole represents the role of a user in a workspace
type WorkspaceRole string

const (
	RoleOwner  WorkspaceRole = "owner"
	RoleAdmin  WorkspaceRole = "admin"
	RoleEditor WorkspaceRole = "editor"
	RoleViewer WorkspaceRole = "viewer"
)

// RoleHierarchy defines the permission level of each role (higher = more permissions)
var RoleHierarchy = map[WorkspaceRole]int{
	RoleOwner:  4,
	RoleAdmin:  3,
	RoleEditor: 2,
	RoleViewer: 1,
}

// HasAtLeastRole checks if the role has at least the required permission level
func (r WorkspaceRole) HasAtLeastRole(required WorkspaceRole) bool {
	return RoleHierarchy[r] >= RoleHierarchy[required]
}

// IsValid checks if the role is a valid workspace role
func (r WorkspaceRole) IsValid() bool {
	_, exists := RoleHierarchy[r]
	return exists
}

// WorkspaceMember represents a user's membership in a workspace
type WorkspaceMember struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	WorkspaceID primitive.ObjectID `bson:"workspace_id" json:"workspace_id"`
	UserID      primitive.ObjectID `bson:"user_id" json:"user_id"`
	Role        WorkspaceRole      `bson:"role" json:"role"`
	JoinedAt    time.Time          `bson:"joined_at" json:"joined_at"`
}

// WorkspaceMemberResponse represents a member with user details for API responses
type WorkspaceMemberResponse struct {
	ID        primitive.ObjectID `json:"id"`
	UserID    primitive.ObjectID `json:"user_id"`
	Email     string             `json:"email"`
	Name      string             `json:"name"`
	AvatarURL string             `json:"avatar_url,omitempty"`
	Role      WorkspaceRole      `json:"role"`
	JoinedAt  time.Time          `json:"joined_at"`
}

// UpdateMemberRoleRequest represents a request to update a member's role
type UpdateMemberRoleRequest struct {
	Role WorkspaceRole `json:"role"`
}
