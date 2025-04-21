package models

import "time"

// CodeSubmission represents a code submission for execution
type CodeSubmission struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Language    string    `json:"language"`
	Input       string    `json:"input"`
	Status      string    `json:"status"` // "pending", "queued", "running", "completed", "failed"
	QueuedAt    time.Time `json:"queuedAt,omitempty"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Output      string    `json:"output,omitempty"`
	Error       string    `json:"error,omitempty"`
}

// ExecutionResult represents the result of code execution
type ExecutionResult struct {
	Output      string `json:"output"`
	Error       string `json:"error"`
	ExitCode    int    `json:"exitCode"`
	ExecutionMS int64  `json:"executionMs"`
}

// QueueStats represents statistics about the job queue
type QueueStats struct {
	QueueLength    int `json:"queueLength"`
	RunningJobs    int `json:"runningJobs"`
	CompletedJobs  int `json:"completedJobs"`
	FailedJobs     int `json:"failedJobs"`
	TotalProcessed int `json:"totalProcessed"`
}
