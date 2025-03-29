package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/arnab-afk/monaco/handler"
	"github.com/gorilla/websocket"
)

func main() {
	// Configure logging with timestamps and file locations
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.SetOutput(os.Stdout)

	log.Println("Starting Monaco code execution backend...")

	h := handler.NewHandler()

	// Create a middleware for request logging
	loggingMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			startTime := time.Now()
			log.Printf("[HTTP] %s %s %s", r.Method, r.URL.Path, r.RemoteAddr)
			next(w, r)
			log.Printf("[HTTP] %s %s completed in %v", r.Method, r.URL.Path, time.Since(startTime))
		}
	}

	// Create a middleware for CORS - allow all origins
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Set CORS headers to allow any origin
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			w.Header().Set("Access-Control-Max-Age", "3600")

			// Handle preflight OPTIONS requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	// Configure WebSocket upgrader
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		// Allow connections from any origin
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	// WebSocket handler for terminal connection
	http.HandleFunc("/ws/terminal", func(w http.ResponseWriter, r *http.Request) {
		// Get execution ID from query parameters
		executionID := r.URL.Query().Get("id")
		if executionID == "" {
			log.Println("[WS] Missing execution ID")
			http.Error(w, "Missing execution ID", http.StatusBadRequest)
			return
		}

		// Upgrade HTTP connection to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Failed to upgrade connection: %v", err)
			return
		}

		log.Printf("[WS] Terminal connection established for execution ID: %s", executionID)

		// Connect this WebSocket to the execution service for real-time streaming
		h.ConnectTerminal(conn, executionID)
	})

	// Register REST API handlers with logging and CORS middleware
	http.HandleFunc("/submit", corsMiddleware(loggingMiddleware(h.SubmitHandler)))
	http.HandleFunc("/status", corsMiddleware(loggingMiddleware(h.StatusHandler)))
	http.HandleFunc("/result", corsMiddleware(loggingMiddleware(h.ResultHandler)))
	http.HandleFunc("/queue-stats", corsMiddleware(loggingMiddleware(h.QueueStatsHandler)))

	port := ":8080"
	log.Printf("Server started at %s", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
