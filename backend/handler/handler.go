package handler

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/arnab-afk/monaco/model"
	"github.com/arnab-afk/monaco/service"
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

	json.NewEncoder(w).Encode(map[string]string{"status": submission.Status})
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

	json.NewEncoder(w).Encode(map[string]string{"output": submission.Output})
}

// generateID creates a unique ID for submissions
func (h *Handler) generateID() string {
	return service.GenerateUUID()
}
