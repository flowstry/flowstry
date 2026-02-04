package config

import (
	"os"
	"strconv"
)

type Config struct {
	MongoDBURI      string
	MongoDBDatabase string
	Port            string
	AllowedOrigins  string
	RateLimitGlobal int
	RateLimitWait   int
	RateLimitFeed   int
}

func Load() *Config {
	return &Config{
		MongoDBURI:      getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDBDatabase: getEnv("MONGODB_DATABASE", "flowstry"),
		Port:            getEnv("PORT", "3000"),
		AllowedOrigins:  getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"),
		RateLimitGlobal: getEnvInt("RATE_LIMIT_GLOBAL", 20),
		RateLimitWait:   getEnvInt("RATE_LIMIT_WAITLIST", 5),
		RateLimitFeed:   getEnvInt("RATE_LIMIT_FEEDBACK", 10),
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
