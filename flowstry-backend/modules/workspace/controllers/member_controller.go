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

// MemberController handles workspace member endpoints
type MemberController struct {
	memberService *services.MemberService
}

// NewMemberController creates a new member controller
func NewMemberController(memberService *services.MemberService) *MemberController {
	return &MemberController{
		memberService: memberService,
	}
}

// List lists all members of a workspace
func (mc *MemberController) List(c *fiber.Ctx) error {
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

	// Check if user has access to the workspace
	if !mc.memberService.HasAccess(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Access denied")
	}

	members, err := mc.memberService.ListMembers(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to list members")
	}

	return utils.SuccessResponse(c, members)
}

// Remove removes a member from a workspace
func (mc *MemberController) Remove(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	targetUserID, err := primitive.ObjectIDFromHex(c.Params("userId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid user ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if user can manage members
	if !mc.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can remove members")
	}

	err = mc.memberService.RemoveMember(ctx, workspaceID, targetUserID)
	if err != nil {
		if err == services.ErrMemberNotFound {
			return utils.NotFound(c, "Member not found")
		}
		if err == services.ErrCannotRemoveOwner {
			return utils.BadRequest(c, "Cannot remove the workspace owner")
		}
		return utils.InternalError(c, "Failed to remove member")
	}

	return utils.SuccessMessageResponse(c, "Member removed successfully")
}

// UpdateRole updates a member's role
func (mc *MemberController) UpdateRole(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	targetUserID, err := primitive.ObjectIDFromHex(c.Params("userId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid user ID")
	}

	var req models.UpdateMemberRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if !req.Role.IsValid() || req.Role == models.RoleOwner {
		return utils.BadRequest(c, "Invalid role")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if user can manage members
	if !mc.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Only owners and admins can update roles")
	}

	err = mc.memberService.UpdateRole(ctx, workspaceID, targetUserID, req.Role, userID)
	if err != nil {
		if err == services.ErrMemberNotFound {
			return utils.NotFound(c, "Member not found")
		}
		if err == services.ErrCannotRemoveOwner {
			return utils.BadRequest(c, "Cannot change owner's role")
		}
		if err == services.ErrCannotChangeOwnRole {
			return utils.BadRequest(c, "Cannot change your own role")
		}
		if err == services.ErrInsufficientRole {
			return utils.Forbidden(c, "Insufficient permissions for this action")
		}
		return utils.InternalError(c, "Failed to update role")
	}

	return utils.SuccessMessageResponse(c, "Role updated successfully")
}
