package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// NewGlobalLimiter creates a global rate limiter
func NewGlobalLimiter(max int) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:               max,
		Expiration:        1 * time.Minute,
		LimiterMiddleware: limiter.SlidingWindow{},
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests, please try again later",
			})
		},
	})
}

// NewEndpointLimiter creates an endpoint-specific rate limiter
func NewEndpointLimiter(max int, endpoint string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:               max,
		Expiration:        1 * time.Minute,
		LimiterMiddleware: limiter.SlidingWindow{},
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + "-" + endpoint
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests to this endpoint, please try again later",
			})
		},
	})
}
