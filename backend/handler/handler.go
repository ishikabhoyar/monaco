package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/model"
	"github.com/arnab-afk/monaco/service"
	"github.com/gorilla/websocket"
)

// Handler manages HTTP requests for code submissions
type Handler struct {
	executionService *service.ExecutionService
	mu               sync.Mutex
	submissions      map[string]*model.CodeSubmission
}

// NewHandler creates a new handler instance
func NewHandler() *Handler {
	return &Handler{
		executionService: service.NewExecutionService(),
		submissions:      make(map[string]*model.CodeSubmission),
	}
}

// SubmitHandler handles code submission requests
func (h *Handler) SubmitHandler(w http.ResponseWriter, r *http.Request) {
	var submission model.CodeSubmission
	if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Set default language if not provided
	if submission.Language == "" {
		submission.Language = "python" // Default to Python
	}

	// Validate language
	supportedLanguages := map[string]bool{
		"python": true,
		"java":   true,
		"c":      true,
		"cpp":    true,
	}

	if !supportedLanguages[submission.Language] {
		http.Error(w, "Unsupported language: "+submission.Language, http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	submission.ID = h.generateID()
	submission.Status = "pending"
	h.submissions[submission.ID] = &submission
	h.mu.Unlock()

	go h.executionService.ExecuteCode(&submission)

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"id": submission.ID})
}

// StatusHandler handles status check requests
func (h *Handler) StatusHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	submission, exists := h.submissions[id]
	h.mu.Unlock()

	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Return status with time information
	response := map[string]interface{}{
		"id":     submission.ID,
		"status": submission.Status,
	}

	// Add time information based on status
	if !submission.QueuedAt.IsZero() {
		response["queuedAt"] = submission.QueuedAt.Format(time.RFC3339)
	}

	if submission.Status == "running" && !submission.StartedAt.IsZero() {
		response["startedAt"] = submission.StartedAt.Format(time.RFC3339)
		response["runningFor"] = time.Since(submission.StartedAt).String()
	}

	if submission.Status == "completed" || submission.Status == "failed" {
		if !submission.CompletedAt.IsZero() && !submission.StartedAt.IsZero() {
			response["executionTime"] = submission.CompletedAt.Sub(submission.StartedAt).Milliseconds()
			response["completedAt"] = submission.CompletedAt.Format(time.RFC3339)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to serialize response: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

// ResultHandler handles result requests
func (h *Handler) ResultHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	h.mu.Lock()
	submission, exists := h.submissions[id]
	h.mu.Unlock()

	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Prepare response with safe time handling
	response := map[string]interface{}{
		"id":       submission.ID,
		"status":   submission.Status,
		"output":   submission.Output,
		"language": submission.Language,
	}

	// Only include time fields if they're set
	if !submission.QueuedAt.IsZero() {
		response["queuedAt"] = submission.QueuedAt.Format(time.RFC3339)
	}

	if !submission.StartedAt.IsZero() {
		response["startedAt"] = submission.StartedAt.Format(time.RFC3339)
	}

	if !submission.CompletedAt.IsZero() {
		response["completedAt"] = submission.CompletedAt.Format(time.RFC3339)

		// Calculate times only if we have valid timestamps
		if !submission.StartedAt.IsZero() {
			executionTime := submission.CompletedAt.Sub(submission.StartedAt)
			response["executionTime"] = executionTime.Milliseconds() // Use milliseconds for frontend
			response["executionTimeFormatted"] = executionTime.String()
		}

		if !submission.QueuedAt.IsZero() {
			totalTime := submission.CompletedAt.Sub(submission.QueuedAt)
			response["totalTime"] = totalTime.Milliseconds() // Use milliseconds for frontend
			response["totalTimeFormatted"] = totalTime.String()
		}
	}

	// Return full submission details
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to serialize response: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

// QueueStatsHandler provides information about the job queue
func (h *Handler) QueueStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats := h.executionService.GetQueueStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"queue_stats": stats,
		"submissions": len(h.submissions),
	})
}

// ConnectTerminal connects a WebSocket to a running execution
func (h *Handler) ConnectTerminal(conn *websocket.Conn, executionID string) {
	// Get submission from storage
	h.mu.Lock()
	submission, found := h.submissions[executionID]
	status := "not found"
	if found {
		status = submission.Status
	}
	h.mu.Unlock()

	log.Printf("[WS-%s] Terminal connection request, submission status: %s", executionID, status)

	if !found {
		log.Printf("[WS-%s] Execution not found", executionID)
		conn.WriteMessage(websocket.TextMessage, []byte("Execution not found"))
		conn.Close()
		return
	}

	// If execution is already completed, send stored output and close
	if submission.Status == "completed" || submission.Status == "failed" {
		log.Printf("[WS-%s] Execution already %s, sending stored output (length: %d)",
			executionID, submission.Status, len(submission.Output))
		conn.WriteMessage(websocket.TextMessage, []byte(submission.Output))
		conn.Close()
		return
	}

	log.Printf("[WS-%s] Registering connection for real-time updates, current status: %s",
		executionID, submission.Status)

	// Register this connection with the execution service for real-time updates
	h.executionService.RegisterTerminalConnection(executionID, conn)

	// Send initial connection confirmation
	initialMsg := fmt.Sprintf("[System] Connected to process (ID: %s, Status: %s)\n",
		executionID, submission.Status)
	conn.WriteMessage(websocket.TextMessage, []byte(initialMsg))

	// Handle incoming messages from the terminal (for stdin)
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("[WS-%s] Read error: %v", executionID, err)
				h.executionService.UnregisterTerminalConnection(executionID, conn)
				break
			}

			log.Printf("[WS-%s] Received input from client: %s", executionID, string(message))
			// Send input to the execution if it's waiting for input
			h.executionService.SendInput(executionID, string(message))
		}
	}()
}

// generateID creates a unique ID for submissions
func (h *Handler) generateID() string {
	return service.GenerateUUID()
}
