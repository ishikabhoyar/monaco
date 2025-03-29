package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/model"
	"github.com/arnab-afk/monaco/queue"
	"github.com/gorilla/websocket"
)

// ExecutionService handles code execution for multiple languages
type ExecutionService struct {
	mu                  sync.Mutex
	queue               *queue.JobQueue
	terminalConnections map[string][]*websocket.Conn // Map of executionID to WebSocket connections
	execInputChannels   map[string]chan string       // Map of executionID to input channels
}

// NewExecutionService creates a new execution service
func NewExecutionService() *ExecutionService {
	log.Println("Initializing execution service with 3 concurrent workers")
	return &ExecutionService{
		queue:               queue.NewJobQueue(3), // 3 concurrent executions max
		terminalConnections: make(map[string][]*websocket.Conn),
		execInputChannels:   make(map[string]chan string),
	}
}

// RegisterTerminalConnection registers a WebSocket connection for an execution
func (s *ExecutionService) RegisterTerminalConnection(executionID string, conn *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.terminalConnections[executionID]; !exists {
		s.terminalConnections[executionID] = make([]*websocket.Conn, 0)
	}
	s.terminalConnections[executionID] = append(s.terminalConnections[executionID], conn)
	log.Printf("[WS-%s] Terminal connection registered, total connections: %d",
		executionID, len(s.terminalConnections[executionID]))
}

// UnregisterTerminalConnection removes a WebSocket connection
func (s *ExecutionService) UnregisterTerminalConnection(executionID string, conn *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()

	connections, exists := s.terminalConnections[executionID]
	if !exists {
		return
	}

	// Remove the specific connection
	for i, c := range connections {
		if c == conn {
			s.terminalConnections[executionID] = append(connections[:i], connections[i+1:]...)
			break
		}
	}

	// If no more connections, clean up
	if len(s.terminalConnections[executionID]) == 0 {
		delete(s.terminalConnections, executionID)
	}

	log.Printf("[WS-%s] Terminal connection unregistered", executionID)
}

// SendOutputToTerminals sends output to all connected terminals for an execution
func (s *ExecutionService) SendOutputToTerminals(executionID string, output string) {
	s.mu.Lock()
	connections := s.terminalConnections[executionID]
	s.mu.Unlock()

	for _, conn := range connections {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(output)); err != nil {
			log.Printf("[WS-%s] Error sending to terminal: %v", executionID, err)
			// Unregister this connection on error
			s.UnregisterTerminalConnection(executionID, conn)
		}
	}
}

// SendInput sends user input to a running process
func (s *ExecutionService) SendInput(executionID string, input string) {
	s.mu.Lock()
	inputChan, exists := s.execInputChannels[executionID]
	s.mu.Unlock()

	if exists {
		select {
		case inputChan <- input:
			log.Printf("[WS-%s] Sent input to execution: %s", executionID, input)
		default:
			log.Printf("[WS-%s] Execution not ready for input", executionID)
		}
	} else {
		log.Printf("[WS-%s] No input channel for execution", executionID)
	}
}

// CodeExecutionJob represents a job to execute code
type CodeExecutionJob struct {
	service    *ExecutionService
	submission *model.CodeSubmission
}

// NewCodeExecutionJob creates a new code execution job
func NewCodeExecutionJob(service *ExecutionService, submission *model.CodeSubmission) *CodeExecutionJob {
	return &CodeExecutionJob{
		service:    service,
		submission: submission,
	}
}

// Execute runs the code execution job
func (j *CodeExecutionJob) Execute() {
	submission := j.submission
	submission.Status = "running"
	submission.StartedAt = time.Now()

	log.Printf("[JOB-%s] Starting execution for language: %s",
		submission.ID, submission.Language)

	j.service.executeLanguageSpecific(submission)
}

// ExecuteCode adds the submission to the execution queue
func (s *ExecutionService) ExecuteCode(submission *model.CodeSubmission) {
	submission.Status = "queued"
	submission.QueuedAt = time.Now()

	log.Printf("[SUBMISSION-%s] Code submission queued for language: %s (Queue length: %d)",
		submission.ID, submission.Language, s.queue.QueueStats()["queue_length"])

	// Log if input is provided
	if len(submission.Input) > 0 {
		inputLen := len(submission.Input)
		previewLen := 30
		if inputLen > previewLen {
			log.Printf("[INPUT-%s] Input provided (%d bytes): %s...",
				submission.ID, inputLen, submission.Input[:previewLen])
		} else {
			log.Printf("[INPUT-%s] Input provided (%d bytes): %s",
				submission.ID, inputLen, submission.Input)
		}
	}

	job := NewCodeExecutionJob(s, submission)
	s.queue.Enqueue(job)
}

// executeLanguageSpecific runs code in the appropriate language container
func (s *ExecutionService) executeLanguageSpecific(submission *model.CodeSubmission) {
	log.Printf("[EXEC-%s] Selecting execution environment for language: %s",
		submission.ID, submission.Language)

	switch submission.Language {
	case "python":
		log.Printf("[EXEC-%s] Executing Python code", submission.ID)
		s.executePython(submission)
	case "java":
		log.Printf("[EXEC-%s] Executing Java code", submission.ID)
		s.executeJava(submission)
	case "c":
		log.Printf("[EXEC-%s] Executing C code", submission.ID)
		s.executeC(submission)
	case "cpp":
		log.Printf("[EXEC-%s] Executing C++ code", submission.ID)
		s.executeCpp(submission)
	default:
		log.Printf("[EXEC-%s] ERROR: Unsupported language: %s", submission.ID, submission.Language)
		submission.Status = "failed"
		submission.Output = "Unsupported language: " + submission.Language
	}
}

// executeWithInput runs a command with a timeout and provides input
func (s *ExecutionService) executeWithInput(cmd *exec.Cmd, input string, timeout time.Duration, submissionID string) ([]byte, error) {
	log.Printf("[TIMEOUT-%s] Setting execution timeout: %v", submissionID, timeout)

	// Create pipes for stdin, stdout, and stderr
	stdin, stdinErr := cmd.StdinPipe()
	if stdinErr != nil {
		return nil, fmt.Errorf("failed to create stdin pipe: %v", stdinErr)
	}

	stdout, stdoutErr := cmd.StdoutPipe()
	if stdoutErr != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %v", stdoutErr)
	}

	stderr, stderrErr := cmd.StderrPipe()
	if stderrErr != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %v", stderrErr)
	}

	// Create an input channel and register it
	inputChan := make(chan string, 10)
	s.mu.Lock()
	s.execInputChannels[submissionID] = inputChan
	s.mu.Unlock()

	// Clean up the input channel when done
	defer func() {
		s.mu.Lock()
		delete(s.execInputChannels, submissionID)
		s.mu.Unlock()
		close(inputChan)
	}()

	// Start the command
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start process: %v", err)
	}

	// Create a buffer to collect all output
	var outputBuffer bytes.Buffer

	// Handle stdout in a goroutine
	go func() {
		buffer := make([]byte, 1024)
		for {
			n, err := stdout.Read(buffer)
			if n > 0 {
				data := buffer[:n]
				outputBuffer.Write(data)
				// Send real-time output to connected terminals
				s.SendOutputToTerminals(submissionID, string(data))
			}
			if err != nil {
				break
			}
		}
	}()

	// Handle stderr in a goroutine
	go func() {
		buffer := make([]byte, 1024)
		for {
			n, err := stderr.Read(buffer)
			if n > 0 {
				data := buffer[:n]
				outputBuffer.Write(data)
				// Send real-time output to connected terminals
				s.SendOutputToTerminals(submissionID, string(data))
			}
			if err != nil {
				break
			}
		}
	}()

	// Write initial input if provided
	if input != "" {
		io.WriteString(stdin, input+"\n")
	}

	// Process is in a separate context, but it needs to be killed if timeout occurs
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle additional input from WebSocket in a goroutine
	go func() {
		for {
			select {
			case additionalInput, ok := <-inputChan:
				if !ok {
					return
				}
				log.Printf("[INPUT-%s] Received input from WebSocket: %s", submissionID, additionalInput)
				io.WriteString(stdin, additionalInput+"\n")
			case <-ctx.Done():
				return
			}
		}
	}()

	// Wait for the command to complete with timeout
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	// Wait for completion or timeout
	select {
	case <-time.After(timeout):
		cancel() // Stop the input handler
		log.Printf("[TIMEOUT-%s] Execution timed out after %v seconds", submissionID, timeout.Seconds())
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("[TIMEOUT-%s] Failed to kill process: %v", submissionID, err)
		}
		s.SendOutputToTerminals(submissionID, fmt.Sprintf("\n[System] Process killed after timeout of %v seconds", timeout.Seconds()))
		return outputBuffer.Bytes(), fmt.Errorf("execution timed out after %v seconds", timeout.Seconds())
	case err := <-done:
		cancel() // Stop the input handler
		s.SendOutputToTerminals(submissionID, "\n[System] Process completed")
		return outputBuffer.Bytes(), err
	}
}

// executePython runs Python code in a container
func (s *ExecutionService) executePython(submission *model.CodeSubmission) {
	log.Printf("[PYTHON-%s] Preparing Python execution environment", submission.ID)
	startTime := time.Now()

	cmd := exec.Command("docker", "run", "--rm", "-i",
		"--network=none",           // No network access
		"--memory=100m",            // Memory limit
		"--cpu-period=100000",      // CPU quota period
		"--cpu-quota=10000",        // 10% CPU
		"--ulimit", "nofile=64:64", // File descriptor limits
		"python:3.9", "python", "-c", submission.Code)

	log.Printf("[PYTHON-%s] Executing Python code with timeout: 10s", submission.ID)

	// Use the enhanced executeWithInput method for all executions
	output, err := s.executeWithInput(cmd, submission.Input, 100*time.Second, submission.ID)

	elapsed := time.Since(startTime)
	log.Printf("[PYTHON-%s] Python execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err)
}

// extractClassName extracts the Java class name from code
func extractClassName(code string) string {
	// Default class name as fallback
	defaultClass := "Solution"

	// Look for public class
	re := regexp.MustCompile(`public\s+class\s+(\w+)`)
	matches := re.FindStringSubmatch(code)
	if len(matches) > 1 {
		return matches[1]
	}

	// Look for any class if no public class
	re = regexp.MustCompile(`class\s+(\w+)`)
	matches = re.FindStringSubmatch(code)
	if len(matches) > 1 {
		return matches[1]
	}

	return defaultClass
}

// executeJava runs Java code in a container
func (s *ExecutionService) executeJava(submission *model.CodeSubmission) {
	log.Printf("[JAVA-%s] Preparing Java execution environment", submission.ID)
	startTime := time.Now()

	// Extract class name from code
	className := extractClassName(submission.Code)
	log.Printf("[JAVA-%s] Detected class name: %s", submission.ID, className)

	// Create temp directory for Java files
	tempDir, err := os.MkdirTemp("", "java-execution-"+submission.ID)
	if err != nil {
		log.Printf("[JAVA-%s] Failed to create temp directory: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)
	log.Printf("[JAVA-%s] Created temp directory: %s", submission.ID, tempDir)

	// Write Java code to file with detected class name
	javaFilePath := filepath.Join(tempDir, className+".java")
	if err := os.WriteFile(javaFilePath, []byte(submission.Code), 0644); err != nil {
		log.Printf("[JAVA-%s] Failed to write Java file: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to write Java file: " + err.Error()
		return
	}
	log.Printf("[JAVA-%s] Wrote code to file: %s", submission.ID, javaFilePath)

	// First compile without running
	compileCmd := exec.Command("docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"eclipse-temurin:11-jdk-alpine",
		"javac", "/code/"+className+".java")

	log.Printf("[JAVA-%s] Compiling Java code", submission.ID)
	compileOutput, compileErr := compileCmd.CombinedOutput()

	if compileErr != nil {
		log.Printf("[JAVA-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		return
	}

	log.Printf("[JAVA-%s] Compilation successful", submission.ID)

	// Now run the compiled class with the enhanced executeWithInput method
	runCmd := exec.Command("docker", "run", "--rm", "-i",
		"--network=none",       // No network access
		"--memory=400m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=50000",    // 50% CPU
		"-v", tempDir+":/code", // Mount code directory
		"eclipse-temurin:11-jdk-alpine",
		"java", "-XX:+TieredCompilation", "-XX:TieredStopAtLevel=1",
		"-Xverify:none", "-Xms64m", "-Xmx256m",
		"-cp", "/code", className)

	log.Printf("[JAVA-%s] Executing Java code", submission.ID)
	output, err := s.executeWithInput(runCmd, submission.Input, 15*time.Second, submission.ID)

	elapsed := time.Since(startTime)
	log.Printf("[JAVA-%s] Java execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err)
}

// executeC runs C code in a container with improved file handling
func (s *ExecutionService) executeC(submission *model.CodeSubmission) {
	log.Printf("[C-%s] Preparing C execution environment", submission.ID)
	startTime := time.Now()

	// Create unique temp directory for C files
	tempDir, err := os.MkdirTemp("", "c-execution-"+submission.ID)
	if err != nil {
		log.Printf("[C-%s] Failed to create temp directory: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)
	log.Printf("[C-%s] Created temp directory: %s", submission.ID, tempDir)

	// Write C code to file
	cFilePath := filepath.Join(tempDir, "solution.c")
	if err := os.WriteFile(cFilePath, []byte(submission.Code), 0644); err != nil {
		log.Printf("[C-%s] Failed to write C file: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to write C file: " + err.Error()
		return
	}
	log.Printf("[C-%s] Wrote code to file: %s", submission.ID, cFilePath)

	// Compile C code first
	compileCmd := exec.Command("docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "gcc", "-o", "/code/solution", "/code/solution.c")

	compileOutput, compileErr := compileCmd.CombinedOutput()

	if compileErr != nil {
		log.Printf("[C-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		return
	}

	log.Printf("[C-%s] Compilation successful", submission.ID)

	// Run C executable using executeWithInput to support WebSockets
	runCmd := exec.Command("docker", "run", "--rm", "-i",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "/code/solution")

	log.Printf("[C-%s] Executing C code", submission.ID)
	output, err := s.executeWithInput(runCmd, submission.Input, 30*time.Second, submission.ID)

	elapsed := time.Since(startTime)
	log.Printf("[C-%s] C execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err)
}

// executeCpp runs C++ code in a container with improved file handling
func (s *ExecutionService) executeCpp(submission *model.CodeSubmission) {
	log.Printf("[CPP-%s] Preparing C++ execution environment", submission.ID)
	startTime := time.Now()

	// Create unique temp directory for C++ files
	tempDir, err := os.MkdirTemp("", "cpp-execution-"+submission.ID)
	if err != nil {
		log.Printf("[CPP-%s] Failed to create temp directory: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)
	log.Printf("[CPP-%s] Created temp directory: %s", submission.ID, tempDir)

	// Write C++ code to file
	cppFilePath := filepath.Join(tempDir, "solution.cpp")
	if err := os.WriteFile(cppFilePath, []byte(submission.Code), 0644); err != nil {
		log.Printf("[CPP-%s] Failed to write C++ file: %v", submission.ID, err)
		submission.Status = "failed"
		submission.Output = "Failed to write C++ file: " + err.Error()
		return
	}
	log.Printf("[CPP-%s] Wrote code to file: %s", submission.ID, cppFilePath)

	// Compile C++ code first
	compileCmd := exec.Command("docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "g++", "-o", "/code/solution", "/code/solution.cpp")

	compileOutput, compileErr := compileCmd.CombinedOutput()

	if compileErr != nil {
		log.Printf("[CPP-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		return
	}

	log.Printf("[CPP-%s] Compilation successful", submission.ID)

	// Run C++ executable using executeWithInput to support WebSockets
	runCmd := exec.Command("docker", "run", "--rm", "-i",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "/code/solution")

	log.Printf("[CPP-%s] Executing C++ code", submission.ID)
	output, err := s.executeWithInput(runCmd, submission.Input, 100*time.Second, submission.ID)

	elapsed := time.Since(startTime)
	log.Printf("[CPP-%s] C++ execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err)
}

// executeWithTimeout runs a command with a timeout
func (s *ExecutionService) executeWithTimeout(cmd *exec.Cmd, timeout time.Duration, submissionID string) ([]byte, error) {
	log.Printf("[TIMEOUT-%s] Setting execution timeout: %v", submissionID, timeout)

	done := make(chan error, 1)
	var output []byte
	var err error

	go func() {
		log.Printf("[EXEC-%s] Starting command execution: %v", submissionID, cmd.Args)
		output, err = cmd.CombinedOutput()
		done <- err
	}()

	select {
	case <-time.After(timeout):
		log.Printf("[TIMEOUT-%s] Execution timed out after %v seconds", submissionID, timeout.Seconds())
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("[TIMEOUT-%s] Failed to kill process: %v", submissionID, err)
			return nil, fmt.Errorf("timeout reached but failed to kill process: %v", err)
		}
		return nil, fmt.Errorf("execution timed out after %v seconds", timeout.Seconds())
	case err := <-done:
		if err != nil {
			log.Printf("[EXEC-%s] Command execution failed: %v", submissionID, err)
		} else {
			log.Printf("[EXEC-%s] Command execution completed successfully", submissionID)
		}
		return output, err
	}
}

// updateSubmissionResult updates the submission with execution results
func (s *ExecutionService) updateSubmissionResult(submission *model.CodeSubmission, output []byte, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	submission.CompletedAt = time.Now()
	executionTime := submission.CompletedAt.Sub(submission.StartedAt)
	totalTime := submission.CompletedAt.Sub(submission.QueuedAt)

	if err != nil {
		submission.Status = "failed"
		submission.Output = string(output) + "\n" + err.Error()
		log.Printf("[RESULT-%s] Execution FAILED in %v (total time: %v, including queue: %v)",
			submission.ID, executionTime, totalTime, totalTime-executionTime)
	} else {
		submission.Status = "completed"
		submission.Output = string(output)
		log.Printf("[RESULT-%s] Execution COMPLETED in %v (total time: %v, including queue: %v)",
			submission.ID, executionTime, totalTime, totalTime-executionTime)
	}
}

// GetQueueStats returns statistics about the job queue
func (s *ExecutionService) GetQueueStats() map[string]int {
	stats := s.queue.QueueStats()
	log.Printf("[QUEUE] Stats - Jobs in queue: %d, Running jobs: %d, Max workers: %d",
		stats["queue_length"], stats["running_jobs"], stats["max_workers"])
	return stats
}
