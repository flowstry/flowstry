package handlers

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/flowstry/feedback-service/database"
	"github.com/flowstry/feedback-service/models"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

const maxEmailLength = 254 // RFC 5321

func AddToWaitlist(c *fiber.Ctx) error {
	var req models.WaitlistRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate email
	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email is required",
		})
	}

	// Normalize email to lowercase
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if len(req.Email) > maxEmailLength {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email address too long",
		})
	}

	if !emailRegex.MatchString(req.Email) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid email format",
		})
	}

	collection := database.GetCollection("waitlist")
	if collection == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Database not connected",
		})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if email already exists
	var existing models.WaitlistEntry
	err := collection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing)
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Email already in waitlist",
		})
	}

	// Insert new entry
	entry := models.WaitlistEntry{
		Email:     req.Email,
		CreatedAt: time.Now(),
	}

	_, err = collection.InsertOne(ctx, entry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to add to waitlist",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Successfully added to waitlist",
		"email":   req.Email,
	})
}
