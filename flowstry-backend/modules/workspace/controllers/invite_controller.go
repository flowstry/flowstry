package controllers

import (
	"context"
	"strings"
	"time"

	"github.com/flowstry/flowstry-backend/middleware"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InviteController handles workspace invite endpoints
type InviteController struct {
	inviteService *services.InviteService
	memberService *services.MemberService
}

// NewInviteController creates a new invite controller
func NewInviteController(inviteService *services.InviteService, memberService *services.MemberService) *InviteController {
	return &InviteController{
		inviteService: inviteService,
		memberService: memberService,
	}
}

// Create creates a new invite
func (ic *InviteController) Create(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	var req models.CreateInviteRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	// Validate email
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return utils.BadRequest(c, "Valid email is required")
	}

	// Validate role
	if !req.Role.IsValid() || req.Role == models.RoleOwner {
		return utils.BadRequest(c, "Invalid role. Must be admin, editor, or viewer")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if user can manage members
	if !ic.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can send invites")
	}

	invite, err := ic.inviteService.CreateInvite(ctx, workspaceID, req.Email, req.Role, userID)
	if err != nil {
		if err == services.ErrInviteAlreadyExists {
			return utils.BadRequest(c, "An invite for this email already exists")
		}
		if err == services.ErrUserAlreadyMember {
			return utils.BadRequest(c, "User is already a member of this workspace")
		}
		return utils.InternalError(c, "Failed to create invite")
	}

	return utils.CreatedResponse(c, invite.ToResponse())
}

// List lists all pending invites for a workspace
func (ic *InviteController) List(c *fiber.Ctx) error {
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

	// Check if user can manage members
	if !ic.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can view invites")
	}

	invites, err := ic.inviteService.ListPendingInvites(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list invites")
	}

	return utils.SuccessResponse(c, invites)
}

// Revoke revokes a pending invite
func (ic *InviteController) Revoke(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	inviteID, err := primitive.ObjectIDFromHex(c.Params("inviteId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid invite ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if user can manage members
	if !ic.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can revoke invites")
	}

	err = ic.inviteService.RevokeInvite(ctx, inviteID, workspaceID)
	if err != nil {
		if err == services.ErrInviteNotFound {
			return utils.NotFound(c, "Invite not found")
		}
		return utils.InternalError(c, "Failed to revoke invite")
	}

	return utils.SuccessMessageResponse(c, "Invite revoked successfully")
}

// GetByToken gets invite details by token (for accept flow)
func (ic *InviteController) GetByToken(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return utils.BadRequest(c, "Token is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	details, err := ic.inviteService.GetInviteDetails(ctx, token)
	if err != nil {
		if err == services.ErrInviteNotFound {
			return utils.NotFound(c, "Invite not found")
		}
		if err == services.ErrInviteExpired {
			return utils.BadRequest(c, "Invite has expired")
		}
		return utils.InternalError(c, "Failed to get invite details")
	}

	return utils.SuccessResponse(c, details)
}

// Accept accepts an invite and joins the workspace
func (ic *InviteController) Accept(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	token := c.Params("token")
	if token == "" {
		return utils.BadRequest(c, "Token is required")
	}

	// Get user email from context
	userEmail := middleware.GetUserEmail(c)
	if userEmail == "" {
		return utils.Unauthorized(c, "User email not found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	member, err := ic.inviteService.AcceptInvite(ctx, token, userID, userEmail)
	if err != nil {
		if err == services.ErrInviteNotFound {
			return utils.NotFound(c, "Invite not found")
		}
		if err == services.ErrInviteExpired {
			return utils.BadRequest(c, "Invite has expired")
		}
		if err == services.ErrUserAlreadyMember {
			return utils.BadRequest(c, "You are already a member of this workspace")
		}
		if strings.Contains(err.Error(), "different email") {
			return utils.Forbidden(c, "This invite is for a different email address")
		}
		return utils.InternalError(c, "Failed to accept invite")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"message":      "Invite accepted successfully",
		"workspace_id": member.WorkspaceID,
		"role":         member.Role,
	})
}

// ListUserInvites lists all pending invites for the current user
func (ic *InviteController) ListUserInvites(c *fiber.Ctx) error {
	userEmail := middleware.GetUserEmail(c)
	if userEmail == "" {
		return utils.Unauthorized(c, "User email not found")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	invites, err := ic.inviteService.ListUserInvites(ctx, userEmail)
	if err != nil {
		return utils.InternalError(c, "Failed to list invites")
	}

	return utils.SuccessResponse(c, invites)
}
