package services

import (
	"context"
	"errors"
	"time"

	"github.com/flowstry/flowstry-backend/database"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrFolderNotFound = errors.New("folder not found")
)

// FolderService handles folder (collection) operations
type FolderService struct{}

// NewFolderService creates a new folder service
func NewFolderService() *FolderService {
	return &FolderService{}
}

// Create creates a new folder
func (s *FolderService) Create(ctx context.Context, workspaceID primitive.ObjectID, req *models.CreateFolderRequest) (*models.Folder, error) {
	collection := database.GetCollection("folders")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	folder := &models.Folder{
		WorkspaceID: workspaceID,
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,

		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Handle parent folder ID if provided
	if req.ParentFolderID != "" {
		parentID, err := primitive.ObjectIDFromHex(req.ParentFolderID)
		if err == nil {
			folder.ParentFolderID = &parentID
		}
	}

	result, err := collection.InsertOne(ctx, folder)
	if err != nil {
		return nil, err
	}

	folder.ID = result.InsertedID.(primitive.ObjectID)
	return folder, nil
}


// GetByID retrieves a folder by ID
func (s *FolderService) GetByID(ctx context.Context, folderID, workspaceID primitive.ObjectID) (*models.Folder, error) {
	collection := database.GetCollection("folders")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var folder models.Folder
	err := collection.FindOne(ctx, bson.M{
		"_id":          folderID,
		"workspace_id": workspaceID,
		"deleted_at":   nil,
	}).Decode(&folder)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrFolderNotFound
		}
		return nil, err
	}

	return &folder, nil
}

// List retrieves all folders in a workspace
func (s *FolderService) List(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.Folder, error) {
	collection := database.GetCollection("folders")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := collection.Find(ctx, bson.M{
		"workspace_id": workspaceID,
		"deleted_at":   nil,
	}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var folders []*models.Folder
	if err := cursor.All(ctx, &folders); err != nil {
		return nil, err
	}

	return folders, nil
}

// Update updates a folder
func (s *FolderService) Update(ctx context.Context, folderID, workspaceID primitive.ObjectID, req *models.UpdateFolderRequest) (*models.Folder, error) {
	folder, err := s.GetByID(ctx, folderID, workspaceID)
	if err != nil {
		return nil, err
	}

	collection := database.GetCollection("folders")

	update := bson.M{"updated_at": time.Now()}
	if req.Name != nil {
		update["name"] = *req.Name
		folder.Name = *req.Name
	}
	if req.Description != nil {
		update["description"] = *req.Description
		folder.Description = *req.Description
	}
	if req.Color != nil {
		update["color"] = *req.Color
		folder.Color = *req.Color
	}


	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": folderID},
		bson.M{"$set": update},
	)
	if err != nil {
		return nil, err
	}

	folder.UpdatedAt = time.Now()
	return folder, nil
}

// Delete soft deletes a folder (diagrams remain in workspace)
func (s *FolderService) Delete(ctx context.Context, folderID, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("folders")
	// Soft delete
	result, err := collection.UpdateOne(ctx,
		bson.M{"_id": folderID, "workspace_id": workspaceID},
		bson.M{"$set": bson.M{"deleted_at": time.Now()}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrFolderNotFound
	}
	return nil
}

// Restore restores a soft-deleted folder
func (s *FolderService) Restore(ctx context.Context, folderID, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("folders")
	result, err := collection.UpdateOne(ctx,
		bson.M{"_id": folderID, "workspace_id": workspaceID},
		bson.M{"$set": bson.M{"deleted_at": nil}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrFolderNotFound
	}
	return nil
}

// HardDelete permanently deletes a folder
func (s *FolderService) HardDelete(ctx context.Context, folderID, workspaceID primitive.ObjectID) error {
	// Verify folder exists (even if deleted)
	collection := database.GetCollection("folders")
	var folder models.Folder
	err := collection.FindOne(ctx, bson.M{"_id": folderID, "workspace_id": workspaceID}).Decode(&folder)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrFolderNotFound
		}
		return err
	}

	_, err = collection.DeleteOne(ctx, bson.M{"_id": folderID})
	return err
}

// ListTrash retrieves all soft-deleted folders in a workspace
func (s *FolderService) ListTrash(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.Folder, error) {
	collection := database.GetCollection("folders")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	opts := options.Find().SetSort(bson.D{{Key: "deleted_at", Value: -1}})
	cursor, err := collection.Find(ctx, bson.M{
		"workspace_id": workspaceID,
		"deleted_at":   bson.M{"$ne": nil},
	}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var folders []*models.Folder
	if err := cursor.All(ctx, &folders); err != nil {
		return nil, err
	}

	return folders, nil
}

// AddDiagrams adds diagrams to a folder
func (s *FolderService) AddDiagrams(ctx context.Context, folderID, workspaceID primitive.ObjectID, diagramIDs []primitive.ObjectID) error {
	// Verify folder exists
	_, err := s.GetByID(ctx, folderID, workspaceID)
	if err != nil {
		return err
	}

	collection := database.GetCollection("folders")

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": folderID},
		bson.M{
			"$addToSet":  bson.M{"diagram_ids": bson.M{"$each": diagramIDs}},
			"$set":       bson.M{"updated_at": time.Now()},
		},
	)
	return err
}

// RemoveDiagram removes a diagram from a folder
func (s *FolderService) RemoveDiagram(ctx context.Context, folderID, workspaceID, diagramID primitive.ObjectID) error {
	// Verify folder exists
	_, err := s.GetByID(ctx, folderID, workspaceID)
	if err != nil {
		return err
	}

	collection := database.GetCollection("folders")

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": folderID},
		bson.M{
			"$pull": bson.M{"diagram_ids": diagramID},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)
	return err
}

// RemoveDiagramFromAllFolders removes a diagram from all folders in a workspace
func (s *FolderService) RemoveDiagramFromAllFolders(ctx context.Context, workspaceID, diagramID primitive.ObjectID) error {
	collection := database.GetCollection("folders")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.UpdateMany(
		ctx,
		bson.M{"workspace_id": workspaceID},
		bson.M{
			"$pull": bson.M{"diagram_ids": diagramID},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)
	return err
}
