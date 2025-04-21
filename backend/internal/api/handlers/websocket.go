package handlers

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/internal/executor"
	"github.com/arnab-afk/monaco/internal/models"
	"github.com/gorilla/websocket"
)

// WebSocketTerminal represents a terminal session over WebSocket
type WebSocketTerminal struct {
	ID        string
	Conn      *websocket.Conn
	InputChan chan string
	OutputChan chan string
	Done      chan struct{}
	mu        sync.Mutex
}

var (
	// Configure the upgrader
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		// Allow all origins for development
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	// Active terminal sessions
	terminals     = make(map[string]*WebSocketTerminal)
	terminalsMu   sync.Mutex
)

// TerminalHandler handles WebSocket connections for terminal sessions
func (h *Handler) TerminalHandler(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Generate a unique ID for this terminal session
	terminalID := executor.GenerateUUID()
	
	// Create channels for communication
	inputChan := make(chan string)
	outputChan := make(chan string)
	done := make(chan struct{})

	// Create a new terminal session
	terminal := &WebSocketTerminal{
		ID:        terminalID,
		Conn:      conn,
		InputChan: inputChan,
		OutputChan: outputChan,
		Done:      done,
	}

	// Store the terminal session
	terminalsMu.Lock()
	terminals[terminalID] = terminal
	terminalsMu.Unlock()

	// Send the terminal ID to the client
	if err := conn.WriteJSON(map[string]string{"type": "terminal_id", "id": terminalID}); err != nil {
		log.Printf("Failed to send terminal ID: %v", err)
		conn.Close()
		return
	}

	// Handle incoming messages (input from the client)
	go func() {
		defer func() {
			close(done)
			conn.Close()
			
			// Remove the terminal from the map
			terminalsMu.Lock()
			delete(terminals, terminalID)
			terminalsMu.Unlock()
			
			log.Printf("Terminal session %s closed", terminalID)
		}()

		for {
			// Read message from the WebSocket
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				return
			}

			// Handle different message types
			if messageType == websocket.TextMessage {
				// Parse the message
				input := string(message)
				
				// Send the input to the execution service
				select {
				case inputChan <- input:
					// Input sent successfully
				case <-done:
					return
				}
			}
		}
	}()

	// Handle outgoing messages (output to the client)
	go func() {
		for {
			select {
			case output := <-outputChan:
				// Send the output to the client
				err := conn.WriteMessage(websocket.TextMessage, []byte(output))
				if err != nil {
					log.Printf("Failed to write message: %v", err)
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Keep the connection alive with ping/pong
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()
}

// ExecuteCodeWebSocket executes code and streams the output over WebSocket
func (h *Handler) ExecuteCodeWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Read the initial message containing the code to execute
	_, message, err := conn.ReadMessage()
	if err != nil {
		log.Printf("Failed to read message: %v", err)
		return
	}

	// Parse the message into a code submission
	var submission models.CodeSubmission
	if err := submission.UnmarshalJSON(message); err != nil {
		log.Printf("Failed to parse submission: %v", err)
		conn.WriteJSON(map[string]string{"error": "Invalid submission format"})
		return
	}

	// Generate a unique ID for the submission
	submission.ID = executor.GenerateUUID()
	submission.Status = "pending"

	// Store the submission
	h.mu.Lock()
	h.submissions[submission.ID] = &submission
	h.mu.Unlock()

	// Create channels for communication
	inputChan := make(chan string)
	outputChan := make(chan string)
	done := make(chan struct{})

	// Set up the execution service to use these channels
	h.executionService.SetupWebSocketChannels(&submission, inputChan, outputChan)

	// Send the submission ID to the client
	if err := conn.WriteJSON(map[string]string{"type": "submission_id", "id": submission.ID}); err != nil {
		log.Printf("Failed to send submission ID: %v", err)
		return
	}

	// Execute the code in a goroutine
	go func() {
		h.executionService.ExecuteCodeWebSocket(&submission)
		close(done)
	}()

	// Handle incoming messages (input from the client)
	go func() {
		for {
			select {
			case <-done:
				return
			default:
				// Read message from the WebSocket
				_, message, err := conn.ReadMessage()
				if err != nil {
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
						log.Printf("WebSocket error: %v", err)
					}
					return
				}

				// Send the input to the execution service
				select {
				case inputChan <- string(message):
					// Input sent successfully
				case <-done:
					return
				}
			}
		}
	}()

	// Handle outgoing messages (output to the client)
	for {
		select {
		case output := <-outputChan:
			// Send the output to the client
			err := conn.WriteMessage(websocket.TextMessage, []byte(output))
			if err != nil {
				log.Printf("Failed to write message: %v", err)
				return
			}
		case <-done:
			// Execution completed
			return
		}
	}
}

// GetTerminal returns a terminal session by ID
func GetTerminal(id string) (*WebSocketTerminal, error) {
	terminalsMu.Lock()
	defer terminalsMu.Unlock()
	
	terminal, exists := terminals[id]
	if !exists {
		return nil, fmt.Errorf("terminal not found: %s", id)
	}
	
	return terminal, nil
}
