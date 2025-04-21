package executor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/internal/models"
	"github.com/arnab-afk/monaco/internal/queue"
)

// ExecutionService manages code execution
type ExecutionService struct {
	queue *queue.JobQueue
	mu    sync.Mutex
	// Map of submission ID to input channel for interactive programs
	inputChannels map[string]chan string
}

// CodeExecutionJob represents a code execution job
type CodeExecutionJob struct {
	service    *ExecutionService
	submission *models.CodeSubmission
}

// NewExecutionService creates a new execution service
func NewExecutionService() *ExecutionService {
	return &ExecutionService{
		queue:         queue.NewJobQueue(5), // 5 concurrent workers
		inputChannels: make(map[string]chan string),
	}
}

// NewCodeExecutionJob creates a new code execution job
func NewCodeExecutionJob(service *ExecutionService, submission *models.CodeSubmission) *CodeExecutionJob {
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

	log.Printf("[JOB-%s] Starting execution for language: %s", submission.ID, submission.Language)

	j.service.executeLanguageSpecific(submission)

	submission.CompletedAt = time.Now()
	log.Printf("[JOB-%s] Execution completed in %v", submission.ID, submission.CompletedAt.Sub(submission.StartedAt))
}

// ExecuteCode adds the submission to the execution queue
func (s *ExecutionService) ExecuteCode(submission *models.CodeSubmission) {
	submission.Status = "queued"
	submission.QueuedAt = time.Now()

	log.Printf("[SUBMISSION-%s] Code submission queued for language: %s", submission.ID, submission.Language)

	// Create and add the job to the queue
	job := NewCodeExecutionJob(s, submission)
	s.queue.AddJob(job)
}

// executeLanguageSpecific executes code based on the language
func (s *ExecutionService) executeLanguageSpecific(submission *models.CodeSubmission) {
	switch strings.ToLower(submission.Language) {
	case "python":
		s.executePython(submission)
	case "javascript", "js":
		s.executeJavaScript(submission)
	case "go", "golang":
		s.executeGo(submission)
	case "java":
		s.executeJava(submission)
	case "c":
		s.executeC(submission)
	case "cpp", "c++":
		s.executeCpp(submission)
	default:
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Unsupported language: %s", submission.Language)
		log.Printf("[EXEC-%s] ERROR: Unsupported language: %s", submission.ID, submission.Language)
	}
}

// executePython runs Python code in a container
func (s *ExecutionService) executePython(submission *models.CodeSubmission) {
	log.Printf("[PYTHON-%s] Preparing Python execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-python-*")
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

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if inputPath != "" {
		cmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",           // No network access
			"--memory=100m",            // Memory limit
			"--cpu-period=100000",      // CPU quota period
			"--cpu-quota=10000",        // 10% CPU
			"--ulimit", "nofile=64:64", // File descriptor limits
			"-v", tempDir+":/code", // Mount code directory
			"python:3.9",
			"sh", "-c", "cat /code/input.txt | python /code/code.py")
	} else {
		cmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",           // No network access
			"--memory=100m",            // Memory limit
			"--cpu-period=100000",      // CPU quota period
			"--cpu-quota=10000",        // 10% CPU
			"--ulimit", "nofile=64:64", // File descriptor limits
			"-v", tempDir+":/code", // Mount code directory
			"python:3.9",
			"python", "/code/code.py")
	}

	output, err := cmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[PYTHON-%s] Python execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// executeJavaScript runs JavaScript code in a container
func (s *ExecutionService) executeJavaScript(submission *models.CodeSubmission) {
	log.Printf("[JS-%s] Preparing JavaScript execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-js-*")
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

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if inputPath != "" {
		// Create a wrapper script to handle input
		wrapperPath := filepath.Join(tempDir, "wrapper.js")
		wrapperCode := `
const fs = require('fs');
const input = fs.readFileSync('/code/input.txt', 'utf8');
// Redirect input to stdin
process.stdin.push(input);
process.stdin.push(null);
// Load and run the user code
require('./code.js');
`
		if err := os.WriteFile(wrapperPath, []byte(wrapperCode), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write wrapper file: %v", err)
			return
		}

		cmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"node:18-alpine",
			"node", "/code/wrapper.js")
	} else {
		cmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"node:18-alpine",
			"node", "/code/code.js")
	}

	output, err := cmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[JS-%s] JavaScript execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// executeGo runs Go code in a container
func (s *ExecutionService) executeGo(submission *models.CodeSubmission) {
	log.Printf("[GO-%s] Preparing Go execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-go-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Write the code to a file
	codePath := filepath.Join(tempDir, "main.go")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// First compile the Go code
	compileCmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"golang:1.22-alpine",
		"go", "build", "-o", "/code/app", "/code/main.go")

	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		log.Printf("[GO-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Compilation error: %s", compileOutput)
		return
	}

	// Then run the compiled binary
	var runCmd *exec.Cmd
	if inputPath != "" {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"golang:1.22-alpine",
			"sh", "-c", "cat /code/input.txt | /code/app")
	} else {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"golang:1.22-alpine",
			"/code/app")
	}

	output, err := runCmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[GO-%s] Go execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// executeJava runs Java code in a container
func (s *ExecutionService) executeJava(submission *models.CodeSubmission) {
	log.Printf("[JAVA-%s] Preparing Java execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-java-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Extract class name from the code
	className := extractJavaClassName(submission.Code)
	if className == "" {
		className = "Main" // Default class name
	}

	// Write the code to a file
	codePath := filepath.Join(tempDir, className+".java")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// First compile the Java code
	compileCmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"eclipse-temurin:11-jdk-alpine",
		"javac", "/code/"+className+".java")

	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		log.Printf("[JAVA-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Compilation error: %s", compileOutput)
		return
	}

	// Then run the compiled class
	var runCmd *exec.Cmd
	if inputPath != "" {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=400m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=50000",    // 50% CPU
			"-v", tempDir+":/code", // Mount code directory
			"eclipse-temurin:11-jdk-alpine",
			"sh", "-c", "cd /code && cat input.txt | java -XX:+TieredCompilation -XX:TieredStopAtLevel=1 -Xverify:none -Xms64m -Xmx256m "+className)
	} else {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=400m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=50000",    // 50% CPU
			"-v", tempDir+":/code", // Mount code directory
			"eclipse-temurin:11-jdk-alpine",
			"java", "-XX:+TieredCompilation", "-XX:TieredStopAtLevel=1", "-Xverify:none", "-Xms64m", "-Xmx256m", "-cp", "/code", className)
	}

	output, err := runCmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[JAVA-%s] Java execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// executeC runs C code in a container
func (s *ExecutionService) executeC(submission *models.CodeSubmission) {
	log.Printf("[C-%s] Preparing C execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-c-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Write the code to a file
	codePath := filepath.Join(tempDir, "code.c")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// First compile the C code
	compileCmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest",
		"gcc", "-o", "/code/app", "/code/code.c")

	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		log.Printf("[C-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Compilation error: %s", compileOutput)
		return
	}

	// Then run the compiled binary
	var runCmd *exec.Cmd
	if inputPath != "" {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"gcc:latest",
			"sh", "-c", "cat /code/input.txt | /code/app")
	} else {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"gcc:latest",
			"/code/app")
	}

	output, err := runCmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[C-%s] C execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// executeCpp runs C++ code in a container
func (s *ExecutionService) executeCpp(submission *models.CodeSubmission) {
	log.Printf("[CPP-%s] Preparing C++ execution environment", submission.ID)
	startTime := time.Now()

	// Create a temporary file for the code
	tempDir, err := os.MkdirTemp("", "monaco-cpp-*")
	if err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to create temp directory: %v", err)
		return
	}
	defer os.RemoveAll(tempDir)

	// Write the code to a file
	codePath := filepath.Join(tempDir, "code.cpp")
	if err := os.WriteFile(codePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write code file: %v", err)
		return
	}

	// Create a file for input if provided
	inputPath := ""
	if submission.Input != "" {
		inputPath = filepath.Join(tempDir, "input.txt")
		if err := os.WriteFile(inputPath, []byte(submission.Input), 0644); err != nil {
			submission.Status = "failed"
			submission.Error = fmt.Sprintf("Failed to write input file: %v", err)
			return
		}
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// First compile the C++ code
	compileCmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest",
		"g++", "-o", "/code/app", "/code/code.cpp")

	compileOutput, compileErr := compileCmd.CombinedOutput()
	if compileErr != nil {
		log.Printf("[CPP-%s] Compilation failed: %v", submission.ID, compileErr)
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Compilation error: %s", compileOutput)
		return
	}

	// Then run the compiled binary
	var runCmd *exec.Cmd
	if inputPath != "" {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"gcc:latest",
			"sh", "-c", "cat /code/input.txt | /code/app")
	} else {
		runCmd = exec.CommandContext(ctx, "docker", "run", "--rm",
			"--network=none",       // No network access
			"--memory=100m",        // Memory limit
			"--cpu-period=100000",  // CPU quota period
			"--cpu-quota=10000",    // 10% CPU
			"-v", tempDir+":/code", // Mount code directory
			"gcc:latest",
			"/code/app")
	}

	output, err := runCmd.CombinedOutput()
	elapsed := time.Since(startTime)
	log.Printf("[CPP-%s] C++ execution completed in %v", submission.ID, elapsed)

	s.updateSubmissionResult(submission, output, err, ctx.Err() != nil)
}

// updateSubmissionResult updates the submission with the execution result
func (s *ExecutionService) updateSubmissionResult(submission *models.CodeSubmission, output []byte, err error, timedOut bool) {
	// Format the output to include the input if provided
	formattedOutput := ""
	if submission.Input != "" {
		// Only add input lines that were actually used
		inputLines := strings.Split(submission.Input, "\n")
		for _, line := range inputLines {
			if line != "" {
				// Don't add the input marker for empty lines
				formattedOutput += "[Input] " + line + "\n"
			}
		}
	}

	// Add the actual output
	rawOutput := string(output)

	if timedOut {
		submission.Status = "failed"
		submission.Error = "Execution timed out"
		submission.Output = formattedOutput + rawOutput
		return
	}

	if err != nil {
		submission.Status = "failed"
		submission.Error = err.Error()
		submission.Output = formattedOutput + rawOutput
		return
	}

	submission.Status = "completed"
	submission.Output = formattedOutput + rawOutput
}

// SubmitInput submits input to a running interactive program
func (s *ExecutionService) SubmitInput(submission *models.CodeSubmission, input string) {
	s.mu.Lock()
	inputChan, exists := s.inputChannels[submission.ID]
	s.mu.Unlock()

	if !exists {
		log.Printf("[ERROR] No input channel found for submission %s", submission.ID)
		return
	}

	// Send the input to the channel
	inputChan <- input

	// Update the submission status
	submission.Status = "running"
	submission.Output += "[Input] " + input + "\n"
}

// GetQueueStats returns statistics about the job queue
func (s *ExecutionService) GetQueueStats() models.QueueStats {
	return s.queue.GetStats()
}

// GenerateUUID generates a unique ID for submissions
func GenerateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// extractJavaClassName extracts the class name from Java code
func extractJavaClassName(code string) string {
	// Simple regex-like extraction
	lines := strings.Split(code, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "public class ") {
			parts := strings.Split(line, " ")
			if len(parts) > 2 {
				className := parts[2]
				// Remove any { or implements/extends
				className = strings.Split(className, "{")[0]
				className = strings.Split(className, " ")[0]
				return strings.TrimSpace(className)
			}
		}
	}
	return ""
}
