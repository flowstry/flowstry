package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/flowstry/flowstry-backend/database"
	"github.com/flowstry/flowstry-backend/modules/workspace/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	ErrInviteNotFound      = errors.New("invite not found")
	ErrInviteExpired       = errors.New("invite has expired")
	ErrInviteAlreadyExists = errors.New("an invite for this email already exists")
	ErrUserAlreadyMember   = errors.New("user is already a member of this workspace")
	ErrInvalidEmail        = errors.New("invalid email address")
)

// InviteService handles workspace invite operations
type InviteService struct {
	memberService *MemberService
}

// NewInviteService creates a new invite service
func NewInviteService(memberService *MemberService) *InviteService {
	return &InviteService{
		memberService: memberService,
	}
}

// generateToken creates a secure random token for invites
func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateInvite creates a new workspace invite
func (s *InviteService) CreateInvite(ctx context.Context, workspaceID primitive.ObjectID, email string, role models.WorkspaceRole, invitedBy primitive.ObjectID) (*models.WorkspaceInvite, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	// Validate role (cannot invite as owner)
	if role == models.RoleOwner {
		return nil, errors.New("cannot invite as owner")
	}

	if !role.IsValid() {
		return nil, errors.New("invalid role")
	}

	// Check if user is already a member
	user, err := s.memberService.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user != nil {
		existingMember, _ := s.memberService.GetMember(ctx, workspaceID, user.ID)
		if existingMember != nil {
			return nil, ErrUserAlreadyMember
		}
	}

	// Check if invite already exists for this email
	existing, _ := s.GetInviteByEmail(ctx, workspaceID, email)
	if existing != nil {
		return nil, ErrInviteAlreadyExists
	}

	// Generate token
	token, err := generateToken()
	if err != nil {
		return nil, err
	}

	invite := &models.WorkspaceInvite{
		WorkspaceID: workspaceID,
		Email:       email,
		Role:        role,
		Token:       token,
		InvitedBy:   invitedBy,
		ExpiresAt:   time.Now().Add(models.InviteExpiryDuration),
		CreatedAt:   time.Now(),
	}

	result, err := collection.InsertOne(ctx, invite)
	if err != nil {
		return nil, err
	}

	invite.ID = result.InsertedID.(primitive.ObjectID)
	return invite, nil
}

// GetInviteByToken retrieves an invite by its token
func (s *InviteService) GetInviteByToken(ctx context.Context, token string) (*models.WorkspaceInvite, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var invite models.WorkspaceInvite
	err := collection.FindOne(ctx, bson.M{"token": token}).Decode(&invite)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInviteNotFound
		}
		return nil, err
	}

	return &invite, nil
}

// GetInviteByEmail retrieves an invite by workspace and email
func (s *InviteService) GetInviteByEmail(ctx context.Context, workspaceID primitive.ObjectID, email string) (*models.WorkspaceInvite, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var invite models.WorkspaceInvite
	err := collection.FindOne(ctx, bson.M{
		"workspace_id": workspaceID,
		"email":        email,
	}).Decode(&invite)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInviteNotFound
		}
		return nil, err
	}

	return &invite, nil
}

// GetInviteByID retrieves an invite by its ID
func (s *InviteService) GetInviteByID(ctx context.Context, inviteID primitive.ObjectID) (*models.WorkspaceInvite, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	var invite models.WorkspaceInvite
	err := collection.FindOne(ctx, bson.M{"_id": inviteID}).Decode(&invite)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrInviteNotFound
		}
		return nil, err
	}

	return &invite, nil
}

// AcceptInvite accepts an invite and creates a member record
func (s *InviteService) AcceptInvite(ctx context.Context, token string, userID primitive.ObjectID, userEmail string) (*models.WorkspaceMember, error) {
	invite, err := s.GetInviteByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	// Check if expired
	if invite.IsExpired() {
		// Delete expired invite
		s.DeleteInvite(ctx, invite.ID)
		return nil, ErrInviteExpired
	}

	// Verify email matches (case insensitive)
	if invite.Email != userEmail {
		return nil, errors.New("invite is for a different email address")
	}

	// Check if already a member
	existing, _ := s.memberService.GetMember(ctx, invite.WorkspaceID, userID)
	if existing != nil {
		// Delete invite since user is already a member
		s.DeleteInvite(ctx, invite.ID)
		return nil, ErrUserAlreadyMember
	}

	// Create member
	member, err := s.memberService.AddMember(ctx, invite.WorkspaceID, userID, invite.Role)
	if err != nil {
		return nil, err
	}

	// Delete the invite
	s.DeleteInvite(ctx, invite.ID)

	return member, nil
}

// RevokeInvite cancels a pending invite
func (s *InviteService) RevokeInvite(ctx context.Context, inviteID, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return errors.New("database not connected")
	}

	result, err := collection.DeleteOne(ctx, bson.M{
		"_id":          inviteID,
		"workspace_id": workspaceID,
	})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrInviteNotFound
	}

	return nil
}

// DeleteInvite deletes an invite by ID
func (s *InviteService) DeleteInvite(ctx context.Context, inviteID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.DeleteOne(ctx, bson.M{"_id": inviteID})
	return err
}

// ListPendingInvites lists all pending invites for a workspace
func (s *InviteService) ListPendingInvites(ctx context.Context, workspaceID primitive.ObjectID) ([]*models.WorkspaceInviteResponse, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	// Find non-expired invites
	cursor, err := collection.Find(ctx, bson.M{
		"workspace_id": workspaceID,
		"expires_at":   bson.M{"$gt": time.Now()},
	}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var invites []*models.WorkspaceInvite
	if err := cursor.All(ctx, &invites); err != nil {
		return nil, err
	}

	responses := make([]*models.WorkspaceInviteResponse, len(invites))
	for i, inv := range invites {
		responses[i] = inv.ToResponse()
	}

	return responses, nil
}

// GetInviteDetails retrieves invite details with workspace and inviter names
func (s *InviteService) GetInviteDetails(ctx context.Context, token string) (*models.InviteDetailsResponse, error) {
	invite, err := s.GetInviteByToken(ctx, token)
	if err != nil {
		return nil, err
	}

	if invite.IsExpired() {
		return nil, ErrInviteExpired
	}

	// Get workspace name
	workspaceCollection := database.GetCollection("workspaces")
	var workspace struct {
		Name string `bson:"name"`
	}
	err = workspaceCollection.FindOne(ctx, bson.M{"_id": invite.WorkspaceID}).Decode(&workspace)
	if err != nil {
		return nil, err
	}

	// Get inviter name
	usersCollection := database.GetCollection("users")
	var inviter struct {
		Name string `bson:"name"`
	}
	err = usersCollection.FindOne(ctx, bson.M{"_id": invite.InvitedBy}).Decode(&inviter)
	if err != nil {
		return nil, err
	}

	return &models.InviteDetailsResponse{
		ID:            invite.ID,
		WorkspaceName: workspace.Name,
		Role:          invite.Role,
		InviterName:   inviter.Name,
		ExpiresAt:     invite.ExpiresAt,
	}, nil
}

// DeleteAllInvites removes all invites for a workspace (used when deleting workspace)
func (s *InviteService) DeleteAllInvites(ctx context.Context, workspaceID primitive.ObjectID) error {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return errors.New("database not connected")
	}

	_, err := collection.DeleteMany(ctx, bson.M{"workspace_id": workspaceID})
	return err
}

// ListUserInvites lists all pending invites for a user's email
func (s *InviteService) ListUserInvites(ctx context.Context, email string) ([]*models.WorkspaceInviteResponse, error) {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return nil, errors.New("database not connected")
	}

	// Aggregate to join with workspaces collection for workspace name
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{
			"email":      email,
			"expires_at": bson.M{"$gt": time.Now()},
		}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "workspaces",
			"localField":   "workspace_id",
			"foreignField": "_id",
			"as":           "workspace",
		}}},
		{{Key: "$unwind", Value: "$workspace"}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "users",
			"localField":   "invited_by",
			"foreignField": "_id",
			"as":           "inviter",
		}}},
		{{Key: "$unwind", Value: "$inviter"}},
		{{Key: "$project", Value: bson.M{
			"_id":            1,
			"workspace_id":   1,
			"workspace_name": "$workspace.name",
			"email":          1,
			"role":           1,
			"token":          1,
			"invited_by":     1,
			"inviter_name":   "$inviter.name",
			"expires_at":     1,
			"created_at":     1,
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "created_at", Value: -1}}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []struct {
		ID            primitive.ObjectID   `bson:"_id"`
		WorkspaceID   primitive.ObjectID   `bson:"workspace_id"`
		WorkspaceName string               `bson:"workspace_name"`
		Email         string               `bson:"email"`
		Role          models.WorkspaceRole `bson:"role"`
		Token         string               `bson:"token"`
		InvitedBy     primitive.ObjectID   `bson:"invited_by"`
		InviterName   string               `bson:"inviter_name"`
		ExpiresAt     time.Time            `bson:"expires_at"`
		CreatedAt     time.Time            `bson:"created_at"`
	}

	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	responses := make([]*models.WorkspaceInviteResponse, len(results))
	for i, r := range results {
		responses[i] = &models.WorkspaceInviteResponse{
			ID:            r.ID,
			WorkspaceID:   r.WorkspaceID,
			WorkspaceName: r.WorkspaceName,
			Email:         r.Email,
			Role:          r.Role,
			Token:         r.Token,
			InvitedBy:     r.InvitedBy,
			InviterName:   r.InviterName,
			ExpiresAt:     r.ExpiresAt,
			CreatedAt:     r.CreatedAt,
		}
	}

	return responses, nil
}

// EnsureIndexes creates necessary indexes for the workspace_invites collection
func (s *InviteService) EnsureIndexes(ctx context.Context) error {
	collection := database.GetCollection("workspace_invites")
	if collection == nil {
		return errors.New("database not connected")
	}

	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "token", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "workspace_id", Value: 1}, {Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{{Key: "email", Value: 1}},
		},
		{
			// TTL index for auto-expiry
			Keys:    bson.D{{Key: "expires_at", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
	}

	_, err := collection.Indexes().CreateMany(ctx, indexes)
	return err
}
