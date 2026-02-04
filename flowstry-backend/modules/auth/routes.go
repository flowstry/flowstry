package auth

import (
	"github.com/flowstry/flowstry-backend/middleware"
	"github.com/flowstry/flowstry-backend/modules/auth/controllers"
	"github.com/flowstry/flowstry-backend/modules/auth/services"
	"github.com/gofiber/fiber/v2"
)

// SetupRoutes configures auth routes
func SetupRoutes(app *fiber.App, authService *services.AuthService, googleService *services.GoogleService) {
	controller := controllers.NewAuthController(authService, googleService)

	auth := app.Group("/auth")

	// Public routes
	auth.Post("/signup", controller.SignUp)
	auth.Post("/signin", controller.SignIn)
	auth.Post("/refresh", controller.Refresh)
	auth.Post("/logout", controller.Logout)

	// Google OAuth routes
	auth.Get("/google", controller.GoogleAuth)
	auth.Get("/google/callback", controller.GoogleCallback)

	// Protected routes
	auth.Get("/me", middleware.AuthMiddleware(authService), controller.Me)
	auth.Put("/preferences", middleware.AuthMiddleware(authService), controller.UpdatePreferences)
}
