package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Folder represents a collection/folder for organizing diagrams within a workspace
// Folders can be nested via ParentFolderID
type Folder struct {
	ID             primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	WorkspaceID    primitive.ObjectID  `bson:"workspace_id" json:"workspace_id"`
	ParentFolderID *primitive.ObjectID `bson:"parent_folder_id,omitempty" json:"parent_folder_id,omitempty"`
	Name           string              `bson:"name" json:"name"`
	Description    string              `bson:"description,omitempty" json:"description,omitempty"`
	Color          string              `bson:"color,omitempty" json:"color,omitempty"`
	DiagramCount   int64               `bson:"-" json:"diagram_count"`
	DeletedAt      *time.Time          `bson:"deleted_at,omitempty" json:"deleted_at,omitempty"`
	CreatedAt      time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time           `bson:"updated_at" json:"updated_at"`
}

// CreateFolderRequest represents the request to create a folder
type CreateFolderRequest struct {
	Name           string `json:"name"`
	Description    string `json:"description,omitempty"`
	ParentFolderID string `json:"parent_folder_id,omitempty"`
	Color          string `json:"color,omitempty"`
}

// UpdateFolderRequest represents the request to update a folder
type UpdateFolderRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Color       *string `json:"color,omitempty"`
}

// AddDiagramsRequest represents the request to add diagrams to a folder
type AddDiagramsRequest struct {
	DiagramIDs []string `json:"diagram_ids"`
}

// FolderResponse represents the folder response
type FolderResponse struct {
	ID             primitive.ObjectID  `json:"id"`
	WorkspaceID    primitive.ObjectID  `json:"workspace_id"`
	ParentFolderID *primitive.ObjectID `json:"parent_folder_id,omitempty"`
	Name           string              `json:"name"`
	Description    string              `json:"description,omitempty"`
	Color          string              `json:"color,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

// ToResponse converts Folder to FolderResponse
func (f *Folder) ToResponse() *FolderResponse {
	return &FolderResponse{
		ID:             f.ID,
		WorkspaceID:    f.WorkspaceID,
		ParentFolderID: f.ParentFolderID,
		Name:           f.Name,
		Description:    f.Description,
		Color:          f.Color,
		CreatedAt:      f.CreatedAt,
		UpdatedAt:      f.UpdatedAt,
	}
}
