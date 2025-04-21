package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/internal/executor"
	"github.com/arnab-afk/monaco/internal/models"
)

// Handler manages HTTP requests for code submissions
type Handler struct {
	executionService *executor.ExecutionService
	mu               sync.Mutex
	submissions      map[string]*models.CodeSubmission
}

// NewHandler creates a new handler instance
func NewHandler() *Handler {
	return &Handler{
		executionService: executor.NewExecutionService(),
		submissions:      make(map[string]*models.CodeSubmission),
	}
}

// SubmitHandler handles code submission requests
func (h *Handler) SubmitHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the request body
	var submission models.CodeSubmission
	if err := json.NewDecoder(r.Body).Decode(&submission); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the submission
	if submission.Code == "" {
		http.Error(w, "Code is required", http.StatusBadRequest)
		return
	}
	if submission.Language == "" {
		http.Error(w, "Language is required", http.StatusBadRequest)
		return
	}

	// Generate a unique ID for the submission
	h.mu.Lock()
	submission.ID = executor.GenerateUUID()
	submission.Status = "pending"
	h.submissions[submission.ID] = &submission
	h.mu.Unlock()

	// Execute the code in a goroutine
	go h.executionService.ExecuteCode(&submission)

	// Return the submission ID
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"id": submission.ID})
}

// StatusHandler handles status check requests
func (h *Handler) StatusHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get the submission ID from the query parameters
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	// Get the submission from the map
	h.mu.Lock()
	submission, exists := h.submissions[id]
	h.mu.Unlock()

	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Return the submission status
	response := map[string]interface{}{
		"id":     submission.ID,
		"status": submission.Status,
	}

	// Add time information based on status
	if !submission.QueuedAt.IsZero() {
		response["queuedAt"] = submission.QueuedAt.Format(time.RFC3339)
	}
	if !submission.StartedAt.IsZero() {
		response["startedAt"] = submission.StartedAt.Format(time.RFC3339)
	}
	if !submission.CompletedAt.IsZero() {
		response["completedAt"] = submission.CompletedAt.Format(time.RFC3339)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ResultHandler handles result requests
func (h *Handler) ResultHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get the submission ID from the query parameters
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	// Get the submission from the map
	h.mu.Lock()
	submission, exists := h.submissions[id]
	h.mu.Unlock()

	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Return the submission result
	response := map[string]interface{}{
		"id":       submission.ID,
		"status":   submission.Status,
		"language": submission.Language,
		"output":   submission.Output,
		"input":    submission.Input,
	}

	// Add error information if available
	if submission.Error != "" {
		response["error"] = submission.Error
	}

	// Add time information
	if !submission.QueuedAt.IsZero() {
		response["queuedAt"] = submission.QueuedAt.Format(time.RFC3339)
	}
	if !submission.StartedAt.IsZero() {
		response["startedAt"] = submission.StartedAt.Format(time.RFC3339)
	}
	if !submission.CompletedAt.IsZero() {
		response["completedAt"] = submission.CompletedAt.Format(time.RFC3339)
		if !submission.StartedAt.IsZero() {
			response["executionTime"] = submission.CompletedAt.Sub(submission.StartedAt).Milliseconds()
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// QueueStatsHandler provides information about the job queue
func (h *Handler) QueueStatsHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get the queue statistics
	stats := h.executionService.GetQueueStats()

	// Return the queue statistics
	response := map[string]interface{}{
		"queue_stats": stats,
		"submissions": len(h.submissions),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// SubmitInputHandler handles interactive input submission
func (h *Handler) SubmitInputHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the request body
	var inputRequest struct {
		ID    string `json:"id"`
		Input string `json:"input"`
	}

	if err := json.NewDecoder(r.Body).Decode(&inputRequest); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the request
	if inputRequest.ID == "" {
		http.Error(w, "ID is required", http.StatusBadRequest)
		return
	}

	// Get the submission from the map
	h.mu.Lock()
	submission, exists := h.submissions[inputRequest.ID]
	h.mu.Unlock()

	if !exists {
		http.Error(w, "Submission not found", http.StatusNotFound)
		return
	}

	// Check if the submission is waiting for input
	if submission.Status != "waiting_for_input" {
		http.Error(w, "Submission is not waiting for input", http.StatusBadRequest)
		return
	}

	// Send the input to the execution service
	h.executionService.SubmitInput(submission, inputRequest.Input)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "input_submitted"})
}

// HealthCheckHandler handles health check requests
func (h *Handler) HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return a simple health check response
	response := map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
