package queue

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// Mock job for testing
type MockJob struct {
	executed    bool
	executeTime time.Duration
	mu          sync.Mutex
}

func (j *MockJob) Execute() {
	j.mu.Lock()
	defer j.mu.Unlock()

	time.Sleep(j.executeTime)
	j.executed = true
}

func (j *MockJob) IsExecuted() bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.executed
}

func TestJobQueueCreation(t *testing.T) {
	// Test with different numbers of workers
	jq := NewJobQueue(5)
	assert.NotNil(t, jq)
	assert.Equal(t, 5, jq.maxWorkers)

	stats := jq.QueueStats()
	assert.Equal(t, 0, stats["queue_length"])
	assert.Equal(t, 5, stats["max_workers"])
	assert.Equal(t, 0, stats["running_jobs"])
}

func TestJobExecution(t *testing.T) {
	jq := NewJobQueue(2)

	// Create test jobs
	job1 := &MockJob{executeTime: 10 * time.Millisecond}
	job2 := &MockJob{executeTime: 10 * time.Millisecond}

	// Enqueue jobs
	jq.Enqueue(job1)
	jq.Enqueue(job2)

	// Wait for execution
	time.Sleep(50 * time.Millisecond)

	// Verify both jobs executed
	assert.True(t, job1.IsExecuted())
	assert.True(t, job2.IsExecuted())
}

func TestConcurrentJobsExecution(t *testing.T) {
	// Test that only maxWorkers jobs run concurrently
	jq := NewJobQueue(2)

	var mu sync.Mutex
	runningCount := 0
	maxObservedRunning := 0

	wg := sync.WaitGroup{}

	// Create long running jobs to test concurrency
	for i := 0; i < 5; i++ {
		wg.Add(1)
		job := &MockJob{
			executeTime: 100 * time.Millisecond,
		}

		// Wrap the job to monitor concurrency
		wrappedJob := JobFunc(func() {
			mu.Lock()
			runningCount++
			if runningCount > maxObservedRunning {
				maxObservedRunning = runningCount
			}
			mu.Unlock()

			job.Execute()

			mu.Lock()
			runningCount--
			mu.Unlock()
			wg.Done()
		})

		jq.Enqueue(wrappedJob)
	}

	wg.Wait()
	jq.Stop()

	// Verify max concurrent jobs is respected
	assert.LessOrEqual(t, maxObservedRunning, 2)
}

// Define JobFunc type for easier job creation in tests
type JobFunc func()

func (f JobFunc) Execute() {
	f()
}
