package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Workspace represents a workspace for organizing diagrams
type Workspace struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID       primitive.ObjectID `bson:"user_id" json:"user_id"`
	Name         string             `bson:"name" json:"name"`
	Description  string             `bson:"description,omitempty" json:"description,omitempty"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
	DiagramCount int64              `bson:"-" json:"diagram_count"`
	FolderCount  int64              `bson:"-" json:"folder_count"`
}

// CreateWorkspaceRequest represents the request to create a workspace
type CreateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// UpdateWorkspaceRequest represents the request to update a workspace
type UpdateWorkspaceRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// WorkspaceResponse represents the workspace response
type WorkspaceResponse struct {
	ID           primitive.ObjectID `json:"id"`
	Name         string             `json:"name"`
	Description  string             `json:"description,omitempty"`
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
	DiagramCount int64              `json:"diagram_count"`
	FolderCount  int64              `json:"folder_count"`
	UserRole     WorkspaceRole      `json:"user_role,omitempty"`
}

// ToResponse converts Workspace to WorkspaceResponse
func (w *Workspace) ToResponse() *WorkspaceResponse {
	return &WorkspaceResponse{
		ID:           w.ID,
		Name:         w.Name,
		Description:  w.Description,
		CreatedAt:    w.CreatedAt,
		UpdatedAt:    w.UpdatedAt,
		DiagramCount: w.DiagramCount,
		FolderCount:  w.FolderCount,
	}
}
