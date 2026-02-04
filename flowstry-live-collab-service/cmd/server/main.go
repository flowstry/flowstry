package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/flowstry/live-collab-service/internal/config"
	"github.com/flowstry/live-collab-service/internal/hub"
	"github.com/flowstry/live-collab-service/internal/server"
	"github.com/flowstry/live-collab-service/internal/session"
)

func main() {
	// Load configuration
	cfg := config.Load()

	log.Printf("Starting Live Collaboration Service on %s", cfg.Server.Address())

	// Initialize session manager
	sessionManager := session.NewManager(
		cfg.Session.MaxUsersPerSession,
		cfg.Session.SessionTTL,
		cfg.Session.CleanupInterval,
	)

	// Initialize hub
	h := hub.NewHub(sessionManager, cfg.Session.PresenceThrottleMs)
	go h.Run()

	// Initialize server
	srv := server.NewServer(cfg, sessionManager, h)

	// Create HTTP server
	httpServer := &http.Server{
		Addr:         cfg.Server.Address(),
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server listening on %s", cfg.Server.Address())
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create context for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Stop accepting new connections and wait for existing to finish
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	// Stop hub
	h.Stop()

	// Stop session manager cleanup
	sessionManager.Stop()

	log.Println("Server stopped")
}
