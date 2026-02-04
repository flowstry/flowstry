package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the live collaboration service
type Config struct {
	// Server settings
	Server ServerConfig

	// WebSocket settings
	WebSocket WebSocketConfig

	// Session settings
	Session SessionConfig

	// CORS settings
	CORS CORSConfig

	// Auth settings
	Auth AuthConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Host string
	Port int
}

// WebSocketConfig holds WebSocket-specific settings
type WebSocketConfig struct {
	ReadBufferSize  int
	WriteBufferSize int
	WriteWait       time.Duration
	PongWait        time.Duration
	PingPeriod      time.Duration
	MaxMessageSize  int64
}

// SessionConfig holds session-related settings
type SessionConfig struct {
	MaxUsersPerSession  int
	SessionTTL          time.Duration
	CleanupInterval     time.Duration
	PresenceThrottleMs  int
}

// CORSConfig holds CORS-related settings
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
}

// AuthConfig holds JWT validation settings
type AuthConfig struct {
	JWTSecret   string
	JWTIssuer   string
	JWTAudience string
}

// Default configuration values
var defaultConfig = Config{
	Server: ServerConfig{
		Host: "",
		Port: 8080,
	},
	WebSocket: WebSocketConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		WriteWait:       10 * time.Second,
		PongWait:        60 * time.Second,
		PingPeriod:      54 * time.Second, // Must be less than PongWait
		MaxMessageSize:  512 * 1024,       // 512KB
	},
	Session: SessionConfig{
		MaxUsersPerSession: 50,
		SessionTTL:         24 * time.Hour,
		CleanupInterval:    5 * time.Minute,
		PresenceThrottleMs: 50,
	},
	CORS: CORSConfig{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	},
	Auth: AuthConfig{
		JWTSecret:   "",
		JWTIssuer:   "flowstry-backend",
		JWTAudience: "live-collab-service",
	},
}

// Load reads configuration from environment variables
// Falls back to defaults for any missing values
func Load() *Config {
	cfg := defaultConfig

	// Server settings (Cloud Run manages PORT)
	if port := os.Getenv("PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			cfg.Server.Port = p
		}
	}

	// WebSocket settings
	if size := os.Getenv("WS_READ_BUFFER_SIZE"); size != "" {
		if s, err := strconv.Atoi(size); err == nil {
			cfg.WebSocket.ReadBufferSize = s
		}
	}
	if size := os.Getenv("WS_WRITE_BUFFER_SIZE"); size != "" {
		if s, err := strconv.Atoi(size); err == nil {
			cfg.WebSocket.WriteBufferSize = s
		}
	}
	if maxSize := os.Getenv("WS_MAX_MESSAGE_SIZE"); maxSize != "" {
		if s, err := strconv.ParseInt(maxSize, 10, 64); err == nil {
			cfg.WebSocket.MaxMessageSize = s
		}
	}

	// Session settings
	if maxUsers := os.Getenv("SESSION_MAX_USERS"); maxUsers != "" {
		if m, err := strconv.Atoi(maxUsers); err == nil {
			cfg.Session.MaxUsersPerSession = m
		}
	}
	if ttl := os.Getenv("SESSION_TTL_HOURS"); ttl != "" {
		if t, err := strconv.Atoi(ttl); err == nil {
			cfg.Session.SessionTTL = time.Duration(t) * time.Hour
		}
	}
	if throttle := os.Getenv("PRESENCE_THROTTLE_MS"); throttle != "" {
		if t, err := strconv.Atoi(throttle); err == nil {
			cfg.Session.PresenceThrottleMs = t
		}
	}

	// CORS settings
	if origins := os.Getenv("CORS_ALLOWED_ORIGINS"); origins != "" {
		cfg.CORS.AllowedOrigins = splitAndTrim(origins)
	}

	// Auth settings
	if secret := os.Getenv("LIVE_COLLAB_JWT_SECRET"); secret != "" {
		cfg.Auth.JWTSecret = secret
	}
	if issuer := os.Getenv("LIVE_COLLAB_TOKEN_ISSUER"); issuer != "" {
		cfg.Auth.JWTIssuer = issuer
	}
	if audience := os.Getenv("LIVE_COLLAB_TOKEN_AUDIENCE"); audience != "" {
		cfg.Auth.JWTAudience = audience
	}

	return &cfg
}

// splitAndTrim splits a comma-separated string and trims whitespace
func splitAndTrim(s string) []string {
	var result []string
	for _, part := range splitString(s, ',') {
		trimmed := trimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// splitString splits a string by a separator
func splitString(s string, sep rune) []string {
	var result []string
	current := ""
	for _, c := range s {
		if c == sep {
			result = append(result, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	result = append(result, current)
	return result
}

// trimSpace removes leading and trailing whitespace
func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

// Address returns the full server address
func (c *ServerConfig) Address() string {
	return c.Host + ":" + strconv.Itoa(c.Port)
}
