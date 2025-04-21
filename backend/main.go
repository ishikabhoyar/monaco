package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/arnab-afk/monaco/handler"
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

	// Register handlers with logging and CORS middleware
	http.HandleFunc("/submit", corsMiddleware(loggingMiddleware(h.SubmitHandler)))
	http.HandleFunc("/status", corsMiddleware(loggingMiddleware(h.StatusHandler)))
	http.HandleFunc("/result", corsMiddleware(loggingMiddleware(h.ResultHandler)))
	http.HandleFunc("/queue-stats", corsMiddleware(loggingMiddleware(h.QueueStatsHandler)))
	http.HandleFunc("/ws", corsMiddleware(h.WebSocketHandler)) // WebSocket doesn't need logging middleware

	port := ":8080"
	log.Printf("Server started at %s", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
