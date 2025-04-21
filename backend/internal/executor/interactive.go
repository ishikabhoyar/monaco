package executor

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/arnab-afk/monaco/internal/models"
)

// executePythonInteractive runs Python code in interactive mode
func (s *ExecutionService) executePythonInteractive(submission *models.CodeSubmission, tempDir string) {
	log.Printf("[PYTHON-%s] Running Python in interactive mode", submission.ID)

	// Create an input channel for this submission
	inputChan := make(chan string)
	s.mu.Lock()
	s.inputChannels[submission.ID] = inputChan
	s.mu.Unlock()

	// Clean up when done
	defer func() {
		s.mu.Lock()
		delete(s.inputChannels, submission.ID)
		close(inputChan)
		s.mu.Unlock()
	}()

	// Create a wrapper script that handles interactive input
	wrapperPath := filepath.Join(tempDir, "wrapper.py")
	wrapperCode := `
import sys
import os
import time
import traceback

# Load the user's code
with open('/code/code.py', 'r') as f:
    user_code = f.read()

# Replace the built-in input function
original_input = input

def custom_input(prompt=''):
    # Print the prompt without newline
    sys.stdout.write(prompt)
    sys.stdout.flush()

    # Signal that we're waiting for input
    sys.stdout.write('\n[WAITING_FOR_INPUT]\n')
    sys.stdout.flush()

    # Wait for input from the parent process
    # Use a blocking read that won't raise EOFError
    line = ''
    while True:
        try:
            char = sys.stdin.read(1)
            if char == '\n':
                break
            if char:
                line += char
        except:
            # If any error occurs, wait a bit and try again
            time.sleep(0.1)
            continue

    # Echo the input as if the user typed it
    sys.stdout.write(line + '\n')
    sys.stdout.flush()

    return line

# Replace the built-in input function
input = custom_input

# Execute the user's code
try:
    # Use globals and locals to ensure proper variable scope
    exec(user_code, globals(), globals())
except Exception as e:
    # Print detailed error information
    sys.stdout.write(f'\nError: {str(e)}\n')
    traceback.print_exc(file=sys.stdout)
    sys.stdout.flush()
`

	if err := os.WriteFile(wrapperPath, []byte(wrapperCode), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write wrapper file: %v", err)
		return
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // Longer timeout for interactive
	defer cancel()

	// Start the container
	cmd := exec.CommandContext(ctx, "docker", "run", "--rm", "-i",
		"--network=none",           // No network access
		"--memory=100m",            // Memory limit
		"--cpu-period=100000",      // CPU quota period
		"--cpu-quota=10000",        // 10% CPU
		"--ulimit", "nofile=64:64", // File descriptor limits
		"-v", tempDir+":/code", // Mount code directory
		"python:3.9",
		"python", "/code/wrapper.py")

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

	// Start the command
	if err := cmd.Start(); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to start command: %v", err)
		return
	}

	// Set status to running
	submission.Status = "running"

	// Read output in a goroutine
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()

			// Check if the program is waiting for input
			if line == "[WAITING_FOR_INPUT]" {
				// Update status to waiting for input
				submission.Status = "waiting_for_input"
				continue
			}

			// Add the output to the submission
			submission.Output += line + "\n"
		}
	}()

	// Handle input in a goroutine
	go func() {
		for input := range inputChan {
			// Write the input to stdin
			_, err := stdin.Write([]byte(input + "\n"))
			if err != nil {
				log.Printf("[ERROR] Failed to write to stdin: %v", err)
				break
			}
		}
	}()

	// Wait for the command to complete
	err = cmd.Wait()

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
	log.Printf("[PYTHON-%s] Interactive execution completed", submission.ID)
}

// executeJavaScriptInteractive runs JavaScript code in interactive mode
func (s *ExecutionService) executeJavaScriptInteractive(submission *models.CodeSubmission, tempDir string) {
	log.Printf("[JS-%s] Running JavaScript in interactive mode", submission.ID)

	// Create an input channel for this submission
	inputChan := make(chan string)
	s.mu.Lock()
	s.inputChannels[submission.ID] = inputChan
	s.mu.Unlock()

	// Clean up when done
	defer func() {
		s.mu.Lock()
		delete(s.inputChannels, submission.ID)
		close(inputChan)
		s.mu.Unlock()
	}()

	// Create a wrapper script that handles interactive input
	wrapperPath := filepath.Join(tempDir, "wrapper.js")
	wrapperCode := `
const fs = require('fs');
const readline = require('readline');

// Load the user's code
const userCode = fs.readFileSync('/code/code.js', 'utf8');

// Create a custom readline interface
const originalReadline = readline.createInterface;
readline.createInterface = function(options) {
  // Create a custom interface that intercepts input
  const rl = originalReadline({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Override the question method
  const originalQuestion = rl.question;
  rl.question = function(query, callback) {
    // Print the prompt
    process.stdout.write(query);

    // Signal that we're waiting for input
    process.stdout.write('\n[WAITING_FOR_INPUT]\n');
    process.stdout.flush();

    // Set up a more robust input handler
    const onLine = (answer) => {
      // Echo the input as if the user typed it
      process.stdout.write(answer + '\n');
      process.stdout.flush();
      callback(answer);
    };

    // Handle input with error recovery
    rl.once('line', onLine);

    // Add error handler
    rl.once('error', (err) => {
      console.error('Input error:', err.message);
      // Provide a default answer in case of error
      callback('');
    });
  };

  return rl;
};

// Capture uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
});

// Execute the user's code
try {
  eval(userCode);
} catch (e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
`

	if err := os.WriteFile(wrapperPath, []byte(wrapperCode), 0644); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to write wrapper file: %v", err)
		return
	}

	// Run the code in a Docker container
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second) // Longer timeout for interactive
	defer cancel()

	// Start the container
	cmd := exec.CommandContext(ctx, "docker", "run", "--rm", "-i",
		"--network=none",       // No network access
		"--memory=100m",        // Memory limit
		"--cpu-period=100000",  // CPU quota period
		"--cpu-quota=10000",    // 10% CPU
		"-v", tempDir+":/code", // Mount code directory
		"node:18-alpine",
		"node", "/code/wrapper.js")

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

	// Start the command
	if err := cmd.Start(); err != nil {
		submission.Status = "failed"
		submission.Error = fmt.Sprintf("Failed to start command: %v", err)
		return
	}

	// Set status to running
	submission.Status = "running"

	// Read output in a goroutine
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()

			// Check if the program is waiting for input
			if line == "[WAITING_FOR_INPUT]" {
				// Update status to waiting for input
				submission.Status = "waiting_for_input"
				continue
			}

			// Add the output to the submission
			submission.Output += line + "\n"
		}
	}()

	// Handle input in a goroutine
	go func() {
		for input := range inputChan {
			// Write the input to stdin
			_, err := stdin.Write([]byte(input + "\n"))
			if err != nil {
				log.Printf("[ERROR] Failed to write to stdin: %v", err)
				break
			}
		}
	}()

	// Wait for the command to complete
	err = cmd.Wait()

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
	log.Printf("[JS-%s] Interactive execution completed", submission.ID)
}
