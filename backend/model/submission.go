package model

import "time"

// CodeSubmission represents a code submission for execution
type CodeSubmission struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Language    string    `json:"language"`
	Input       string    `json:"input"`  // Added input field for stdin
	Status      string    `json:"status"` // "queued", "running", "completed", "failed"
	QueuedAt    time.Time `json:"queuedAt"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Output      string    `json:"output"`
}
