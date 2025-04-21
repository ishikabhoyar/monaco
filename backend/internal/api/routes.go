package api

import (
	"net/http"

	"github.com/arnab-afk/monaco/internal/api/handlers"
)

// SetupRoutes configures all API routes
func SetupRoutes() http.Handler {
	// Create a new handler
	h := handlers.NewHandler()

	// Create a new router
	mux := http.NewServeMux()

	// Apply middleware to all routes
	var handler http.Handler = mux
	handler = handlers.RecoveryMiddleware(handler)
	handler = handlers.LoggingMiddleware(handler)
	handler = handlers.CORSMiddleware(handler)

	// Register routes
	mux.HandleFunc("/submit", h.SubmitHandler)
	mux.HandleFunc("/status", h.StatusHandler)
	mux.HandleFunc("/result", h.ResultHandler)
	mux.HandleFunc("/queue-stats", h.QueueStatsHandler)
	mux.HandleFunc("/health", h.HealthCheckHandler)

	return handler
}
