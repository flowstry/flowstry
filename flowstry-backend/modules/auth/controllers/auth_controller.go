package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/flowstry/flowstry-backend/modules/auth/models"
	"github.com/flowstry/flowstry-backend/modules/auth/services"
	"github.com/flowstry/flowstry-backend/utils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AuthController handles authentication endpoints
type AuthController struct {
	authService   *services.AuthService
	googleService *services.GoogleService
}

// NewAuthController creates a new auth controller
func NewAuthController(authService *services.AuthService, googleService *services.GoogleService) *AuthController {
	return &AuthController{
		authService:   authService,
		googleService: googleService,
	}
}

// setAuthCookies sets httpOnly cookies for access and refresh tokens
func (ac *AuthController) setAuthCookies(c *fiber.Ctx, accessToken, refreshToken string) {
	// Access token cookie - short lived (15 minutes)
	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		MaxAge:   15 * 60, // 15 minutes
		HTTPOnly: true,
		Secure:   true,
		SameSite: "None", // Required for cross-origin cookies
		Path:     "/",
	})

	// Refresh token cookie - longer lived (7 days)
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		MaxAge:   7 * 24 * 60 * 60, // 7 days
		HTTPOnly: true,
		Secure:   true,
		SameSite: "None", // Required for cross-origin cookies
		Path:     "/",
	})
}

// clearAuthCookies clears the auth cookies
func (ac *AuthController) clearAuthCookies(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "None",
		Path:     "/",
	})
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "None",
		Path:     "/",
	})
}

// SignUp handles user registration
func (ac *AuthController) SignUp(c *fiber.Ctx) error {
	var req models.SignUpRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	// Validate email
	if !utils.ValidateEmail(req.Email) {
		return utils.BadRequest(c, "Invalid email format")
	}
	req.Email = utils.NormalizeEmail(req.Email)

	// Validate password
	if valid, msg := utils.ValidatePassword(req.Password); !valid {
		return utils.BadRequest(c, msg)
	}

	// Validate name
	if valid, msg := utils.ValidateName(req.Name); !valid {
		return utils.BadRequest(c, msg)
	}

	// Hash password
	hashedPassword, err := services.HashPassword(req.Password)
	if err != nil {
		return utils.InternalError(c, "Failed to process password")
	}

	// Create user
	user := &models.User{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		Name:         req.Name,
		AuthProvider: models.AuthProviderEmail,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := ac.authService.CreateUser(ctx, user); err != nil {
		if err == services.ErrEmailExists {
			return utils.BadRequest(c, "Email already registered")
		}
		return utils.InternalError(c, "Failed to create user")
	}

	// Generate tokens
	accessToken, err := ac.authService.GenerateAccessToken(user.ID.Hex(), user.Email)
	if err != nil {
		return utils.InternalError(c, "Failed to generate access token")
	}

	refreshToken, err := ac.authService.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return utils.InternalError(c, "Failed to generate refresh token")
	}

	// Set httpOnly cookies
	ac.setAuthCookies(c, accessToken, refreshToken)

	return utils.CreatedResponse(c, fiber.Map{
		"user": user.ToResponse(),
	})
}

// SignIn handles user login
func (ac *AuthController) SignIn(c *fiber.Ctx) error {
	var req models.SignInRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	// Validate and normalize email
	if !utils.ValidateEmail(req.Email) {
		return utils.BadRequest(c, "Invalid email format")
	}
	req.Email = utils.NormalizeEmail(req.Email)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find user
	user, err := ac.authService.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return utils.Unauthorized(c, "Invalid credentials")
	}

	// Verify password (only for email auth)
	if user.AuthProvider == models.AuthProviderEmail {
		if !services.VerifyPassword(user.PasswordHash, req.Password) {
			return utils.Unauthorized(c, "Invalid credentials")
		}
	} else {
		return utils.BadRequest(c, "Please use Google sign-in for this account")
	}

	// Generate tokens
	accessToken, err := ac.authService.GenerateAccessToken(user.ID.Hex(), user.Email)
	if err != nil {
		return utils.InternalError(c, "Failed to generate access token")
	}

	refreshToken, err := ac.authService.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return utils.InternalError(c, "Failed to generate refresh token")
	}

	// Set httpOnly cookies
	ac.setAuthCookies(c, accessToken, refreshToken)

	return utils.SuccessResponse(c, fiber.Map{
		"user": user.ToResponse(),
	})
}

// Refresh handles token refresh
func (ac *AuthController) Refresh(c *fiber.Ctx) error {
	// Get refresh token from cookie first, fall back to body
	refreshTokenValue := c.Cookies("refresh_token")
	
	// If not in cookie, try body for API compatibility
	if refreshTokenValue == "" {
		var req models.RefreshRequest
		if err := c.BodyParser(&req); err == nil {
			refreshTokenValue = req.RefreshToken
		}
	}

	if refreshTokenValue == "" {
		return utils.BadRequest(c, "Refresh token is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Validate refresh token
	userID, err := ac.authService.ValidateRefreshToken(ctx, refreshTokenValue)
	if err != nil {
		return utils.Unauthorized(c, "Invalid or expired refresh token")
	}

	// Get user
	user, err := ac.authService.GetUserByID(ctx, userID)
	if err != nil {
		return utils.Unauthorized(c, "User not found")
	}

	// Revoke old refresh token
	_ = ac.authService.RevokeRefreshToken(ctx, refreshTokenValue)

	// Generate new tokens
	accessToken, err := ac.authService.GenerateAccessToken(user.ID.Hex(), user.Email)
	if err != nil {
		return utils.InternalError(c, "Failed to generate access token")
	}

	newRefreshToken, err := ac.authService.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return utils.InternalError(c, "Failed to generate refresh token")
	}

	// Set httpOnly cookies
	ac.setAuthCookies(c, accessToken, newRefreshToken)

	return utils.SuccessMessageResponse(c, "Token refreshed successfully")
}

// Logout handles user logout
func (ac *AuthController) Logout(c *fiber.Ctx) error {
	// Get refresh token from cookie first, fall back to body
	refreshTokenValue := c.Cookies("refresh_token")
	
	// If not in cookie, try body for API compatibility
	if refreshTokenValue == "" {
		var req models.RefreshRequest
		if err := c.BodyParser(&req); err == nil {
			refreshTokenValue = req.RefreshToken
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Revoke refresh token if present
	if refreshTokenValue != "" {
		_ = ac.authService.RevokeRefreshToken(ctx, refreshTokenValue)
	}

	// Clear auth cookies
	ac.clearAuthCookies(c)

	return utils.SuccessMessageResponse(c, "Logged out successfully")
}

// GoogleAuth initiates Google OAuth flow
func (ac *AuthController) GoogleAuth(c *fiber.Ctx) error {
	// Get frontend redirect URL from query parameter
	frontendRedirect := c.Query("redirect_url", "")
	if frontendRedirect == "" {
		return utils.BadRequest(c, "redirect_url query parameter is required")
	}

	// Generate state parameter for CSRF protection
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return utils.InternalError(c, "Failed to generate state")
	}
	state := hex.EncodeToString(stateBytes)

	// Store state in cookie for verification
	c.Cookie(&fiber.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300, // 5 minutes
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Lax",
	})

	// Store frontend redirect URL in cookie
	c.Cookie(&fiber.Cookie{
		Name:     "oauth_redirect",
		Value:    frontendRedirect,
		MaxAge:   300, // 5 minutes
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Lax",
	})

	url := ac.googleService.GetAuthURL(state)
	return c.Redirect(url)
}

// GoogleCallback handles Google OAuth callback
func (ac *AuthController) GoogleCallback(c *fiber.Ctx) error {
	// Verify state
	state := c.Query("state")
	storedState := c.Cookies("oauth_state")
	if state == "" || state != storedState {
		return utils.BadRequest(c, "Invalid state parameter")
	}

	// Get frontend redirect URL from cookie
	frontendRedirect := c.Cookies("oauth_redirect")
	if frontendRedirect == "" {
		return utils.BadRequest(c, "Missing redirect URL")
	}

	// Clear cookies
	c.Cookie(&fiber.Cookie{
		Name:   "oauth_state",
		Value:  "",
		MaxAge: -1,
	})
	c.Cookie(&fiber.Cookie{
		Name:   "oauth_redirect",
		Value:  "",
		MaxAge: -1,
	})

	// Get authorization code
	code := c.Query("code")
	if code == "" {
		// Redirect to frontend with error
		return c.Redirect(frontendRedirect + "?error=authorization_code_missing")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Exchange code for user info
	googleUser, err := ac.googleService.ExchangeCodeForUser(ctx, code)
	if err != nil {
		return c.Redirect(frontendRedirect + "?error=google_auth_failed")
	}

	// Get or create user
	user, err := ac.authService.GetOrCreateGoogleUser(
		ctx,
		googleUser.ID,
		googleUser.Email,
		googleUser.Name,
		googleUser.Picture,
	)
	if err != nil {
		return c.Redirect(frontendRedirect + "?error=user_creation_failed")
	}

	// Generate our own tokens (not using Google's)
	accessToken, err := ac.authService.GenerateAccessToken(user.ID.Hex(), user.Email)
	if err != nil {
		return c.Redirect(frontendRedirect + "?error=token_generation_failed")
	}

	refreshToken, err := ac.authService.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return c.Redirect(frontendRedirect + "?error=token_generation_failed")
	}

	// Set httpOnly cookies for tokens
	ac.setAuthCookies(c, accessToken, refreshToken)

	// Redirect to frontend - tokens are in cookies, not URL
	return c.Redirect(frontendRedirect + "?auth=success")
}

// Me returns the current user's info
func (ac *AuthController) Me(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("userID").(string)
	if !ok || userIDStr == "" {
		return utils.Unauthorized(c, "User not authenticated")
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return utils.Unauthorized(c, "Invalid user ID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	user, err := ac.authService.GetUserByID(ctx, userID)
	if err != nil {
		return utils.NotFound(c, "User not found")
	}

	return utils.SuccessResponse(c, user.ToResponse())
}

// UpdatePreferences updates the user's preferences
func (ac *AuthController) UpdatePreferences(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("userID").(string)
	if !ok || userIDStr == "" {
		return utils.Unauthorized(c, "User not authenticated")
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return utils.Unauthorized(c, "Invalid user ID")
	}

	var prefs models.UserPreferences
	if err := c.BodyParser(&prefs); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := ac.authService.UpdateUserPreferences(ctx, userID, prefs); err != nil {
		return utils.InternalError(c, "Failed to update preferences")
	}

	return utils.SuccessMessageResponse(c, "Preferences updated successfully")
}
