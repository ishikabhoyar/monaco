package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/arnab-afk/monaco/model"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development
	CheckOrigin: func(r *http.Request) bool { return true },
}

// WebSocketHandler handles WebSocket connections for code execution
func (h *Handler) WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Read the initial message containing the code submission
	_, message, err := conn.ReadMessage()
	if err != nil {
		log.Printf("Failed to read message: %v", err)
		conn.Close()
		return
	}

	// Parse the message as a code submission
	var submission model.CodeSubmission
	if err := json.Unmarshal(message, &submission); err != nil {
		log.Printf("Failed to parse message: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: Invalid submission format"))
		conn.Close()
		return
	}

	// Validate the submission
	if submission.Code == "" {
		conn.WriteMessage(websocket.TextMessage, []byte("Error: Code is required"))
		conn.Close()
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
		conn.WriteMessage(websocket.TextMessage, []byte("Error: Unsupported language: "+submission.Language))
		conn.Close()
		return
	}

	// Generate a unique ID for the submission
	submission.ID = h.generateID()
	submission.Status = "pending"

	// Store the submission
	h.mu.Lock()
	h.submissions[submission.ID] = &submission
	h.mu.Unlock()

	// Send the submission ID to the client
	conn.WriteMessage(websocket.TextMessage, []byte("Submission ID: "+submission.ID))

	// Execute the code with WebSocket communication
	h.executionService.HandleWebSocket(conn, &submission)
}
