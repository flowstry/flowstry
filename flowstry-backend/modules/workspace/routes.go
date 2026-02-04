package workspace

import (
	"github.com/flowstry/flowstry-backend/middleware"
	"github.com/flowstry/flowstry-backend/modules/auth/services"
	"github.com/flowstry/flowstry-backend/modules/workspace/controllers"
	workspaceServices "github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/storage"
	"github.com/gofiber/fiber/v2"
	"fmt"
)

// SetupRoutes configures workspace routes
func SetupRoutes(app *fiber.App, authService *services.AuthService, gcsClient *storage.GCSClient, liveCollabService *workspaceServices.LiveCollabService) {
	// Initialize services
	encryptionService, err := workspaceServices.NewEncryptionService()
	if err != nil {
		fmt.Printf("Warning: Failed to initialize encryption service: %v\n", err)
	}

	workspaceService := workspaceServices.NewWorkspaceService()
	workspaceService.SetEncryptionService(encryptionService)

	memberService := workspaceServices.NewMemberService()
	inviteService := workspaceServices.NewInviteService(memberService)
	folderService := workspaceServices.NewFolderService()
	diagramService := workspaceServices.NewDiagramService(gcsClient, folderService)

	// Set member service on workspace service for RBAC
	workspaceService.SetMemberService(memberService)
	workspaceService.SetInviteService(inviteService)

	// Initialize controllers
	workspaceController := controllers.NewWorkspaceController(workspaceService, memberService)
	memberController := controllers.NewMemberController(memberService)
	inviteController := controllers.NewInviteController(inviteService, memberService)
	folderController := controllers.NewFolderController(folderService, workspaceService, memberService)
	diagramController := controllers.NewDiagramController(diagramService, workspaceService, memberService)
	filesController := controllers.NewFilesController(folderService, diagramService, workspaceService, memberService)
	liveCollabController := controllers.NewLiveCollabController(diagramService, memberService, liveCollabService)

	// Protected routes - require authentication
	workspaces := app.Group("/workspaces", middleware.AuthMiddleware(authService))

	// Workspace routes
	workspaces.Get("/", workspaceController.List)
	workspaces.Post("/", workspaceController.Create)
	workspaces.Get("/recents", diagramController.ListRecent)
	workspaces.Get("/:id", workspaceController.Get)
	workspaces.Get("/:id/key", workspaceController.GetKey)
	workspaces.Put("/:id", workspaceController.Update)
	workspaces.Put("/:id", workspaceController.Update)
	workspaces.Delete("/:id", workspaceController.Delete)
	workspaces.Get("/:workspaceId/trash", diagramController.ListTrash) // Workspace trash

	// Files route - get all folders and diagrams in a workspace
	workspaces.Get("/:id/files", filesController.List)

	// Member routes (within workspace)
	workspaces.Get("/:id/members", memberController.List)
	workspaces.Delete("/:id/members/:userId", memberController.Remove)
	workspaces.Put("/:id/members/:userId/role", memberController.UpdateRole)

	// Invite routes (within workspace)
	workspaces.Post("/:id/invites", inviteController.Create)
	workspaces.Get("/:id/invites", inviteController.List)
	workspaces.Delete("/:id/invites/:inviteId", inviteController.Revoke)

	// Folder routes (within workspace)
	workspaces.Get("/:workspaceId/folders/trash", folderController.ListTrash) // Folder trash
	workspaces.Get("/:workspaceId/folders", folderController.List)
	workspaces.Post("/:workspaceId/folders", folderController.Create)
	workspaces.Get("/:workspaceId/folders/:id", folderController.Get)
	workspaces.Put("/:workspaceId/folders/:id", folderController.Update)
	workspaces.Put("/:workspaceId/folders/:id", folderController.Update)
	workspaces.Delete("/:workspaceId/folders/:id", folderController.Delete)
	workspaces.Post("/:workspaceId/folders/:id/restore", folderController.Restore)
	workspaces.Delete("/:workspaceId/folders/:id/permanent", folderController.HardDelete)
	workspaces.Post("/:workspaceId/folders/:id/diagrams", folderController.AddDiagrams)
	workspaces.Delete("/:workspaceId/folders/:id/diagrams/:diagramId", folderController.RemoveDiagram)

	// Diagram routes (within workspace)
	workspaces.Get("/:workspaceId/diagrams", diagramController.List)
	workspaces.Post("/:workspaceId/diagrams", diagramController.Create)
	workspaces.Get("/:workspaceId/diagrams/:id", diagramController.Get)
	workspaces.Get("/:workspaceId/diagrams/:id/download", diagramController.Download)
	workspaces.Put("/:workspaceId/diagrams/:id", diagramController.Update)
	workspaces.Put("/:workspaceId/diagrams/:id", diagramController.Update)
	workspaces.Delete("/:workspaceId/diagrams/:id", diagramController.Delete)
	workspaces.Post("/:workspaceId/diagrams/:id/restore", diagramController.Restore)
	workspaces.Delete("/:workspaceId/diagrams/:id/permanent", diagramController.HardDelete)

	// Live collaboration routes (within diagram)
	workspaces.Get("/:workspaceId/diagrams/:diagramId/live", liveCollabController.GetStatus)
	workspaces.Get("/:workspaceId/diagrams/:diagramId/live/token", liveCollabController.GetToken)

	// Signed URL routes
	workspaces.Get("/:workspaceId/diagrams/:id/upload-url", diagramController.GetUploadURL)
	workspaces.Get("/:workspaceId/diagrams/:id/download-url", diagramController.GetDownloadURL)

	// Invite routes (authenticated, outside workspace context)
	invites := app.Group("/invites", middleware.AuthMiddleware(authService))
	invites.Get("/", inviteController.ListUserInvites)        // List user's pending invites
	invites.Get("/:token", inviteController.GetByToken)       // Get invite details
	invites.Post("/:token/accept", inviteController.Accept)   // Accept invite
}

