package executor

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
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/ishikabhoyar/monaco/new-backend/config"
	"github.com/ishikabhoyar/monaco/new-backend/models"
)

// CodeExecutor handles code execution for all languages
type CodeExecutor struct {
	config              *config.Config
	execQueue           chan *models.CodeSubmission
	submissions         map[string]*models.CodeSubmission
	submissionsMutex    sync.RWMutex
	terminalConnections map[string][]*websocket.Conn
	terminalMutex       sync.RWMutex
	inputChannels       map[string]chan string
	inputMutex          sync.RWMutex
}

// NewCodeExecutor creates a new code executor with specified capacity
func NewCodeExecutor(cfg *config.Config) *CodeExecutor {
	executor := &CodeExecutor{
		config:              cfg,
		execQueue:           make(chan *models.CodeSubmission, cfg.Executor.QueueCapacity),
		submissions:         make(map[string]*models.CodeSubmission),
		terminalConnections: make(map[string][]*websocket.Conn),
		inputChannels:       make(map[string]chan string),
	}

	// Start worker goroutines
	for i := 0; i < cfg.Executor.ConcurrentExecutions; i++ {
		go executor.worker(i)
	}

	log.Printf("Started %d code execution workers", cfg.Executor.ConcurrentExecutions)
	return executor
}

// SubmitCode adds a code submission to the execution queue
func (e *CodeExecutor) SubmitCode(submission *models.CodeSubmission) string {
	// Generate ID if not provided
	if submission.ID == "" {
		submission.ID = uuid.New().String()
	}

	submission.Status = "queued"
	submission.QueuedAt = time.Now()

	// Store submission
	e.submissionsMutex.Lock()
	e.submissions[submission.ID] = submission
	e.submissionsMutex.Unlock()

	// Send to execution queue
	e.execQueue <- submission

	log.Printf("Submission queued: %s, language: %s", submission.ID, submission.Language)
	return submission.ID
}

// GetSubmission returns a submission by ID
func (e *CodeExecutor) GetSubmission(id string) (*models.CodeSubmission, bool) {
	e.submissionsMutex.RLock()
	defer e.submissionsMutex.RUnlock()
	submission, exists := e.submissions[id]
	return submission, exists
}

// RegisterTerminalConnection registers a WebSocket connection for streaming output
func (e *CodeExecutor) RegisterTerminalConnection(submissionID string, conn *websocket.Conn) {
	e.terminalMutex.Lock()
	defer e.terminalMutex.Unlock()

	e.terminalConnections[submissionID] = append(e.terminalConnections[submissionID], conn)
	
	log.Printf("WebSocket connection registered for submission %s (total: %d)",
		submissionID, len(e.terminalConnections[submissionID]))

	// Set up a reader to handle input from WebSocket
	go e.handleTerminalInput(submissionID, conn)
}

// UnregisterTerminalConnection removes a WebSocket connection
func (e *CodeExecutor) UnregisterTerminalConnection(submissionID string, conn *websocket.Conn) {
	e.terminalMutex.Lock()
	defer e.terminalMutex.Unlock()

	connections := e.terminalConnections[submissionID]
	for i, c := range connections {
		if c == conn {
			// Remove the connection
			e.terminalConnections[submissionID] = append(connections[:i], connections[i+1:]...)
			break
		}
	}

	// Clean up if no more connections
	if len(e.terminalConnections[submissionID]) == 0 {
		delete(e.terminalConnections, submissionID)
	}

	log.Printf("WebSocket connection unregistered for submission %s", submissionID)
}

// handleTerminalInput reads input from the WebSocket and forwards it to the running process
func (e *CodeExecutor) handleTerminalInput(submissionID string, conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

	// If there's an input channel, send the input
		e.inputMutex.RLock()
		if inputChan, exists := e.inputChannels[submissionID]; exists {
			select {
			case inputChan <- string(message):
				log.Printf("Input sent to process: %s", string(message))
			default:
				log.Printf("Input channel is full or closed, input ignored")
			}
		}
		e.inputMutex.RUnlock()
	}

	// When connection is closed, unregister it
	e.UnregisterTerminalConnection(submissionID, conn)
}

// sendToTerminals sends output to all registered WebSocket connections
func (e *CodeExecutor) sendToTerminals(submissionID string, message models.WebSocketMessage) {
	e.terminalMutex.RLock()
	connections := e.terminalConnections[submissionID]
	e.terminalMutex.RUnlock()

	if len(connections) == 0 {
		return
	}

	for _, conn := range connections {
		err := conn.WriteJSON(message)
		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			// Consider unregistering the connection on error
		}
	}
}

// worker processes code execution jobs from the queue
func (e *CodeExecutor) worker(id int) {
	log.Printf("Worker %d started", id)

	for submission := range e.execQueue {
		log.Printf("Worker %d processing submission %s (%s)", id, submission.ID, submission.Language)
		
		// Update status to running
		submission.Status = "running"
		submission.StartedAt = time.Now()
		e.sendToTerminals(submission.ID, models.NewStatusMessage("running", "", ""))

		// Execute the code according to language
		e.executeCode(submission)

		// Update completion time
		submission.CompletedAt = time.Now()
		executionTime := submission.CompletedAt.Sub(submission.StartedAt).Seconds()
		submission.ExecutionTime = executionTime

		// Send completion status
		e.sendToTerminals(submission.ID, models.NewStatusMessage(submission.Status, "", ""))
		
		// Send a notification that terminal will close soon
		e.sendToTerminals(submission.ID, models.NewSystemMessage("Connection will close in 5 seconds"))
		
		// Add delay to keep the connection open longer
		time.Sleep(5 * time.Second)
		
		log.Printf("Worker %d completed submission %s in %.2f seconds", id, submission.ID, executionTime)
	}
}

// executeCode orchestrates the execution of code for different languages
func (e *CodeExecutor) executeCode(submission *models.CodeSubmission) {
	langConfig, exists := e.config.Languages[strings.ToLower(submission.Language)]
	if !exists {
		submission.Status = "failed"
		submission.Output = "Unsupported language: " + submission.Language
		return
	}

	// Create a temporary directory for this submission
	tempDir, err := os.MkdirTemp("", fmt.Sprintf("%s-code-%s-", submission.Language, submission.ID))
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create execution environment: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)

	// Choose execution strategy based on language
	switch strings.ToLower(submission.Language) {
	case "python":
		e.executePython(submission, tempDir, langConfig)
	case "java":
		e.executeJava(submission, tempDir, langConfig)
	case "c":
		e.executeC(submission, tempDir, langConfig)
	case "cpp":
		e.executeCpp(submission, tempDir, langConfig)
	case "javascript":
		e.executeJavaScript(submission, tempDir, langConfig)
	case "golang":
		e.executeGolang(submission, tempDir, langConfig)
	default:
		submission.Status = "failed"
		submission.Output = "Unsupported language: " + submission.Language
	}
}

// executePython executes Python code
func (e *CodeExecutor) executePython(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Write code to file
	codeFile := filepath.Join(tempDir, "code"+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Setup Docker run command
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.1)), // 10% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		langConfig.Image,
		"python", "/code/code.py",
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeJava executes Java code
func (e *CodeExecutor) executeJava(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Extract class name from code
	className := extractJavaClassName(submission.Code)
	
	// Write code to file
	codeFile := filepath.Join(tempDir, className+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Compile Java code
	compileCmd := exec.Command(
		"docker", "run", "--rm",
		"-v", tempDir+":/code",
		langConfig.Image,
		"javac", "/code/"+className+".java",
	)
	
	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		e.sendToTerminals(submission.ID, models.NewOutputMessage(string(compileOutput), true))
		return
	}
	
	// Setup Docker run command for execution
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.5)), // 50% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		langConfig.Image,
		"java", "-XX:+TieredCompilation", "-XX:TieredStopAtLevel=1",
		"-Xms64m", "-Xmx256m",
		"-cp", "/code", className,
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeC executes C code
func (e *CodeExecutor) executeC(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Write code to file
	codeFile := filepath.Join(tempDir, "code"+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Compile C code
	compileCmd := exec.Command(
		"docker", "run", "--rm",
		"-v", tempDir+":/code",
		langConfig.Image,
		"gcc", "-o", "/code/program", "/code/code.c",
	)
	
	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		e.sendToTerminals(submission.ID, models.NewOutputMessage(string(compileOutput), true))
		return
	}
	
	// Setup Docker run command
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.1)), // 10% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		langConfig.Image,
		"/code/program",
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeCpp executes C++ code
func (e *CodeExecutor) executeCpp(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Write code to file
	codeFile := filepath.Join(tempDir, "code"+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Compile C++ code
	compileCmd := exec.Command(
		"docker", "run", "--rm",
		"-v", tempDir+":/code",
		langConfig.Image,
		"g++", "-o", "/code/program", "/code/code.cpp",
	)
	
	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		submission.Status = "failed"
		submission.Output = "Compilation error:\n" + string(compileOutput)
		e.sendToTerminals(submission.ID, models.NewOutputMessage(string(compileOutput), true))
		return
	}
	
	// Setup Docker run command
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.1)), // 10% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		langConfig.Image,
		"/code/program",
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeJavaScript executes JavaScript code
func (e *CodeExecutor) executeJavaScript(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Write code to file
	codeFile := filepath.Join(tempDir, "code"+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Setup Docker run command
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.1)), // 10% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		langConfig.Image,
		"node", "/code/code.js",
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeGolang executes Go code
func (e *CodeExecutor) executeGolang(submission *models.CodeSubmission, tempDir string, langConfig config.LanguageConfig) {
	// Write code to file
	codeFile := filepath.Join(tempDir, "code"+langConfig.FileExt)
	if err := os.WriteFile(codeFile, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write code file: " + err.Error()
		return
	}

	// Setup Docker run command to compile and run in one step
	cmd := exec.Command(
		"docker", "run", "--rm", "-i",
		"--network=none",
		"--memory="+langConfig.MemoryLimit,
		"--cpu-quota="+fmt.Sprintf("%d", int(float64(100000)*0.1)), // 10% CPU
		"--pids-limit=20",
		"-v", tempDir+":/code",
		"-w", "/code",
		langConfig.Image,
		"go", "run", "/code/code.go",
	)

	// Execute the code with input handling
	e.executeWithIO(cmd, submission, time.Duration(langConfig.TimeoutSec)*time.Second)
}

// executeWithIO runs a command with input/output handling through WebSockets
func (e *CodeExecutor) executeWithIO(cmd *exec.Cmd, submission *models.CodeSubmission, timeout time.Duration) {
	// Create pipes for stdin, stdout and stderr
	stdin, err := cmd.StdinPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create stdin pipe: " + err.Error()
		return
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create stdout pipe: " + err.Error()
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create stderr pipe: " + err.Error()
		return
	}

	// Create an input channel for this submission
	inputChan := make(chan string, 10)
	e.inputMutex.Lock()
	e.inputChannels[submission.ID] = inputChan
	e.inputMutex.Unlock()

	// Clean up when done
	defer func() {
		e.inputMutex.Lock()
		delete(e.inputChannels, submission.ID)
		e.inputMutex.Unlock()
		close(inputChan)
	}()

	// Start the command
	if err := cmd.Start(); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to start process: " + err.Error()
		return
	}

	// Output buffer to collect all output
	var outputBuffer bytes.Buffer

	// Send initial input if provided
	if submission.Input != "" {
		io.WriteString(stdin, submission.Input+"\n")
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// Handle stdout in a goroutine
	go func() {
		buffer := make([]byte, 1024)
		for {
			n, err := stdout.Read(buffer)
			if n > 0 {
				data := buffer[:n]
				outputBuffer.Write(data)
				
				// Send real-time output to terminals
				e.sendToTerminals(submission.ID, models.NewOutputMessage(string(data), false))
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("Stdout read error: %v", err)
				}
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
				
				// Send real-time error output to terminals
				e.sendToTerminals(submission.ID, models.NewOutputMessage(string(data), true))
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("Stderr read error: %v", err)
				}
				break
			}
		}
	}()

	// Listen for input from WebSocket
	go func() {
		for {
			select {
			case input, ok := <-inputChan:
				if !ok {
					return
				}
				stdin.Write([]byte(input + "\n"))
			case <-ctx.Done():
				return
			}
		}
	}()

	// Wait for command to complete or timeout
	done := make(chan error)
	go func() {
		done <- cmd.Wait()
	}()

	// Wait for completion or timeout
	select {
	case <-ctx.Done():
		// Process timed out
		if ctx.Err() == context.DeadlineExceeded {
			log.Printf("Process timed out for submission %s", submission.ID)
			submission.Status = "failed"
			submission.Output = outputBuffer.String() + "\nExecution timed out after " + timeout.String()
			e.sendToTerminals(submission.ID, models.NewErrorMessage("timeout", "Execution timed out after "+timeout.String()))
			
			// Attempt to kill the process
			if err := cmd.Process.Kill(); err != nil {
				log.Printf("Failed to kill process: %v", err)
			}
		}
	case err := <-done:
		// Process completed
		if err != nil {
			log.Printf("Process error: %v", err)
			submission.Status = "failed"
			// Don't overwrite output, as stderr has already been captured
		} else {
			submission.Status = "completed"
		}
	}

	// Store the complete output
	submission.Output = outputBuffer.String()
}

// Helper function to extract Java class name
func extractJavaClassName(code string) string {
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
