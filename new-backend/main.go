package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/ishikabhoyar/monaco/new-backend/api"
	"github.com/ishikabhoyar/monaco/new-backend/config"
	"github.com/ishikabhoyar/monaco/new-backend/executor"
	"github.com/ishikabhoyar/monaco/new-backend/utils"
	"github.com/rs/cors"
)

func main() {
	// Configure logging
	log.SetFlags(log.LstdFlags | log.Lshortfile | log.Lmicroseconds)
	log.Println("Starting Monaco Code Execution Server...")

	// Check if Docker is available
	if !utils.DockerAvailable() {
		log.Fatal("Docker is required but not available on this system")
	}

	// Load configuration
	cfg := config.GetConfig()
	log.Printf("Loaded configuration (max workers: %d, queue capacity: %d)",
		cfg.Executor.ConcurrentExecutions, cfg.Executor.QueueCapacity)

	// Initialize code executor
	codeExecutor := executor.NewCodeExecutor(cfg)
	log.Println("Code executor initialized")

	// Initialize API handler
	handler := api.NewHandler(codeExecutor)
	
	// Setup router with middleware
	router := mux.NewRouter()
	
	// Register API routes
	handler.RegisterRoutes(router)
	
	// Add a simple welcome route
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Monaco Code Execution Server v1.0.0")
	})
	
	// Configure CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // For development - restrict in production
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum cache time for preflight requests
	})

	// Create server with timeouts
	server := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      corsHandler.Handler(router),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Channel for graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		log.Printf("Server listening on port %s", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-stop
	log.Println("Shutting down server...")

	// Create context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server gracefully
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped gracefully")
}
