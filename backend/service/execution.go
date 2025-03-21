package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/model"
	"github.com/arnab-afk/monaco/queue"
)

// ExecutionService handles code execution for multiple languages
type ExecutionService struct {
	mu    sync.Mutex
	queue *queue.JobQueue
}

// NewExecutionService creates a new execution service
func NewExecutionService() *ExecutionService {
	return &ExecutionService{
		queue: queue.NewJobQueue(3), // 3 concurrent executions max
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
	j.submission.Status = "running"
	j.service.executeLanguageSpecific(j.submission)
}

// ExecuteCode adds the submission to the execution queue
func (s *ExecutionService) ExecuteCode(submission *model.CodeSubmission) {
	submission.Status = "queued"
	job := NewCodeExecutionJob(s, submission)
	s.queue.Enqueue(job)
}

// executeLanguageSpecific runs code in the appropriate language container
func (s *ExecutionService) executeLanguageSpecific(submission *model.CodeSubmission) {
	switch submission.Language {
	case "python":
		s.executePython(submission)
	case "java":
		s.executeJava(submission)
	case "c":
		s.executeC(submission)
	case "cpp":
		s.executeCpp(submission)
	default:
		submission.Status = "failed"
		submission.Output = "Unsupported language: " + submission.Language
	}
}

// GetQueueStats returns the current queue statistics
func (s *ExecutionService) GetQueueStats() map[string]int {
	return s.queue.QueueStats()
}

// Add a timeout function
func (s *ExecutionService) executeWithTimeout(cmd *exec.Cmd, timeout time.Duration) ([]byte, error) {
	done := make(chan error, 1)
	var output []byte
	var err error

	go func() {
		output, err = cmd.CombinedOutput()
		done <- err
	}()

	select {
	case <-time.After(timeout):
		if err := cmd.Process.Kill(); err != nil {
			return nil, fmt.Errorf("timeout reached but failed to kill process: %v", err)
		}
		return nil, fmt.Errorf("execution timed out after %v seconds", timeout.Seconds())
	case err := <-done:
		return output, err
	}
}

// executePython runs Python code in a container
func (s *ExecutionService) executePython(submission *model.CodeSubmission) {
	cmd := exec.Command("docker", "run", "--rm", "-i",
		"--network=none",           // No network access
		"--memory=100m",            // Memory limit
		"--cpu-period=100000",      // CPU quota period
		"--cpu-quota=10000",        // 10% CPU
		"--ulimit", "nofile=64:64", // File descriptor limits
		"python:3.9", "python", "-c", submission.Code)

	output, err := s.executeWithTimeout(cmd, 10*time.Second) // 10 second timeout

	s.updateSubmissionResult(submission, output, err)
}

// executeJava runs Java code in a container
func (s *ExecutionService) executeJava(submission *model.CodeSubmission) {
	// Create temp directory for Java files
	tempDir, err := os.MkdirTemp("", "java-execution")
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)

	// Write Java code to file
	javaFilePath := filepath.Join(tempDir, "Main.java")
	if err := os.WriteFile(javaFilePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write Java file: " + err.Error()
		return
	}

	// Run Java code in container
	cmd := exec.Command("docker", "run", "--rm",
		"--network=none",       // No network access
		"--memory=200m",        // Memory limit
		"--cpu-period=1000000", // CPU quota period
		"--cpu-quota=50000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"openjdk:11", "bash", "-c", "cd /code && javac Main.java && java Main")

	output, err := s.executeWithTimeout(cmd, 1000*time.Second) // 10 second timeout

	s.updateSubmissionResult(submission, output, err)
}

// executeC runs C code in a container
func (s *ExecutionService) executeC(submission *model.CodeSubmission) {
	// Create temp directory for C files
	tempDir, err := os.MkdirTemp("", "c-execution")
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)

	// Write C code to file
	cFilePath := filepath.Join(tempDir, "main.c")
	if err := os.WriteFile(cFilePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write C file: " + err.Error()
		return
	}

	// Run C code in container
	cmd := exec.Command("docker", "run", "--rm",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "bash", "-c", "cd /code && gcc -o main main.c && ./main")

	output, err := s.executeWithTimeout(cmd, 10*time.Second) // 10 second timeout

	s.updateSubmissionResult(submission, output, err)
}

// executeCpp runs C++ code in a container
func (s *ExecutionService) executeCpp(submission *model.CodeSubmission) {
	// Create temp directory for C++ files
	tempDir, err := os.MkdirTemp("", "cpp-execution")
	if err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to create temp directory: " + err.Error()
		return
	}
	defer os.RemoveAll(tempDir)

	// Write C++ code to file
	cppFilePath := filepath.Join(tempDir, "main.cpp")
	if err := os.WriteFile(cppFilePath, []byte(submission.Code), 0644); err != nil {
		submission.Status = "failed"
		submission.Output = "Failed to write C++ file: " + err.Error()
		return
	}

	// Run C++ code in container
	cmd := exec.Command("docker", "run", "--rm",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"gcc:latest", "bash", "-c", "cd /code && g++ -o main main.cpp && ./main")

	output, err := s.executeWithTimeout(cmd, 10*time.Second) // 10 second timeout

	s.updateSubmissionResult(submission, output, err)
}

// updateSubmissionResult updates the submission with execution results
func (s *ExecutionService) updateSubmissionResult(submission *model.CodeSubmission, output []byte, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err != nil {
		submission.Status = "failed"
		submission.Output = string(output) + "\n" + err.Error()
	} else {
		submission.Status = "completed"
		submission.Output = string(output)
	}
}
