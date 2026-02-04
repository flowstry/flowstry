package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	WaitlistLimit int // requests per minute for waitlist
	FeedbackLimit int // requests per minute for feedback
	GlobalLimit   int // global requests per minute
}

// DefaultRateLimitConfig returns sensible defaults
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		WaitlistLimit: 5,
		FeedbackLimit: 10,
		GlobalLimit:   20,
	}
}

// NewGlobalLimiter creates a global rate limiter middleware
func NewGlobalLimiter(maxRequests int) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        maxRequests,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":       "Too many requests",
				"retry_after": "60 seconds",
			})
		},
		SkipFailedRequests:     false,
		SkipSuccessfulRequests: false,
	})
}

// NewEndpointLimiter creates a rate limiter for specific endpoints
func NewEndpointLimiter(maxRequests int, keyPrefix string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        maxRequests,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			// Unique key per IP + endpoint type
			return keyPrefix + ":" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":       "Too many requests to this endpoint",
				"retry_after": "60 seconds",
			})
		},
	})
}
