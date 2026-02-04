package utils

import "github.com/gofiber/fiber/v2"

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// SuccessResponse sends a success response
func SuccessResponse(c *fiber.Ctx, data interface{}) error {
	return c.JSON(Response{
		Success: true,
		Data:    data,
	})
}

// SuccessMessageResponse sends a success response with a message
func SuccessMessageResponse(c *fiber.Ctx, message string) error {
	return c.JSON(Response{
		Success: true,
		Message: message,
	})
}

// CreatedResponse sends a 201 created response
func CreatedResponse(c *fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(Response{
		Success: true,
		Data:    data,
	})
}

// ErrorResponse sends an error response
func ErrorResponse(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(Response{
		Success: false,
		Error:   message,
	})
}

// BadRequest sends a 400 bad request response
func BadRequest(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusBadRequest, message)
}

// Unauthorized sends a 401 unauthorized response
func Unauthorized(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusUnauthorized, message)
}

// Forbidden sends a 403 forbidden response
func Forbidden(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusForbidden, message)
}

// NotFound sends a 404 not found response
func NotFound(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusNotFound, message)
}

// Conflict sends a 409 conflict response
func Conflict(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusConflict, message)
}

// InternalError sends a 500 internal server error response
func InternalError(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusInternalServerError, message)
}

// ServiceUnavailable sends a 503 service unavailable response
func ServiceUnavailable(c *fiber.Ctx, message string) error {
	return ErrorResponse(c, fiber.StatusServiceUnavailable, message)
}
