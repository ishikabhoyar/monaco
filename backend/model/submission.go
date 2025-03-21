package model

// CodeSubmission represents a code submission for execution
type CodeSubmission struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Language string `json:"language"` // Added language field
	Status   string `json:"status"`
	Output   string `json:"output"`
}
