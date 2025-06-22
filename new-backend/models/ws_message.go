package models

// WebSocketMessage represents a message sent over WebSockets
type WebSocketMessage struct {
	Type    string      `json:"type"` 
	Content interface{} `json:"content"`
}

// OutputMessage is sent when program produces output
type OutputMessage struct {
	Text string `json:"text"`
	IsError bool `json:"isError"`
}

// InputMessage is sent when user provides input
type InputMessage struct {
	Text string `json:"text"`
}

// StatusUpdateMessage is sent when execution status changes
type StatusUpdateMessage struct {
	Status string `json:"status"`
	Memory string `json:"memory,omitempty"`
	CPU    string `json:"cpu,omitempty"`
}

// ErrorMessage is sent when an error occurs
type ErrorMessage struct {
	ErrorType string `json:"errorType"`
	Message   string `json:"message"`
}

// NewOutputMessage creates a standard output message
func NewOutputMessage(content string, isError bool) WebSocketMessage {
	return WebSocketMessage{
		Type: "output",
		Content: OutputMessage{
			Text:    content,
			IsError: isError,
		},
	}
}

// NewInputPromptMessage creates an input prompt message
func NewInputPromptMessage(prompt string) WebSocketMessage {
	return WebSocketMessage{
		Type:    "input_prompt",
		Content: prompt,
	}
}

// NewInputMessage creates a user input message
func NewInputMessage(input string) WebSocketMessage {
	return WebSocketMessage{
		Type: "input",
		Content: InputMessage{
			Text: input,
		},
	}
}

// NewStatusMessage creates a status update message
func NewStatusMessage(status, memory, cpu string) WebSocketMessage {
	return WebSocketMessage{
		Type: "status",
		Content: StatusUpdateMessage{
			Status: status,
			Memory: memory,
			CPU:    cpu,
		},
	}
}

// NewErrorMessage creates an error message
func NewErrorMessage(errorType, message string) WebSocketMessage {
	return WebSocketMessage{
		Type: "error",
		Content: ErrorMessage{
			ErrorType: errorType,
			Message:   message,
		},
	}
}

// NewSystemMessage creates a system notification message
func NewSystemMessage(message string) WebSocketMessage {
	return WebSocketMessage{
		Type:    "system",
		Content: message,
	}
}
