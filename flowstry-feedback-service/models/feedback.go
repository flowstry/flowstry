package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FeedbackType string

const (
	FeedbackTypeFeedback       FeedbackType = "feedback"
	FeedbackTypeIssue          FeedbackType = "issue"
	FeedbackTypeBugReport      FeedbackType = "bugreport"
	FeedbackTypeFeatureRequest FeedbackType = "feature_request"
)

func (ft FeedbackType) IsValid() bool {
	switch ft {
	case FeedbackTypeFeedback, FeedbackTypeIssue, FeedbackTypeBugReport, FeedbackTypeFeatureRequest:
		return true
	}
	return false
}

type Feedback struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email     string             `bson:"email" json:"email"`
	Type      FeedbackType       `bson:"type" json:"type"`
	Body      string             `bson:"body" json:"body"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type FeedbackRequest struct {
	Email string       `json:"email"`
	Type  FeedbackType `json:"type"`
	Body  string       `json:"body"`
}
