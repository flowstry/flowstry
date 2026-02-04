package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Diagram represents a diagram stored in a workspace
type Diagram struct {
	ID           primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	WorkspaceID  primitive.ObjectID  `bson:"workspace_id" json:"workspace_id"`
	FolderID     *primitive.ObjectID `bson:"folder_id,omitempty" json:"folder_id,omitempty"`
	Name         string              `bson:"name" json:"name"`
	Description  string              `bson:"description,omitempty" json:"description,omitempty"`
	FileURL      string              `bson:"file_url" json:"file_url"`
	FileSize     int64               `bson:"file_size" json:"file_size"`
	Thumbnail    string              `bson:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	Version      int                 `bson:"version" json:"version"`
	DeletedAt    *time.Time          `bson:"deleted_at,omitempty" json:"deleted_at,omitempty"`
	CreatedAt    time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time           `bson:"updated_at" json:"updated_at"`
}

// CreateDiagramRequest represents the request to create a diagram
type CreateDiagramRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	FolderID    string `json:"folder_id,omitempty"`
}

// UpdateDiagramRequest represents the request to update a diagram
type UpdateDiagramRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Thumbnail   *string `json:"thumbnail,omitempty"`
	FileURL     *string `json:"file_url,omitempty"`
}

// DiagramResponse represents the diagram response
type DiagramResponse struct {
	ID           primitive.ObjectID  `json:"id"`
	WorkspaceID  primitive.ObjectID  `json:"workspace_id"`
	FolderID     *primitive.ObjectID `json:"folder_id,omitempty"`
	Name         string              `json:"name"`
	Description  string              `json:"description,omitempty"`
	FileURL      string              `json:"file_url"`
	FileSize     int64               `json:"file_size"`
	Thumbnail    string              `json:"thumbnail,omitempty"`
	ThumbnailURL string              `json:"thumbnail_url,omitempty"`
	Version      int                 `json:"version"`
	DeletedAt    *time.Time          `json:"deleted_at"` // Removed omitempty for debugging
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
}

// RecentDiagramResponse represents a recent diagram with workspace context
type RecentDiagramResponse struct {
	ID            primitive.ObjectID  `json:"id"`
	WorkspaceID   primitive.ObjectID  `json:"workspace_id"`
	WorkspaceName string              `json:"workspace_name"`
	FolderID      *primitive.ObjectID `json:"folder_id,omitempty"`
	Name          string              `json:"name"`
	Thumbnail     string              `json:"thumbnail,omitempty"`
	ThumbnailURL  string              `json:"thumbnail_url,omitempty"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
}

// ToResponse converts Diagram to DiagramResponse
func (d *Diagram) ToResponse() *DiagramResponse {
	return &DiagramResponse{
		ID:           d.ID,
		WorkspaceID:  d.WorkspaceID,
		FolderID:     d.FolderID,
		Name:         d.Name,
		Description:  d.Description,
		FileURL:      d.FileURL,
		FileSize:     d.FileSize,
		Thumbnail:    d.Thumbnail,
		Version:      d.Version,
		DeletedAt:    d.DeletedAt,
		CreatedAt:    d.CreatedAt,
		UpdatedAt:    d.UpdatedAt,
	}
}
