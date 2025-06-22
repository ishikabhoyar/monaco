package models

import (
	"time"
)

// CodeSubmission represents a code submission for execution
type CodeSubmission struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Language    string    `json:"language"`
	Input       string    `json:"input,omitempty"`
	Status      string    `json:"status"` // "queued", "running", "completed", "failed"
	QueuedAt    time.Time `json:"queuedAt"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Output      string    `json:"output"`
	Memory      string    `json:"memory,omitempty"`     // Memory usage statistics
	CPU         string    `json:"cpu,omitempty"`        // CPU usage statistics
	ExecutionTime float64 `json:"executionTime,omitempty"` // Execution time in seconds
}

// SubmissionResponse is the response returned after submitting code
type SubmissionResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
