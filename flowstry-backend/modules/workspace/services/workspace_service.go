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
)

var (
	ErrWorkspaceNotFound = errors.New("workspace not found")
	ErrForbidden         = errors.New("access forbidden")
)

// WorkspaceService handles workspace operations
type WorkspaceService struct {
	memberService *MemberService
	inviteService *InviteService
}

// NewWorkspaceService creates a new workspace service
func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{}
}

// SetMemberService sets the member service (for dependency injection)
func (s *WorkspaceService) SetMemberService(ms *MemberService) {
	s.memberService = ms
}

// SetInviteService sets the invite service (for dependency injection)
func (s *WorkspaceService) SetInviteService(is *InviteService) {
	s.inviteService = is
}

// Create creates a new workspace and adds the creator as owner
func (s *WorkspaceService) Create(ctx context.Context, userID primitive.ObjectID, req *models.CreateWorkspaceRequest) (*models.Workspace, error) {
	collection := database.GetCollection("workspaces")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	workspace := &models.Workspace{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	result, err := collection.InsertOne(ctx, workspace)
	if err != nil {
		return nil, err
	}

	workspace.ID = result.InsertedID.(primitive.ObjectID)

	// Add creator as owner member
	if s.memberService != nil {
		_, err = s.memberService.AddMember(ctx, workspace.ID, userID, models.RoleOwner)
		if err != nil {
			// Rollback workspace creation
			collection.DeleteOne(ctx, bson.M{"_id": workspace.ID})
			return nil, err
		}
	}

	return workspace, nil
}

// GetByID retrieves a workspace by ID (checks member access)
func (s *WorkspaceService) GetByID(ctx context.Context, workspaceID, userID primitive.ObjectID) (*models.Workspace, error) {
	collection := database.GetCollection("workspaces")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var workspace models.Workspace
	err := collection.FindOne(ctx, bson.M{"_id": workspaceID}).Decode(&workspace)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}

	// Check membership access
	if s.memberService != nil {
		if !s.memberService.HasAccess(ctx, workspaceID, userID) {
			return nil, ErrForbidden
		}
	} else {
		// Fallback to owner check if member service not set
		if workspace.UserID != userID {
			return nil, ErrForbidden
		}
	}

	return &workspace, nil
}

// GetByIDWithRole retrieves a workspace and the user's role
func (s *WorkspaceService) GetByIDWithRole(ctx context.Context, workspaceID, userID primitive.ObjectID) (*models.Workspace, models.WorkspaceRole, error) {
	workspace, err := s.GetByID(ctx, workspaceID, userID)
	if err != nil {
		return nil, "", err
	}

	var role models.WorkspaceRole
	if s.memberService != nil {
		role = s.memberService.GetUserRole(ctx, workspaceID, userID)
	} else {
		role = models.RoleOwner // Fallback for legacy
	}

	return workspace, role, nil
}

// List retrieves all workspaces where user is a member
func (s *WorkspaceService) List(ctx context.Context, userID primitive.ObjectID) ([]*models.Workspace, map[primitive.ObjectID]models.WorkspaceRole, error) {
	collection := database.GetCollection("workspaces")
	if collection == nil {
		return nil, nil, errors.New("database not connected")
	}

	memberCollection := database.GetCollection("workspace_members")
	workspaceIDs := make([]primitive.ObjectID, 0)
	roleMap := make(map[primitive.ObjectID]models.WorkspaceRole)
	seen := make(map[primitive.ObjectID]struct{})

	// Get all workspace IDs where user is a member
	if memberCollection != nil {
		var memberRecords []models.WorkspaceMember
		cursor, err := memberCollection.Find(ctx, bson.M{"user_id": userID})
		if err != nil {
			return nil, nil, err
		}
		defer cursor.Close(ctx)

		if err := cursor.All(ctx, &memberRecords); err != nil {
			return nil, nil, err
		}

		for _, m := range memberRecords {
			if _, ok := seen[m.WorkspaceID]; !ok {
				seen[m.WorkspaceID] = struct{}{}
				workspaceIDs = append(workspaceIDs, m.WorkspaceID)
			}
			roleMap[m.WorkspaceID] = m.Role
		}
	}

	// Always include workspaces where the user is the owner
	ownerCursor, err := collection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, nil, err
	}
	defer ownerCursor.Close(ctx)

	var ownedWorkspaces []models.Workspace
	if err := ownerCursor.All(ctx, &ownedWorkspaces); err != nil {
		return nil, nil, err
	}
	for _, w := range ownedWorkspaces {
		if _, ok := seen[w.ID]; !ok {
			seen[w.ID] = struct{}{}
			workspaceIDs = append(workspaceIDs, w.ID)
		}
		// Ensure owners always have full access
		roleMap[w.ID] = models.RoleOwner
	}

	if len(workspaceIDs) == 0 {
		return []*models.Workspace{}, map[primitive.ObjectID]models.WorkspaceRole{}, nil
	}

	// Fetch workspaces
	workspaceCursor, err := collection.Find(ctx, bson.M{"_id": bson.M{"$in": workspaceIDs}})
	if err != nil {
		return nil, nil, err
	}
	defer workspaceCursor.Close(ctx)

	var workspaces []*models.Workspace
	if err := workspaceCursor.All(ctx, &workspaces); err != nil {
		return nil, nil, err
	}

	// For each workspace, count diagrams and folders
	diagramsCollection := database.GetCollection("diagrams")
	foldersCollection := database.GetCollection("folders")

	for _, w := range workspaces {
		if w.UserID == userID {
			roleMap[w.ID] = models.RoleOwner
		} else if roleMap[w.ID] == models.RoleOwner {
			roleMap[w.ID] = models.RoleAdmin
		}
		if diagramsCollection != nil {
			count, _ := diagramsCollection.CountDocuments(ctx, bson.M{"workspace_id": w.ID})
			w.DiagramCount = count
		}
		if foldersCollection != nil {
			count, _ := foldersCollection.CountDocuments(ctx, bson.M{"workspace_id": w.ID})
			w.FolderCount = count
		}
	}

	return workspaces, roleMap, nil
}

// Update updates a workspace (requires Admin+ role)
func (s *WorkspaceService) Update(ctx context.Context, workspaceID, userID primitive.ObjectID, req *models.UpdateWorkspaceRequest) (*models.Workspace, error) {
	// Verify access with admin permission
	workspace, err := s.GetByID(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}

	// Check admin permission
	if s.memberService != nil && !s.memberService.CanManageMembers(ctx, workspaceID, userID) {
		return nil, ErrForbidden
	}

	collection := database.GetCollection("workspaces")

	update := bson.M{"updated_at": time.Now()}
	if req.Name != nil {
		update["name"] = *req.Name
	}
	if req.Description != nil {
		update["description"] = *req.Description
	}


	_, err = collection.UpdateOne(
		ctx,
		bson.M{"_id": workspaceID},
		bson.M{"$set": update},
	)
	if err != nil {
		return nil, err
	}

	// Update local copy
	if req.Name != nil {
		workspace.Name = *req.Name
	}
	if req.Description != nil {
		workspace.Description = *req.Description
	}

	workspace.UpdatedAt = time.Now()

	return workspace, nil
}

// Delete deletes a workspace and all its contents (Owner only)
func (s *WorkspaceService) Delete(ctx context.Context, workspaceID, userID primitive.ObjectID) error {
	// Verify owner access
	_, err := s.GetByID(ctx, workspaceID, userID)
	if err != nil {
		return err
	}

	// Only owner can delete
	if s.memberService != nil && !s.memberService.CanDelete(ctx, workspaceID, userID) {
		return ErrForbidden
	}

	collection := database.GetCollection("workspaces")

	// Delete workspace
	_, err = collection.DeleteOne(ctx, bson.M{"_id": workspaceID})
	if err != nil {
		return err
	}

	// Delete associated folders
	foldersCollection := database.GetCollection("folders")
	if foldersCollection != nil {
		_, _ = foldersCollection.DeleteMany(ctx, bson.M{"workspace_id": workspaceID})
	}

	// Delete associated diagrams
	diagramsCollection := database.GetCollection("diagrams")
	if diagramsCollection != nil {
		_, _ = diagramsCollection.DeleteMany(ctx, bson.M{"workspace_id": workspaceID})
	}

	// Delete all members
	if s.memberService != nil {
		_ = s.memberService.DeleteAllMembers(ctx, workspaceID)
	}

	// Delete all invites
	if s.inviteService != nil {
		_ = s.inviteService.DeleteAllInvites(ctx, workspaceID)
	}

	return nil
}

// VerifyAccess checks if user has access to the workspace (any role)
func (s *WorkspaceService) VerifyAccess(ctx context.Context, workspaceID, userID primitive.ObjectID) error {
	_, err := s.GetByID(ctx, workspaceID, userID)
	return err
}

// VerifyOwnership is deprecated, use VerifyAccess with role checks instead
// Kept for backward compatibility
func (s *WorkspaceService) VerifyOwnership(ctx context.Context, workspaceID, userID primitive.ObjectID) error {
	return s.VerifyAccess(ctx, workspaceID, userID)
}

