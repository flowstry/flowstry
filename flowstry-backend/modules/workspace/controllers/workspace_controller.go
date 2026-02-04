package controllers

import (
	"context"
	"time"

	"github.com/flowstry/flowstry-backend/middleware"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// WorkspaceController handles workspace endpoints
type WorkspaceController struct {
	workspaceService *services.WorkspaceService
	memberService    *services.MemberService
}

// NewWorkspaceController creates a new workspace controller
func NewWorkspaceController(workspaceService *services.WorkspaceService, memberService *services.MemberService) *WorkspaceController {
	return &WorkspaceController{
		workspaceService: workspaceService,
		memberService:    memberService,
	}
}

// Create creates a new workspace
func (wc *WorkspaceController) Create(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	var req models.CreateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.Name == "" {
		return utils.BadRequest(c, "Name is required")
	}
	req.Name = utils.SanitizeString(req.Name, 100)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	workspace, err := wc.workspaceService.Create(ctx, userID, &req)
	if err != nil {
		return utils.InternalError(c, "Failed to create workspace")
	}

	resp := workspace.ToResponse()
	resp.UserRole = models.RoleOwner
	return utils.CreatedResponse(c, resp)
}

// List lists all workspaces for the current user
func (wc *WorkspaceController) List(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	workspaces, roleMap, err := wc.workspaceService.List(ctx, userID)
	if err != nil {
		return utils.InternalError(c, "Failed to list workspaces")
	}

	responses := make([]*models.WorkspaceResponse, len(workspaces))
	for i, w := range workspaces {
		resp := w.ToResponse()
		if role, ok := roleMap[w.ID]; ok {
			resp.UserRole = role
		}
		responses[i] = resp
	}

	return utils.SuccessResponse(c, responses)
}

// Get retrieves a workspace by ID
func (wc *WorkspaceController) Get(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	workspace, role, err := wc.workspaceService.GetByIDWithRole(ctx, workspaceID, userID)
	if err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		if err == services.ErrForbidden {
			return utils.Forbidden(c, "Access denied")
		}
		return utils.InternalError(c, "Failed to get workspace")
	}

	resp := workspace.ToResponse()
	resp.UserRole = role
	return utils.SuccessResponse(c, resp)
}

// Update updates a workspace
func (wc *WorkspaceController) Update(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	var req models.UpdateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.Name != nil {
		sanitized := utils.SanitizeString(*req.Name, 100)
		req.Name = &sanitized
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	workspace, err := wc.workspaceService.Update(ctx, workspaceID, userID, &req)
	if err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		if err == services.ErrForbidden {
			return utils.Forbidden(c, "Only owners and admins can update workspace settings")
		}
		return utils.InternalError(c, "Failed to update workspace")
	}

	resp := workspace.ToResponse()
	resp.UserRole = wc.memberService.GetUserRole(ctx, workspaceID, userID)
	return utils.SuccessResponse(c, resp)
}

// Delete deletes a workspace
func (wc *WorkspaceController) Delete(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = wc.workspaceService.Delete(ctx, workspaceID, userID)
	if err != nil {
		if err == services.ErrWorkspaceNotFound {
			return utils.NotFound(c, "Workspace not found")
		}
		if err == services.ErrForbidden {
			return utils.Forbidden(c, "Only the workspace owner can delete the workspace")
		}
		return utils.InternalError(c, "Failed to delete workspace")
	}

	return utils.SuccessMessageResponse(c, "Workspace deleted successfully")
}

// getUserIDFromContext extracts user ID from fiber context
func getUserIDFromContext(c *fiber.Ctx) (primitive.ObjectID, error) {
	userIDStr := middleware.GetUserID(c)
	if userIDStr == "" {
		return primitive.NilObjectID, fiber.ErrUnauthorized
	}
	return primitive.ObjectIDFromHex(userIDStr)
}

