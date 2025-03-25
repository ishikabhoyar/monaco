package service

import (
    "os"
    "testing"
    "time"

    "github.com/arnab-afk/monaco/model"
    "github.com/stretchr/testify/assert"
)

// TestExecutionServiceCreation tests that the service is created properly
func TestExecutionServiceCreation(t *testing.T) {
    service := NewExecutionService()
    assert.NotNil(t, service)
    assert.NotNil(t, service.queue)
}

// TestExtractClassName tests the class name extraction for Java code
func TestExtractClassName(t *testing.T) {
    tests := []struct {
        name     string
        code     string
        expected string
    }{
        {
            name:     "Public class",
            code:     "public class MyClass { public static void main(String[] args) {} }",
            expected: "MyClass",
        },
        {
            name:     "Regular class",
            code:     "class RegularClass { public static void main(String[] args) {} }",
            expected: "RegularClass",
        },
        {
            name:     "Multiple classes",
            code:     "class Class1 {} public class MainClass {} class Class2 {}",
            expected: "MainClass",
        },
        {
            name:     "No class",
            code:     "// Just a comment",
            expected: "Solution", // Default class name
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := extractClassName(tt.code)
            assert.Equal(t, tt.expected, result)
        })
    }
}

// MockDockerExec is a function that can be used to mock Docker exec commands
type MockDockerExec func(cmd string, args ...string) ([]byte, error)

// TestUpdateSubmissionResult tests the submission result update logic
func TestUpdateSubmissionResult(t *testing.T) {
    service := NewExecutionService()
    
    // Test successful execution
    submission := &model.CodeSubmission{
        ID:        "test-id",
        Status:    "running",
        StartedAt: time.Now().Add(-500 * time.Millisecond),
        QueuedAt:  time.Now().Add(-1 * time.Second),
    }
    
    output := []byte("Hello, World!")
    service.updateSubmissionResult(submission, output, nil)
    
    assert.Equal(t, "completed", submission.Status)
    assert.Equal(t, "Hello, World!", submission.Output)
    assert.False(t, submission.CompletedAt.IsZero())
    
    // Test failed execution
    submission = &model.CodeSubmission{
        ID:        "test-id-2",
        Status:    "running",
        StartedAt: time.Now().Add(-500 * time.Millisecond),
        QueuedAt:  time.Now().Add(-1 * time.Second),
    }
    
    output = []byte("Compilation error")
    err := os.ErrInvalid // Any error will do for testing
    service.updateSubmissionResult(submission, output, err)
    
    assert.Equal(t, "failed", submission.Status)
    assert.Contains(t, submission.Output, "Compilation error")
    assert.Contains(t, submission.Output, err.Error())
    assert.False(t, submission.CompletedAt.IsZero())
}

// TestCodeExecutionJob tests the job execution logic
func TestCodeExecutionJob(t *testing.T) {
    service := NewExecutionService()
    
    submission := &model.CodeSubmission{
        ID:       "test-id",
        Language: "python",
        Code:     "print('test')",
        Status:   "queued",
        QueuedAt: time.Now(),
    }
    
    job := NewCodeExecutionJob(service, submission)
    assert.NotNil(t, job)
    assert.Equal(t, submission, job.submission)
    assert.Equal(t, service, job.service)
    
    // We can't easily test the actual execution because it depends on Docker
    // In a real test environment, you would mock the Docker calls
}