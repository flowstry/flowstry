package services

import (
	"context"
	"errors"
	"time"

	"github.com/flowstry/flowstry-backend/database"
	authModels "github.com/flowstry/flowstry-backend/modules/auth/models"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrMemberNotFound      = errors.New("member not found")
	ErrMemberAlreadyExists = errors.New("user is already a member of this workspace")
	ErrCannotRemoveOwner   = errors.New("cannot remove the workspace owner")
	ErrCannotChangeOwnRole = errors.New("cannot change your own role")
	ErrInsufficientRole    = errors.New("insufficient permissions for this action")
	ErrCannotAssignOwner   = errors.New("owner role is determined by the workspace user_id")
)

// MemberService handles workspace member operations
type MemberService struct{}

// NewMemberService creates a new member service
func NewMemberService() *MemberService {
	return &MemberService{}
}

// AddMember adds a user as a member of a workspace
func (s *MemberService) AddMember(ctx context.Context, workspaceID, userID primitive.ObjectID, role models.WorkspaceRole) (*models.WorkspaceMember, error) {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	if role == models.RoleOwner {
		ownerID, err := s.getWorkspaceOwnerID(ctx, workspaceID)
		if err != nil {
			return nil, err
		}
		if ownerID != userID {
			return nil, ErrCannotAssignOwner
		}
	}

	// Check if already a member
	existing, _ := s.GetMember(ctx, workspaceID, userID)
	if existing != nil {
		return nil, ErrMemberAlreadyExists
	}

	member := &models.WorkspaceMember{
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        role,
		JoinedAt:    time.Now(),
	}

	result, err := collection.InsertOne(ctx, member)
	if err != nil {
		return nil, err
	}

	member.ID = result.InsertedID.(primitive.ObjectID)
	return member, nil
}

// RemoveMember removes a user from a workspace
func (s *MemberService) RemoveMember(ctx context.Context, workspaceID, userID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return errors.New("database not connected")
	}

	// Cannot remove owner
	ownerID, err := s.getWorkspaceOwnerID(ctx, workspaceID)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	if err == nil && ownerID == userID {
		return ErrCannotRemoveOwner
	}

	result, err := collection.DeleteOne(ctx, bson.M{
		"workspace_id": workspaceID,
		"user_id":      userID,
	})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrMemberNotFound
	}

	return nil
}

// GetMember retrieves a specific member record
func (s *MemberService) GetMember(ctx context.Context, workspaceID, userID primitive.ObjectID) (*models.WorkspaceMember, error) {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var member models.WorkspaceMember
	err := collection.FindOne(ctx, bson.M{
		"workspace_id": workspaceID,
		"user_id":      userID,
	}).Decode(&member)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrMemberNotFound
		}
		return nil, err
	}

	return &member, nil
}

// ListMembers lists all members of a workspace with user details
func (s *MemberService) ListMembers(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.WorkspaceMemberResponse, error) {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	// Aggregate to join with users collection
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"workspace_id": workspaceID}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "user_id",
			"foreignField": "_id",
			"as":           "user",
		}}},
		{{Key: "$unwind", Value: "$user"}},
		{{Key: "$project", Value: bson.M{
			"_id":        1,
			"user_id":    1,
			"role":       1,
			"joined_at":  1,
			"email":      "$user.email",
			"name":       "$user.name",
			"avatar_url": "$user.avatar_url",
		}}},
		{{Key: "$sort", Value: bson.D{
			{Key: "role", Value: 1}, // owner first, then admin, etc.
			{Key: "joined_at", Value: 1},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []struct {
		ID        primitive.ObjectID   `bson:"_id"`
		UserID    primitive.ObjectID   `bson:"user_id"`
		Role      models.WorkspaceRole `bson:"role"`
		JoinedAt  time.Time            `bson:"joined_at"`
		Email     string               `bson:"email"`
		Name      string               `bson:"name"`
		AvatarURL string               `bson:"avatar_url"`
	}

	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	ownerID, err := s.getWorkspaceOwnerID(ctx, workspaceID)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	members := make([]*models.WorkspaceMemberResponse, len(results))
	for i, r := range results {
		role := r.Role
		if ownerID == r.UserID {
			role = models.RoleOwner
		} else if role == models.RoleOwner {
			role = models.RoleAdmin
		}
		members[i] = &models.WorkspaceMemberResponse{
			ID:        r.ID,
			UserID:    r.UserID,
			Email:     r.Email,
			Name:      r.Name,
			AvatarURL: r.AvatarURL,
			Role:      role,
			JoinedAt:  r.JoinedAt,
		}
	}

	return members, nil
}

// CountMembers returns the number of members in a workspace.
func (s *MemberService) CountMembers(ctx context.Context, workspaceID primitive.ObjectID) (int64, error) {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return 0, errors.New("database not connected")
	}

	return collection.CountDocuments(ctx, bson.M{"workspace_id": workspaceID})
}

// UpdateRole updates a member's role
func (s *MemberService) UpdateRole(ctx context.Context, workspaceID, userID primitive.ObjectID, newRole models.WorkspaceRole, actorID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return errors.New("database not connected")
	}

	if newRole == models.RoleOwner {
		return ErrCannotAssignOwner
	}

	// Cannot change own role
	if userID == actorID {
		return ErrCannotChangeOwnRole
	}

	ownerID, err := s.getWorkspaceOwnerID(ctx, workspaceID)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	if err == nil && ownerID == userID {
		return ErrCannotRemoveOwner
	}

	// Get actor's role
	actorRole := s.GetUserRole(ctx, workspaceID, actorID)
	if actorRole == "" {
		return ErrInsufficientRole
	}

	// Only owner can promote to admin
	if newRole == models.RoleAdmin && actorRole != models.RoleOwner {
		return ErrInsufficientRole
	}

	// Admins cannot change other admins
	member, err := s.GetMember(ctx, workspaceID, userID)
	if err != nil {
		return err
	}
	if member.Role == models.RoleAdmin && actorRole != models.RoleOwner {
		return ErrInsufficientRole
	}

	_, err = collection.UpdateOne(
		ctx,
		bson.M{"workspace_id": workspaceID, "user_id": userID},
		bson.M{"$set": bson.M{"role": newRole}},
	)

	return err
}

// GetUserRole returns the user's role in a workspace (empty string if not a member)
func (s *MemberService) GetUserRole(ctx context.Context, workspaceID, userID primitive.ObjectID) models.WorkspaceRole {
	ownerID, err := s.getWorkspaceOwnerID(ctx, workspaceID)
	if err == nil && ownerID == userID {
		return models.RoleOwner
	}
	if err != nil && errors.Is(err, mongo.ErrNoDocuments) {
		return ""
	}

	member, err := s.GetMember(ctx, workspaceID, userID)
	if err == nil {
		if member.Role == models.RoleOwner {
			return models.RoleAdmin
		}
		return member.Role
	}
	return ""
}

func (s *MemberService) getWorkspaceOwnerID(ctx context.Context, workspaceID primitive.ObjectID) (primitive.ObjectID, error) {
	workspaceCollection := database.GetCollection("workspaces")
	if workspaceCollection == nil {
		return primitive.NilObjectID, errors.New("database not connected")
	}

	var workspace models.Workspace
	err := workspaceCollection.FindOne(ctx, bson.M{"_id": workspaceID}).Decode(&workspace)
	if err != nil {
		return primitive.NilObjectID, err
	}
	return workspace.UserID, nil
}

// HasAccess checks if a user has any access to the workspace
func (s *MemberService) HasAccess(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role != ""
}

// CanManageMembers checks if a user can invite/remove members (Owner or Admin)
func (s *MemberService) CanManageMembers(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role.HasAtLeastRole(models.RoleAdmin)
}

// CanCreate checks if a user can create diagrams/folders (Owner, Admin, or Editor)
func (s *MemberService) CanCreate(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role.HasAtLeastRole(models.RoleEditor)
}

// CanDeleteContent checks if a user can delete diagrams/folders (Owner or Admin)
func (s *MemberService) CanDeleteContent(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role.HasAtLeastRole(models.RoleAdmin)
}

// CanEdit checks if a user can edit diagrams (Owner, Admin, or Editor)
func (s *MemberService) CanEdit(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role.HasAtLeastRole(models.RoleEditor)
}

// CanView checks if a user can view diagrams (any role)
func (s *MemberService) CanView(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	return s.HasAccess(ctx, workspaceID, userID)
}

// CanDelete checks if a user can delete the workspace (Owner only)
func (s *MemberService) CanDelete(ctx context.Context, workspaceID, userID primitive.ObjectID) bool {
	role := s.GetUserRole(ctx, workspaceID, userID)
	return role == models.RoleOwner
}

// DeleteAllMembers removes all members from a workspace (used when deleting workspace)
func (s *MemberService) DeleteAllMembers(ctx context.Context, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.DeleteMany(ctx, bson.M{"workspace_id": workspaceID})
	return err
}

// GetUserByEmail retrieves a user by their email
func (s *MemberService) GetUserByEmail(ctx context.Context, email string) (*authModels.User, error) {
	collection := database.GetCollection("users")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var user authModels.User
	err := collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil // User not found is not an error
		}
		return nil, err
	}

	return &user, nil
}

// EnsureIndexes creates necessary indexes for the workspace_members collection
func (s *MemberService) EnsureIndexes(ctx context.Context) error {
	collection := database.GetCollection("workspace_members")
	if collection == nil {
		return errors.New("database not connected")
	}

	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "workspace_id", Value: 1}, {Key: "user_id", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "user_id", Value: 1}},
		},
	}

	_, err := collection.Indexes().CreateMany(ctx, indexes)
	return err
}
