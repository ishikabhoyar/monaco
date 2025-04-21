package executor

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/arnab-afk/monaco/internal/models"
)

// WebSocketSession represents a WebSocket execution session
type WebSocketSession struct {
	Submission *models.CodeSubmission
	InputChan  chan string
	OutputChan chan string
	Done       chan struct{}
}

// SetupWebSocketChannels sets up the channels for WebSocket communication
func (s *ExecutionService) SetupWebSocketChannels(submission *models.CodeSubmission, inputChan chan string, outputChan chan string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Store the channels in the service
	s.wsInputChannels[submission.ID] = inputChan
	s.wsOutputChannels[submission.ID] = outputChan
}

// ExecuteCodeWebSocket executes code and streams the output over WebSocket
func (s *ExecutionService) ExecuteCodeWebSocket(submission *models.CodeSubmission) {
	log.Printf("[WS-%s] Starting WebSocket execution for %s code", submission.ID, submission.Language)

	// Update submission status
	submission.Status = "running"
	submission.StartedAt = time.Now()

	// Execute the code based on the language
	switch strings.ToLower(submission.Language) {
	case "python":
		s.executePythonWebSocket(submission)
	case "javascript":
		s.executeJavaScriptWebSocket(submission)
	case "go":
		s.executeGoWebSocket(submission)
	case "java":
		s.executeJavaWebSocket(submission)
	case "c":
		s.executeCWebSocket(submission)
	case "cpp":
		s.executeCppWebSocket(submission)
	default:
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Unsupported language: %s", submission.Language)
		submission.CompletedAt = time.Now()
	}

	log.Printf("[WS-%s] Execution completed with status: %s", submission.ID, submission.Status)
}

// executePythonWebSocket executes Python code with WebSocket communication
func (s *ExecutionService) executePythonWebSocket(submission *models.CodeSubmission) {
	log.Printf("[WS-PYTHON-%s] Preparing Python WebSocket execution", submission.ID)

	// Create a temporary directory for the code
	tempDir, err := os.MkdirTemp("", "monaco-ws-python-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Write the code to a file
	codePath := filepath.Join(tempDir, "code.py")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Get the input and output channels
	s.mu.Lock()
	inputChan := s.wsInputChannels[submission.ID]
	outputChan := s.wsOutputChannels[submission.ID]
	s.mu.Unlock()

	// Create a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Run the code in a Docker container
	cmd := exec.CommandContext(ctx, "docker", "run", "--rm", "-i",
		"--network=none",           // No network access
		"--memory=100m",            // Memory limit
		"--cpu-period=100000",      // CPU quota period
		"--cpu-quota=10000",        // 10% CPU
		"--ulimit", "nofile=64:64", // File descriptor limits
		"-v", tempDir+":/code",     // Mount code directory
		"python:3.9",
		"python", "/code/code.py")

	// Get pipes for stdin and stdout
	stdin, err := cmd.StdinPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stdin pipe: %v", err)
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stdout pipe: %v", err)
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stderr pipe: %v", err)
		return
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to start command: %v", err)
		return
	}

	// Create a done channel to signal when the command is complete
	done := make(chan struct{})

	// Read from stdout and send to the output channel
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case outputChan <- line + "\n":
				// Output sent successfully
			case <-done:
				return
			}
		}
	}()

	// Read from stderr and send to the output channel
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case outputChan <- "ERROR: " + line + "\n":
				// Error sent successfully
			case <-done:
				return
			}
		}
	}()

	// Read from the input channel and write to stdin
	go func() {
		for {
			select {
			case input := <-inputChan:
				// Write the input to stdin
				_, err := io.WriteString(stdin, input+"\n")
				if err != nil {
					log.Printf("[WS-PYTHON-%s] Failed to write to stdin: %v", submission.ID, err)
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Wait for the command to complete
	err = cmd.Wait()
	close(done)

	// Update the submission status
	if err != nil {
		if ctx.Err() != nil {
			submission.Status = "failed"
			submission.Error = "Execution timed out"
		} else {
			submission.Status = "failed"
			submission.Error = err.Error()
		}
	} else {
		submission.Status = "completed"
	}

	submission.CompletedAt = time.Now()
	log.Printf("[WS-PYTHON-%s] WebSocket execution completed", submission.ID)
}

// executeJavaScriptWebSocket executes JavaScript code with WebSocket communication
func (s *ExecutionService) executeJavaScriptWebSocket(submission *models.CodeSubmission) {
	log.Printf("[WS-JS-%s] Preparing JavaScript WebSocket execution", submission.ID)

	// Create a temporary directory for the code
	tempDir, err := os.MkdirTemp("", "monaco-ws-js-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Write the code to a file
	codePath := filepath.Join(tempDir, "code.js")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Get the input and output channels
	s.mu.Lock()
	inputChan := s.wsInputChannels[submission.ID]
	outputChan := s.wsOutputChannels[submission.ID]
	s.mu.Unlock()

	// Create a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Run the code in a Docker container
	cmd := exec.CommandContext(ctx, "docker", "run", "--rm", "-i",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"node:18-alpine",
		"node", "/code/code.js")

	// Get pipes for stdin and stdout
	stdin, err := cmd.StdinPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stdin pipe: %v", err)
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stdout pipe: %v", err)
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to get stderr pipe: %v", err)
		return
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to start command: %v", err)
		return
	}

	// Create a done channel to signal when the command is complete
	done := make(chan struct{})

	// Read from stdout and send to the output channel
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case outputChan <- line + "\n":
				// Output sent successfully
			case <-done:
				return
			}
		}
	}()

	// Read from stderr and send to the output channel
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case outputChan <- "ERROR: " + line + "\n":
				// Error sent successfully
			case <-done:
				return
			}
		}
	}()

	// Read from the input channel and write to stdin
	go func() {
		for {
			select {
			case input := <-inputChan:
				// Write the input to stdin
				_, err := io.WriteString(stdin, input+"\n")
				if err != nil {
					log.Printf("[WS-JS-%s] Failed to write to stdin: %v", submission.ID, err)
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Wait for the command to complete
	err = cmd.Wait()
	close(done)

	// Update the submission status
	if err != nil {
		if ctx.Err() != nil {
			submission.Status = "failed"
			submission.Error = "Execution timed out"
		} else {
			submission.Status = "failed"
			submission.Error = err.Error()
		}
	} else {
		submission.Status = "completed"
	}

	submission.CompletedAt = time.Now()
	log.Printf("[WS-JS-%s] WebSocket execution completed", submission.ID)
}

// executeGoWebSocket executes Go code with WebSocket communication
func (s *ExecutionService) executeGoWebSocket(submission *models.CodeSubmission) {
	// Implementation similar to executePythonWebSocket but for Go
	// For brevity, this is left as a placeholder
	submission.Status = "failed"
	submission.Error = "WebSocket execution for Go not implemented yet"
}

// executeJavaWebSocket executes Java code with WebSocket communication
func (s *ExecutionService) executeJavaWebSocket(submission *models.CodeSubmission) {
	// Implementation similar to executePythonWebSocket but for Java
	// For brevity, this is left as a placeholder
	submission.Status = "failed"
	submission.Error = "WebSocket execution for Java not implemented yet"
}

// executeCWebSocket executes C code with WebSocket communication
func (s *ExecutionService) executeCWebSocket(submission *models.CodeSubmission) {
	// Implementation similar to executePythonWebSocket but for C
	// For brevity, this is left as a placeholder
	submission.Status = "failed"
	submission.Error = "WebSocket execution for C not implemented yet"
}

// executeCppWebSocket executes C++ code with WebSocket communication
func (s *ExecutionService) executeCppWebSocket(submission *models.CodeSubmission) {
	// Implementation similar to executePythonWebSocket but for C++
	// For brevity, this is left as a placeholder
	submission.Status = "failed"
	submission.Error = "WebSocket execution for C++ not implemented yet"
}
