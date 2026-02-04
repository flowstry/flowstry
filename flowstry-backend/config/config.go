package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	// Server
	Port           string
	AllowedOrigins string
	FrontendURL    string

	// MongoDB
	MongoDBURI      string
	MongoDBDatabase string

	// JWT
	JWTSecret          string
	AccessTokenExpiry  time.Duration
	RefreshTokenExpiry time.Duration

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Google Cloud Storage (uses Application Default Credentials)
	GCSBucketName string

	// Rate Limiting
	RateLimitGlobal int
	RateLimitAuth   int

	// Live Collaboration Service
	LiveCollabURL          string
	LiveCollabWSURL        string
	LiveCollabJWTSecret    string
	LiveCollabTokenIssuer  string
	LiveCollabTokenAudience string
}

func Load() *Config {
	return &Config{
		// Server
		Port:           getEnv("PORT", "8080"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
		FrontendURL:    getEnv("FRONTEND_URL", "http://localhost:3000"),

		// MongoDB
		MongoDBURI:      getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDBDatabase: getEnv("MONGODB_DATABASE", "flowstry"),

		// JWT
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
		AccessTokenExpiry:  getDurationEnv("ACCESS_TOKEN_EXPIRY", 15*time.Minute),
		RefreshTokenExpiry: getDurationEnv("REFRESH_TOKEN_EXPIRY", 7*24*time.Hour),

		// Google OAuth
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),

		// Google Cloud Storage (uses ADC on Cloud Run)
		GCSBucketName: getEnv("GCS_BUCKET_NAME", ""),

		// Rate Limiting
		RateLimitGlobal: getEnvInt("RATE_LIMIT_GLOBAL", 100),
		RateLimitAuth:   getEnvInt("RATE_LIMIT_AUTH", 20),

		// Live Collaboration Service
		LiveCollabURL:           getEnv("LIVE_COLLAB_URL", "http://localhost:8081"),
		LiveCollabWSURL:         getEnv("LIVE_COLLAB_WS_URL", ""),
		LiveCollabJWTSecret:     getEnv("LIVE_COLLAB_JWT_SECRET", ""),
		LiveCollabTokenIssuer:   getEnv("LIVE_COLLAB_TOKEN_ISSUER", "flowstry-backend"),
		LiveCollabTokenAudience: getEnv("LIVE_COLLAB_TOKEN_AUDIENCE", "live-collab-service"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
