package controllers

import (
	"context"
	"time"

	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FolderController handles folder endpoints
type FolderController struct {
	folderService    *services.FolderService
	workspaceService *services.WorkspaceService
	memberService    *services.MemberService
}

// NewFolderController creates a new folder controller
func NewFolderController(folderService *services.FolderService, workspaceService *services.WorkspaceService, memberService *services.MemberService) *FolderController {
	return &FolderController{
		folderService:    folderService,
		workspaceService: workspaceService,
		memberService:    memberService,
	}
}

// Create creates a new folder
func (fc *FolderController) Create(c *fiber.Ctx) error {
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

	// Verify user can create folders (Owner, Admin, or Editor)
	if !fc.memberService.CanCreate(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "You don't have permission to create folders")
	}

	var req models.CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return utils.BadRequest(c, "Name is required")
	}
	req.Name = utils.SanitizeString(req.Name, 100)

	folder, err := fc.folderService.Create(ctx, workspaceID, &req)
	if err != nil {
		return utils.InternalError(c, "Failed to create folder")
	}

	return utils.CreatedResponse(c, folder.ToResponse())
}

// List lists all folders in a workspace
func (fc *FolderController) List(c *fiber.Ctx) error {
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

	if err := fc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	folders, err := fc.folderService.List(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list folders")
	}

	responses := make([]*models.FolderResponse, len(folders))
	for i, f := range folders {
		responses[i] = f.ToResponse()
	}

	return utils.SuccessResponse(c, responses)
}

// Get retrieves a folder by ID
func (fc *FolderController) Get(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := fc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	folder, err := fc.folderService.GetByID(ctx, folderID, workspaceID)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to get folder")
	}

	return utils.SuccessResponse(c, folder.ToResponse())
}

// Update updates a folder
func (fc *FolderController) Update(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can update folders (Owner, Admin, or Editor)
	if !fc.memberService.CanEdit(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "You don't have permission to update folders")
	}

	var req models.UpdateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.Name != nil {
		sanitized := utils.SanitizeString(*req.Name, 100)
		req.Name = &sanitized
	}

	folder, err := fc.folderService.Update(ctx, folderID, workspaceID, &req)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to update folder")
	}

	return utils.SuccessResponse(c, folder.ToResponse())
}

// Delete deletes a folder
func (fc *FolderController) Delete(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can delete folders (Owner or Admin)
	if !fc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can delete folders")
	}

	err = fc.folderService.Delete(ctx, folderID, workspaceID)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to delete folder")
	}

	return utils.SuccessMessageResponse(c, "Folder moved to trash")
}

// Restore restores a folder from trash
func (fc *FolderController) Restore(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can restore folders (Owner or Admin)
	if !fc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can restore folders")
	}

	err = fc.folderService.Restore(ctx, folderID, workspaceID)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to restore folder")
	}

	return utils.SuccessMessageResponse(c, "Folder restored successfully")
}

// HardDelete permanently deletes a folder
func (fc *FolderController) HardDelete(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can permanently delete folders (Owner/Admin only)
	if !fc.memberService.CanDeleteContent(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can permanently delete folders")
	}

	err = fc.folderService.HardDelete(ctx, folderID, workspaceID)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to permanently delete folder")
	}

	return utils.SuccessMessageResponse(c, "Folder permanently deleted")
}

// ListTrash lists all folders in trash
func (fc *FolderController) ListTrash(c *fiber.Ctx) error {
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

	if err := fc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	folders, err := fc.folderService.ListTrash(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list trash")
	}

	responses := make([]*models.FolderResponse, len(folders))
	for i, f := range folders {
		responses[i] = f.ToResponse()
	}

	return utils.SuccessResponse(c, responses)
}

// AddDiagrams adds diagrams to a folder
func (fc *FolderController) AddDiagrams(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can add diagrams to folders (Owner, Admin, or Editor)
	if !fc.memberService.CanEdit(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "You don't have permission to add diagrams to folders")
	}

	var req models.AddDiagramsRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if len(req.DiagramIDs) == 0 {
		return utils.BadRequest(c, "At least one diagram ID is required")
	}

	diagramIDs := make([]primitive.ObjectID, 0, len(req.DiagramIDs))
	for _, idStr := range req.DiagramIDs {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return utils.BadRequest(c, "Invalid diagram ID: "+idStr)
		}
		diagramIDs = append(diagramIDs, id)
	}

	err = fc.folderService.AddDiagrams(ctx, folderID, workspaceID, diagramIDs)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to add diagrams to folder")
	}

	return utils.SuccessMessageResponse(c, "Diagrams added to folder")
}

// RemoveDiagram removes a diagram from a folder
func (fc *FolderController) RemoveDiagram(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	folderID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid folder ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("diagramId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Verify user can remove diagrams from folders (Owner, Admin, or Editor)
	if !fc.memberService.CanEdit(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "You don't have permission to remove diagrams from folders")
	}

	err = fc.folderService.RemoveDiagram(ctx, folderID, workspaceID, diagramID)
	if err != nil {
		if err == services.ErrFolderNotFound {
			return utils.NotFound(c, "Folder not found")
		}
		return utils.InternalError(c, "Failed to remove diagram from folder")
	}

	return utils.SuccessMessageResponse(c, "Diagram removed from folder")
}
