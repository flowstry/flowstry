package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/flowstry/feedback-service/config"
	"github.com/flowstry/feedback-service/database"
	"github.com/flowstry/feedback-service/handlers"
	"github.com/flowstry/feedback-service/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Connect to MongoDB (non-fatal - allows health checks to work)
	if err := database.Connect(cfg.MongoDBURI, cfg.MongoDBDatabase); err != nil {
		log.Printf("Warning: Failed to connect to MongoDB: %v", err)
		log.Println("Server will start but database operations will fail")
	}

	// Initialize Fiber app with security settings
	app := fiber.New(fiber.Config{
		AppName:   "Flowstry Feedback Service",
		BodyLimit: 4 * 1024, // 4KB max body size
	})

	// Middleware - order matters!
	app.Use(recover.New()) // Catch panics
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: "GET,POST,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept",
	}))

	// Global rate limiter
	app.Use(middleware.NewGlobalLimiter(cfg.RateLimitGlobal))

	// Routes with endpoint-specific rate limiters
	app.Post("/waitlist", middleware.NewEndpointLimiter(cfg.RateLimitWait, "waitlist"), handlers.AddToWaitlist)
	app.Post("/feedback", middleware.NewEndpointLimiter(cfg.RateLimitFeed, "feedback"), handlers.AddFeedback)

	// Health check / root
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "flowstry-feedback-service"})
	})
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("Gracefully shutting down...")
		database.Disconnect()
		_ = app.Shutdown()
	}()

	// Start server
	log.Printf("Starting server on port %s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
