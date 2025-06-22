package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/ishikabhoyar/monaco/new-backend/executor"
	"github.com/ishikabhoyar/monaco/new-backend/models"
)

// Handler manages all API routes
type Handler struct {
	executor *executor.CodeExecutor
	upgrader websocket.Upgrader
}

// NewHandler creates a new API handler
func NewHandler(executor *executor.CodeExecutor) *Handler {
	return &Handler{
		executor: executor,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
			HandshakeTimeout: 10 * time.Second,
		},
	}
}

// RegisterRoutes sets up all API routes
func (h *Handler) RegisterRoutes(router *mux.Router) {
	// Code execution endpoints
	router.HandleFunc("/api/submit", h.SubmitCodeHandler).Methods("POST")
	router.HandleFunc("/api/status/{id}", h.StatusHandler).Methods("GET")
	router.HandleFunc("/api/result/{id}", h.ResultHandler).Methods("GET")
	
	// WebSocket endpoint for real-time output
	router.HandleFunc("/api/ws/terminal/{id}", h.TerminalWebSocketHandler)
	
	// Language support endpoint
	router.HandleFunc("/api/languages", h.SupportedLanguagesHandler).Methods("GET")
	
	// Health check
	router.HandleFunc("/api/health", h.HealthCheckHandler).Methods("GET")
}

// SubmitCodeHandler handles code submission requests
func (h *Handler) SubmitCodeHandler(w http.ResponseWriter, r *http.Request) {
	// Parse request
	var submission models.CodeSubmission
	if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Validate request
	if submission.Code == "" {
		http.Error(w, "Code cannot be empty", http.StatusBadRequest)
		return
	}

	if submission.Language == "" {
		http.Error(w, "Language must be specified", http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if submission.ID == "" {
		submission.ID = uuid.New().String()
	}

	// Submit code for execution
	id := h.executor.SubmitCode(&submission)

	// Return response
	response := models.SubmissionResponse{
		ID:      id,
		Status:  "queued",
		Message: "Code submission accepted and queued for execution",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// StatusHandler returns the current status of a code execution
func (h *Handler) StatusHandler(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	submission, exists := h.executor.GetSubmission(id)
	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"id":     submission.ID,
		"status": submission.Status,
	})
}

// ResultHandler returns the complete result of a code execution
func (h *Handler) ResultHandler(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	submission, exists := h.executor.GetSubmission(id)
	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(submission)
}

// TerminalWebSocketHandler handles WebSocket connections for real-time output
func (h *Handler) TerminalWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	// Check if submission exists
	if _, exists := h.executor.GetSubmission(id); !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Upgrade connection to WebSocket
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	log.Printf("WebSocket connection established for submission %s", id)

	// Register connection
	h.executor.RegisterTerminalConnection(id, conn)

	// Connection will be handled by the executor
}

// SupportedLanguagesHandler returns a list of supported languages
func (h *Handler) SupportedLanguagesHandler(w http.ResponseWriter, r *http.Request) {
	// This is a placeholder - in a real implementation, you'd get this from the config
	languages := []map[string]string{
		{"id": "python", "name": "Python", "version": "3.9"},
		{"id": "java", "name": "Java", "version": "11"},
		{"id": "c", "name": "C", "version": "GCC 10.2"},
		{"id": "cpp", "name": "C++", "version": "GCC 10.2"},
		{"id": "javascript", "name": "JavaScript", "version": "Node.js 16"},
		{"id": "golang", "name": "Go", "version": "1.19"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(languages)
}

// HealthCheckHandler provides a simple health check endpoint
func (h *Handler) HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}
