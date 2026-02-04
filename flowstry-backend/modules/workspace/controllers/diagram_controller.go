package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// DiagramController handles diagram endpoints
type DiagramController struct {
	diagramService   *services.DiagramService
	workspaceService *services.WorkspaceService
	memberService    *services.MemberService
}

// NewDiagramController creates a new diagram controller
func NewDiagramController(diagramService *services.DiagramService, workspaceService *services.WorkspaceService, memberService *services.MemberService) *DiagramController {
	return &DiagramController{
		diagramService:   diagramService,
		workspaceService: workspaceService,
		memberService:    memberService,
	}
}

// Create creates a new diagram
func (dc *DiagramController) Create(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Verify user can create diagrams (Owner/Admin only)
	if !dc.memberService.CanCreate(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can create diagrams")
	}

	// Parse metadata from form
	// Frontend sends metadata as a JSON string in the "metadata" field
	var name, description, folderID string
	metadataStr := c.FormValue("metadata")
	if metadataStr != "" {
		var metadata struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			FolderID    string `json:"folder_id"`
		}
		if err := json.Unmarshal([]byte(metadataStr), &metadata); err != nil {
			return utils.BadRequest(c, "Invalid metadata format")
		}
		name = metadata.Name
		description = metadata.Description
		folderID = metadata.FolderID
	} else {
		// Fallback to individual form fields
		name = c.FormValue("name")
		description = c.FormValue("description")
		folderID = c.FormValue("folder_id")
	}

	if name == "" {
		return utils.BadRequest(c, "Name is required")
	}
	name = utils.SanitizeString(name, 100)

	// Get file data
	var fileData []byte
	file, err := c.FormFile("file")
	if err == nil && file != nil {
		f, err := file.Open()
		if err != nil {
			return utils.BadRequest(c, "Failed to read file")
		}
		defer f.Close()

		fileData = make([]byte, file.Size)
		if _, err := f.Read(fileData); err != nil {
			return utils.BadRequest(c, "Failed to read file data")
		}
	}

	if folderID != "" {
		if _, err := primitive.ObjectIDFromHex(folderID); err != nil {
			return utils.BadRequest(c, "Invalid folder ID")
		}
	}

	req := &models.CreateDiagramRequest{
		Name:        name,
		Description: description,
		FolderID:    folderID,
	}

	diagram, err := dc.diagramService.Create(ctx, userID, workspaceID, req, fileData)
	if err != nil {
		if errors.Is(err, services.ErrFolderNotFound) {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to create diagram")
	}

	resp := diagram.ToResponse()
	if diagram.Thumbnail != "" {
		if url, err := dc.diagramService.GetThumbnailURL(ctx, diagram.Thumbnail); err == nil {
			resp.ThumbnailURL = url
		}
	}

	return utils.CreatedResponse(c, resp)
}

// List lists all diagrams in a workspace
func (dc *DiagramController) List(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	diagrams, err := dc.diagramService.List(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list diagrams")
	}

	responses := make([]*models.DiagramResponse, len(diagrams))
	for i, d := range diagrams {
		resp := d.ToResponse()
		if d.Thumbnail != "" {
			fmt.Printf("DEBUG: Found thumbnail for diagram %s: %s\n", d.ID.Hex(), d.Thumbnail)
			if url, err := dc.diagramService.GetThumbnailURL(ctx, d.Thumbnail); err == nil {
				resp.ThumbnailURL = url
				fmt.Printf("DEBUG: Generated signed URL: %s...\n", url[:50])
			} else {
				fmt.Printf("DEBUG: Failed to generate signed URL: %v\n", err)
			}
		} else {
			fmt.Printf("DEBUG: No thumbnail for diagram %s\n", d.ID.Hex())
		}
		responses[i] = resp
	}

	return utils.SuccessResponse(c, responses)
}

// ListRecent lists recent diagrams across all accessible workspaces
func (dc *DiagramController) ListRecent(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	limit := int64(c.QueryInt("limit", 12))
	if limit <= 0 {
		limit = 12
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	workspaces, _, err := dc.workspaceService.List(ctx, userID)
	if err != nil {
		return utils.InternalError(c, "Failed to list workspaces")
	}
	if len(workspaces) == 0 {
		return utils.SuccessResponse(c, []*models.RecentDiagramResponse{})
	}

	workspaceIDs := make([]primitive.ObjectID, 0, len(workspaces))
	workspaceMap := make(map[primitive.ObjectID]string, len(workspaces))
	for _, w := range workspaces {
		workspaceIDs = append(workspaceIDs, w.ID)
		workspaceMap[w.ID] = w.Name
	}

	diagrams, err := dc.diagramService.ListRecent(ctx, workspaceIDs, limit)
	if err != nil {
		return utils.InternalError(c, "Failed to list recent diagrams")
	}

	responses := make([]*models.RecentDiagramResponse, len(diagrams))
	for i, d := range diagrams {
		resp := &models.RecentDiagramResponse{
			ID:            d.ID,
			WorkspaceID:   d.WorkspaceID,
			WorkspaceName: workspaceMap[d.WorkspaceID],
			FolderID:      d.FolderID,
			Name:          d.Name,
			Thumbnail:     d.Thumbnail,
			CreatedAt:     d.CreatedAt,
			UpdatedAt:     d.UpdatedAt,
		}
		if d.Thumbnail != "" {
			if url, err := dc.diagramService.GetThumbnailURL(ctx, d.Thumbnail); err == nil {
				resp.ThumbnailURL = url
			}
		}
		responses[i] = resp
	}

	return utils.SuccessResponse(c, responses)
}

// Get retrieves a diagram by ID
func (dc *DiagramController) Get(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	diagram, err := dc.diagramService.GetByID(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to get diagram")
	}

	resp := diagram.ToResponse()
	if diagram.Thumbnail != "" {
		if url, err := dc.diagramService.GetThumbnailURL(ctx, diagram.Thumbnail); err == nil {
			resp.ThumbnailURL = url
		}
	}

	return utils.SuccessResponse(c, resp)
}

// Download downloads a diagram file
func (dc *DiagramController) Download(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	data, diagram, err := dc.diagramService.Download(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to download diagram")
	}

	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Disposition", "attachment; filename=\""+diagram.Name+".flowstry\"")
	return c.Send(data)
}

// Update updates diagram metadata
func (dc *DiagramController) Update(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Verify user can edit diagrams (Owner/Admin/Editor)
	if !dc.memberService.CanEdit(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "You don't have permission to edit diagrams")
	}

	// Check if this is a file update (multipart) or metadata update (JSON)
	contentType := c.Get("Content-Type")
	if contentType == "application/json" || contentType == "" {
		// Metadata update
		var req models.UpdateDiagramRequest
		if err := c.BodyParser(&req); err != nil {
			return utils.BadRequest(c, "Invalid request body")
		}
		
		// Debug logging
		fmt.Printf("DEBUG: Update diagram request: Name=%v, FileURL=%v\n", 
			req.Name, req.FileURL)
		if req.FileURL != nil {
			fmt.Printf("DEBUG: Setting FileURL to: %s\n", *req.FileURL)
		} else {
			fmt.Printf("DEBUG: FileURL is nil in request\n")
		}

		if req.Name != nil {
			sanitized := utils.SanitizeString(*req.Name, 100)
			req.Name = &sanitized
		}

		diagram, err := dc.diagramService.Update(ctx, diagramID, workspaceID, &req)
		if err != nil {
			if err == services.ErrDiagramNotFound {
				return utils.NotFound(c, "Diagram not found")
			}
			return utils.InternalError(c, "Failed to update diagram")
		}

		resp := diagram.ToResponse()
		if diagram.Thumbnail != "" {
			if url, err := dc.diagramService.GetThumbnailURL(ctx, diagram.Thumbnail); err == nil {
				resp.ThumbnailURL = url
			}
		}

		return utils.SuccessResponse(c, resp)
	}

	// File update (multipart form)
	file, err := c.FormFile("file")
	if err != nil {
		return utils.BadRequest(c, "File is required for file update")
	}

	f, err := file.Open()
	if err != nil {
		return utils.BadRequest(c, "Failed to read file")
	}
	defer f.Close()

	fileData := make([]byte, file.Size)
	if _, err := f.Read(fileData); err != nil {
		return utils.BadRequest(c, "Failed to read file data")
	}

	diagram, err := dc.diagramService.UpdateFile(ctx, userID, diagramID, workspaceID, fileData)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to update diagram file")
	}

	resp := diagram.ToResponse()
	if diagram.Thumbnail != "" {
		if url, err := dc.diagramService.GetThumbnailURL(ctx, diagram.Thumbnail); err == nil {
			resp.ThumbnailURL = url
		}
	}
	return utils.SuccessResponse(c, resp)
}

// Delete deletes a diagram
func (dc *DiagramController) Delete(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Verify user can delete diagrams (Owner or Admin)
	if !dc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can delete diagrams")
	}

	err = dc.diagramService.Delete(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to delete diagram")
	}

	return utils.SuccessMessageResponse(c, "Diagram moved to trash")
}

// Restore restores a diagram from trash
func (dc *DiagramController) Restore(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Verify user can restore diagrams (Owner or Admin)
	if !dc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can restore diagrams")
	}

	err = dc.diagramService.Restore(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to restore diagram")
	}

	return utils.SuccessMessageResponse(c, "Diagram restored successfully")
}

// HardDelete permanently deletes a diagram
func (dc *DiagramController) HardDelete(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Verify user can permanently delete diagrams (Owner/Admin only)
	if !dc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can permanently delete diagrams")
	}

	err = dc.diagramService.HardDelete(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to permanently delete diagram")
	}

	return utils.SuccessMessageResponse(c, "Diagram permanently deleted")
}

// ListTrash lists all diagrams in trash
func (dc *DiagramController) ListTrash(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	diagrams, err := dc.diagramService.ListTrash(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list trash")
	}

	responses := make([]*models.DiagramResponse, len(diagrams))
	for i, d := range diagrams {
		responses[i] = d.ToResponse()
	}

	return utils.SuccessResponse(c, responses)
}

// GetUploadURL generates a signed URL for uploading a file
func (dc *DiagramController) GetUploadURL(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	// Get fileType from query param (default to "diagram")
	fileType := c.Query("type", "diagram")

	url, objectName, err := dc.diagramService.GetUploadURL(ctx, userID, workspaceID, diagramID, fileType)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to generate upload URL")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"upload_url":  url,
		"object_name": objectName,
		"expires_in":  900, // 15 minutes
	})
}

// GetDownloadURL generates a signed URL for downloading a file
func (dc *DiagramController) GetDownloadURL(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := dc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	url, err := dc.diagramService.GetDownloadURL(ctx, diagramID, workspaceID)
	if err != nil {
		if err == services.ErrDiagramNotFound {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to generate download URL")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"download_url": url,
		"expires_in":   3600, // 60 minutes
	})
}
