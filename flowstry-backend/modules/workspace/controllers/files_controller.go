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

// WorkspaceFilesResponse contains all folders and diagrams in a workspace
type WorkspaceFilesResponse struct {
	Folders  []*models.FolderResponse  `json:"folders"`
	Diagrams []*models.DiagramResponse `json:"diagrams"`
}

// FilesController handles workspace files endpoints
type FilesController struct {
	folderService    *services.FolderService
	diagramService   *services.DiagramService
	workspaceService *services.WorkspaceService
	memberService    *services.MemberService
}

// NewFilesController creates a new files controller
func NewFilesController(
	folderService *services.FolderService,
	diagramService *services.DiagramService,
	workspaceService *services.WorkspaceService,
	memberService *services.MemberService,
) *FilesController {
	return &FilesController{
		folderService:    folderService,
		diagramService:   diagramService,
		workspaceService: workspaceService,
		memberService:    memberService,
	}
}

// List returns all folders and diagrams in a workspace
// GET /workspaces/:id/files
func (fc *FilesController) List(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Verify workspace ownership
	if err := fc.workspaceService.VerifyOwnership(ctx, workspaceID, userID); err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		return utils.Forbidden(c, "Access denied")
	}

	// Get all folders
	folders, err := fc.folderService.List(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list folders")
	}

	folderResponses := make([]*models.FolderResponse, len(folders))
	for i, f := range folders {
		folderResponses[i] = f.ToResponse()
	}

	// Get all diagrams
	diagrams, err := fc.diagramService.List(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list diagrams")
	}

	diagramResponses := make([]*models.DiagramResponse, len(diagrams))
	for i, d := range diagrams {
		resp := d.ToResponse()
		if d.Thumbnail != "" {
			if url, err := fc.diagramService.GetThumbnailURL(ctx, d.Thumbnail); err == nil {
				resp.ThumbnailURL = url
			}
		}
		diagramResponses[i] = resp
	}

	return utils.SuccessResponse(c, &WorkspaceFilesResponse{
		Folders:  folderResponses,
		Diagrams: diagramResponses,
	})
}
