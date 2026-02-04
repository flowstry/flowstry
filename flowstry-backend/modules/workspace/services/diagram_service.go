package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/flowstry/flowstry-backend/database"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"github.com/flowstry/flowstry-backend/storage"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrDiagramNotFound = errors.New("diagram not found")
)

// DiagramService handles diagram operations
type DiagramService struct {
	gcsClient     *storage.GCSClient
	folderService *FolderService
}

// NewDiagramService creates a new diagram service
func NewDiagramService(gcsClient *storage.GCSClient, folderService *FolderService) *DiagramService {
	return &DiagramService{
		gcsClient:     gcsClient,
		folderService: folderService,
	}
}

// Create creates a new diagram with file upload
func (s *DiagramService) Create(ctx context.Context, userID, workspaceID primitive.ObjectID, req *models.CreateDiagramRequest, fileData []byte) (*models.Diagram, error) {
	collection := database.GetCollection("diagrams")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var folderObjectID *primitive.ObjectID
	if req.FolderID != "" {
		parsedID, err := primitive.ObjectIDFromHex(req.FolderID)
		if err != nil {
			return nil, err
		}
		if s.folderService != nil {
			if _, err := s.folderService.GetByID(ctx, parsedID, workspaceID); err != nil {
				return nil, err
			}
		}
		folderObjectID = &parsedID
	}

	// Generate unique file path: diagrams/{userID}/{workspaceID}/{diagramID}/diagram.flowstry
	diagramID := primitive.NewObjectID()
	objectName := fmt.Sprintf("diagrams/%s/%s/%s/diagram.flowstry", userID.Hex(), workspaceID.Hex(), diagramID.Hex())

	// Upload to GCS with compression
	var fileURL string
	var fileSize int64
	var err error

	if s.gcsClient != nil && len(fileData) > 0 {
		_, fileSize, err = s.gcsClient.UploadFile(ctx, objectName, fileData, "application/octet-stream")
		if err != nil {
			return nil, fmt.Errorf("failed to upload file: %w", err)
		}
	}

	diagram := &models.Diagram{
		ID:          diagramID,
		WorkspaceID: workspaceID,
		FolderID:    folderObjectID,
		Name:        req.Name,
		Description: req.Description,
		FileURL:     objectName,
		FileSize:    fileSize,
		Version:     1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	_, err = collection.InsertOne(ctx, diagram)
	if err != nil {
		// Clean up uploaded file on failure
		if s.gcsClient != nil && fileURL != "" {
			_ = s.gcsClient.DeleteFile(ctx, fileURL)
		}
		return nil, err
	}

	return diagram, nil
}

// GetByID retrieves a diagram by ID
func (s *DiagramService) GetByID(ctx context.Context, diagramID, workspaceID primitive.ObjectID) (*models.Diagram, error) {
	collection := database.GetCollection("diagrams")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var diagram models.Diagram
	err := collection.FindOne(ctx, bson.M{
		"_id":          diagramID,
		"workspace_id": workspaceID,
		"deleted_at":   nil,
	}).Decode(&diagram)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrDiagramNotFound
		}
		return nil, err
	}

	return &diagram, nil
}

// List retrieves all diagrams in a workspace
func (s *DiagramService) List(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.Diagram, error) {
	collection := database.GetCollection("diagrams")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	opts := options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}})
	cursor, err := collection.Find(ctx, bson.M{
		"workspace_id": workspaceID,
		"deleted_at":   nil,
	}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var diagrams []*models.Diagram
	if err := cursor.All(ctx, &diagrams); err != nil {
		return nil, err
	}

	return diagrams, nil
}

// ListRecent retrieves recent diagrams across multiple workspaces
func (s *DiagramService) ListRecent(ctx context.Context, workspaceIDs []primitive.ObjectID, limit int64) ([]*models.Diagram, error) {
	collection := database.GetCollection("diagrams")
	if collection == nil {
		return nil, errors.New("database not connected")
	}
	if len(workspaceIDs) == 0 || limit <= 0 {
		return []*models.Diagram{}, nil
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "updated_at", Value: -1}}).
		SetLimit(limit)
	cursor, err := collection.Find(ctx, bson.M{
		"workspace_id": bson.M{"$in": workspaceIDs},
		"deleted_at":   nil,
	}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var diagrams []*models.Diagram
	if err := cursor.All(ctx, &diagrams); err != nil {
		return nil, err
	}

	return diagrams, nil
}

// Update updates diagram metadata
func (s *DiagramService) Update(ctx context.Context, diagramID, workspaceID primitive.ObjectID, req *models.UpdateDiagramRequest) (*models.Diagram, error) {
	diagram, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return nil, err
	}

	collection := database.GetCollection("diagrams")

	update := bson.M{"updated_at": time.Now()}
	if req.Name != nil {
		update["name"] = *req.Name
		diagram.Name = *req.Name
	}
	if req.Description != nil {
		update["description"] = *req.Description
		diagram.Description = *req.Description
	}
	if req.Thumbnail != nil {
		update["thumbnail"] = *req.Thumbnail
		diagram.Thumbnail = *req.Thumbnail
	}
	if req.FileURL != nil {
		update["file_url"] = *req.FileURL
		diagram.FileURL = *req.FileURL
	}


	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": diagramID},
		bson.M{"$set": update},
	)
	if err != nil {
		return nil, err
	}

	diagram.UpdatedAt = time.Now()
	return diagram, nil
}

// UpdateFile updates the diagram file
func (s *DiagramService) UpdateFile(ctx context.Context, userID, diagramID, workspaceID primitive.ObjectID, fileData []byte) (*models.Diagram, error) {
	diagram, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return nil, err
	}

	if s.gcsClient == nil {
		return nil, errors.New("storage not configured")
	}

	// Upload new file: diagrams/{userID}/{workspaceID}/{diagramID}/diagram.flowstry
	objectName := fmt.Sprintf("diagrams/%s/%s/%s/diagram.flowstry", userID.Hex(), workspaceID.Hex(), diagramID.Hex())
	fileURL, fileSize, err := s.gcsClient.UploadFile(ctx, objectName, fileData, "application/octet-stream")
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}

	collection := database.GetCollection("diagrams")

	update := bson.M{
		"file_url":   fileURL,
		"file_size":  fileSize,
		"version":    diagram.Version + 1,
		"updated_at": time.Now(),
	}

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": diagramID},
		bson.M{"$set": update},
	)
	if err != nil {
		return nil, err
	}

	diagram.FileURL = fileURL
	diagram.FileSize = fileSize
	diagram.Version++
	diagram.UpdatedAt = time.Now()

	return diagram, nil
}

// Download downloads the diagram file
func (s *DiagramService) Download(ctx context.Context, diagramID, workspaceID primitive.ObjectID) ([]byte, *models.Diagram, error) {
	diagram, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return nil, nil, err
	}

	if s.gcsClient == nil {
		return nil, nil, errors.New("storage not configured")
	}

	if diagram.FileURL == "" {
		return nil, nil, errors.New("no file associated with diagram")
	}

	data, err := s.gcsClient.DownloadFile(ctx, diagram.FileURL)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to download file: %w", err)
	}

	return data, diagram, nil
}

// Delete soft deletes a diagram
func (s *DiagramService) Delete(ctx context.Context, diagramID, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("diagrams")

	result, err := collection.UpdateOne(ctx,
		bson.M{"_id": diagramID, "workspace_id": workspaceID},
		bson.M{"$set": bson.M{"deleted_at": time.Now()}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrDiagramNotFound
	}

	return nil
}

// Restore restores a soft-deleted diagram
func (s *DiagramService) Restore(ctx context.Context, diagramID, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("diagrams")

	result, err := collection.UpdateOne(ctx,
		bson.M{"_id": diagramID, "workspace_id": workspaceID},
		bson.M{"$set": bson.M{"deleted_at": nil}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrDiagramNotFound
	}

	return nil
}

// HardDelete permanently deletes a diagram and its file
func (s *DiagramService) HardDelete(ctx context.Context, diagramID, workspaceID primitive.ObjectID) error {
	// Look up even if deleted
	collection := database.GetCollection("diagrams")
	var diagram models.Diagram
	err := collection.FindOne(ctx, bson.M{
		"_id":          diagramID,
		"workspace_id": workspaceID,
	}).Decode(&diagram)
	
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrDiagramNotFound
		}
		return err
	}

	// Delete from database
	_, err = collection.DeleteOne(ctx, bson.M{"_id": diagramID})
	if err != nil {
		return err
	}

	// Delete file from GCS
	if s.gcsClient != nil && diagram.FileURL != "" {
		_ = s.gcsClient.DeleteFile(ctx, diagram.FileURL)
	}

	// Remove from all folders
	if s.folderService != nil {
		_ = s.folderService.RemoveDiagramFromAllFolders(ctx, workspaceID, diagramID)
	}

	return nil
}

// ListTrash retrieves all soft-deleted diagrams in a workspace
func (s *DiagramService) ListTrash(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.Diagram, error) {
	collection := database.GetCollection("diagrams")
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

	var diagrams []*models.Diagram
	if err := cursor.All(ctx, &diagrams); err != nil {
		return nil, err
	}

	return diagrams, nil
}

// SetThumbnail updates the diagram thumbnail
func (s *DiagramService) SetThumbnail(ctx context.Context, diagramID, workspaceID primitive.ObjectID, thumbnail string) error {
	_, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return err
	}

	collection := database.GetCollection("diagrams")

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": diagramID},
		bson.M{"$set": bson.M{
			"thumbnail":  thumbnail,
			"updated_at": time.Now(),
		}},
	)
	return err
}

// GetUploadURL generates a signed URL for uploading a file
func (s *DiagramService) GetUploadURL(ctx context.Context, userID, workspaceID, diagramID primitive.ObjectID, fileType string) (string, string, error) {
	_, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return "", "", err
	}

	if s.gcsClient == nil {
		return "", "", errors.New("storage not configured")
	}

	var objectName string
	contentType := "application/octet-stream"

	if fileType == "thumbnail" {
		// diagrams/{userID}/{workspaceID}/{diagramID}/thumbnail.png
		objectName = fmt.Sprintf("diagrams/%s/%s/%s/thumbnail.png", userID.Hex(), workspaceID.Hex(), diagramID.Hex())
		contentType = "image/png"
	} else {
		// diagrams/{userID}/{workspaceID}/{diagramID}/diagram.flowstry
		objectName = fmt.Sprintf("diagrams/%s/%s/%s/diagram.flowstry", userID.Hex(), workspaceID.Hex(), diagramID.Hex())
	}
	
	// Generate signed URL valid for 15 minutes
	url, err := s.gcsClient.GetSignedURL(ctx, objectName, "PUT", contentType, 15*time.Minute)
	return url, objectName, err
}

// GetDownloadURL generates a signed URL for downloading a file
func (s *DiagramService) GetDownloadURL(ctx context.Context, diagramID, workspaceID primitive.ObjectID) (string, error) {
	diagram, err := s.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		return "", err
	}

	if s.gcsClient == nil {
		return "", errors.New("storage not configured")
	}

	if diagram.FileURL == "" {
		fmt.Printf("DEBUG: GetDownloadURL - FileURL is empty for diagram %s\n", diagramID.Hex())
		return "", errors.New("no file associated with diagram")
	}
	fmt.Printf("DEBUG: GetDownloadURL - Generating URL for FileURL: %s\n", diagram.FileURL)

	// The FileURL stored in DB is actually the object name in GCS (bucket/object logic handled by GCSClient)
	// Or sometimes it's the full public URL?
	// Based on Create method: objectName := fmt.Sprintf("diagrams/...") -> FileURL = objectName (returned from UploadFile)
	// So FileURL is the object name.
	
	// Generate signed URL valid for 60 minutes
	return s.gcsClient.GetSignedURL(ctx, diagram.FileURL, "GET", "", 60*time.Minute)
}

// GetThumbnailURL generates a signed URL for viewing the thumbnail
func (s *DiagramService) GetThumbnailURL(ctx context.Context, thumbnailPath string) (string, error) {
	if s.gcsClient == nil {
		return "", errors.New("storage not configured")
	}
	if thumbnailPath == "" {
		return "", nil
	}
	// Generate signed URL valid for 60 minutes
	return s.gcsClient.GetSignedURL(ctx, thumbnailPath, "GET", "", 60*time.Minute)
}

