package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/flowstry/flowstry-backend/config"
	"github.com/flowstry/flowstry-backend/database"
	"github.com/flowstry/flowstry-backend/middleware"
	"github.com/flowstry/flowstry-backend/modules/auth"
	authServices "github.com/flowstry/flowstry-backend/modules/auth/services"
	"github.com/flowstry/flowstry-backend/modules/workspace"
	workspaceServices "github.com/flowstry/flowstry-backend/modules/workspace/services"
	"github.com/flowstry/flowstry-backend/storage"
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

	// Connect to MongoDB
	if err := database.Connect(cfg.MongoDBURI, cfg.MongoDBDatabase); err != nil {
		log.Printf("Warning: Failed to connect to MongoDB: %v", err)
		log.Println("Server will start but database operations will fail")
	}

	// Initialize GCS client (optional - may not be configured in development)
	var gcsClient *storage.GCSClient
	if cfg.GCSBucketName != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		client, err := storage.NewGCSClient(ctx, cfg.GCSBucketName)
		cancel()
		if err != nil {
			log.Printf("Warning: Failed to create GCS client: %v", err)
			log.Println("File storage operations will fail")
		} else {
			gcsClient = client
			log.Printf("Connected to GCS bucket: %s", cfg.GCSBucketName)
		}
	} else {
		log.Println("GCS not configured - file storage disabled")
	}

	// Initialize services
	authService := authServices.NewAuthService(cfg)
	googleService := authServices.NewGoogleService(cfg)
	liveCollabService := workspaceServices.NewLiveCollabService(
		cfg.LiveCollabURL,
		cfg.LiveCollabWSURL,
		cfg.LiveCollabJWTSecret,
		cfg.LiveCollabTokenIssuer,
		cfg.LiveCollabTokenAudience,
	)

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:   "Flowstry Backend",
		BodyLimit: 50 * 1024 * 1024, // 50MB max body size for file uploads
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true, // Required for cookies to work cross-origin
	}))

	// Global rate limiter
	app.Use(middleware.NewGlobalLimiter(cfg.RateLimitGlobal))

	// Health check routes
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "flowstry-backend",
		})
	})
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":   "ok",
			"database": database.IsConnected(),
		})
	})

	// Setup module routes
	auth.SetupRoutes(app, authService, googleService)
	workspace.SetupRoutes(app, authService, gcsClient, liveCollabService)

	// Graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("Gracefully shutting down...")
		if gcsClient != nil {
			_ = gcsClient.Close()
		}
		database.Disconnect()
		_ = app.Shutdown()
	}()

	// Start server
	log.Printf("Starting Flowstry Backend on port %s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
