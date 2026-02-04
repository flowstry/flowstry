package controllers

import (
	"context"
	"errors"
	"time"

	"github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const liveCollabTokenTTL = 5 * time.Minute

// LiveCollabController handles live collaboration endpoints.
type LiveCollabController struct {
	diagramService *services.DiagramService
	memberService  *services.MemberService
	collabService  *services.LiveCollabService
}

// NewLiveCollabController creates a new LiveCollabController.
func NewLiveCollabController(
	diagramService *services.DiagramService,
	memberService *services.MemberService,
	collabService *services.LiveCollabService,
) *LiveCollabController {
	return &LiveCollabController{
		diagramService: diagramService,
		memberService:  memberService,
		collabService:  collabService,
	}
}

// GetStatus returns whether live collaboration is enabled for a diagram.
func (lc *LiveCollabController) GetStatus(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("diagramId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if !lc.memberService.CanView(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Access denied")
	}

	if _, err := lc.diagramService.GetByID(ctx, diagramID, workspaceID); err != nil {
		if errors.Is(err, services.ErrDiagramNotFound) {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to get diagram")
	}

	memberCount, err := lc.memberService.CountMembers(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to check workspace members")
	}

	wsURL := lc.collabService.GetWSURL()
	if wsURL == "" {
		return utils.ServiceUnavailable(c, "Live collaboration is not configured")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"enabled": memberCount > 1,
		"ws_url":  wsURL,
	})
}

// GetToken issues a short-lived token to connect to live-collab.
func (lc *LiveCollabController) GetToken(c *fiber.Ctx) error {
	userID, err := getUserIDFromContext(c)
	if err != nil {
		return utils.Unauthorized(c, "User not authenticated")
	}

	workspaceID, err := primitive.ObjectIDFromHex(c.Params("workspaceId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid workspace ID")
	}

	diagramID, err := primitive.ObjectIDFromHex(c.Params("diagramId"))
	if err != nil {
		return utils.BadRequest(c, "Invalid diagram ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if !lc.memberService.CanView(ctx, workspaceID, userID) {
		return utils.Forbidden(c, "Access denied")
	}

	if _, err := lc.diagramService.GetByID(ctx, diagramID, workspaceID); err != nil {
		if errors.Is(err, services.ErrDiagramNotFound) {
			return utils.NotFound(c, "Diagram not found")
		}
		return utils.InternalError(c, "Failed to get diagram")
	}

	memberCount, err := lc.memberService.CountMembers(ctx, workspaceID)
	if err != nil {
		return utils.InternalError(c, "Failed to check workspace members")
	}
	if memberCount <= 1 {
		return utils.Conflict(c, "Live updates require at least two workspace members")
	}

	wsURL := lc.collabService.GetWSURL()
	if wsURL == "" {
		return utils.ServiceUnavailable(c, "Live collaboration is not configured")
	}

	displayName, avatarURL, err := lc.collabService.GetUserProfile(ctx, userID)
	if err != nil {
		// Log error but proceed? Or just ignore for now as avatar is optional
	}
	if displayName == "" {
		displayName = "User"
	}

	token, err := lc.collabService.GenerateJoinToken(userID, displayName, avatarURL, workspaceID, diagramID, liveCollabTokenTTL)
	if err != nil {
		return utils.ServiceUnavailable(c, "Live collaboration is not configured")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"token":      token,
		"expires_in": int(liveCollabTokenTTL.Seconds()),
		"ws_url":     wsURL,
	})
}
