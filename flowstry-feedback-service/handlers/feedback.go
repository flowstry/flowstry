package handlers

import (
	"context"
	"strings"
	"time"

	"github.com/flowstry/feedback-service/database"
	"github.com/flowstry/feedback-service/models"
	"github.com/gofiber/fiber/v2"
)

const (
	maxFeedbackEmailLen = 254  // RFC 5321
	maxFeedbackBodyLen  = 5000 // Max feedback length
)

func AddFeedback(c *fiber.Ctx) error {
	var req models.FeedbackRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email is required",
		})
	}

	// Normalize email
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if len(req.Email) > maxFeedbackEmailLen {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email address too long",
		})
	}

	if !emailRegex.MatchString(req.Email) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid email format",
		})
	}

	if req.Type == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Type is required",
		})
	}

	if !req.Type.IsValid() {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid feedback type. Must be one of: feedback, issue, bugreport, feature_request",
		})
	}

	if req.Body == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Body is required",
		})
	}

	if len(req.Body) > maxFeedbackBodyLen {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Feedback body too long (max 5000 characters)",
		})
	}

	collection := database.GetCollection("feedbacks")
	if collection == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Database not connected",
		})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Insert feedback
	feedback := models.Feedback{
		Email:     req.Email,
		Type:      req.Type,
		Body:      req.Body,
		CreatedAt: time.Now(),
	}

	_, err := collection.InsertOne(ctx, feedback)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to submit feedback",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Feedback submitted successfully",
	})
}
