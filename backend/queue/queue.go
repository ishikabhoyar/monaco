package queue

import (
	"sync"
)

// Job represents a task that can be executed
type Job interface {
	Execute()
}

// JobQueue manages the execution of jobs with limited concurrency
type JobQueue struct {
	jobs       chan Job
	maxWorkers int
	wg         sync.WaitGroup
	running    int
	mu         sync.Mutex
}

// NewJobQueue creates a new job queue with specified max concurrent workers
func NewJobQueue(maxWorkers int) *JobQueue {
	jq := &JobQueue{
		jobs:       make(chan Job, 100), // Buffer size of 100 jobs
		maxWorkers: maxWorkers,
	}
	jq.start()
	return jq
}

// start initializes the worker pool
func (jq *JobQueue) start() {
	// Start the workers
	for i := 0; i < jq.maxWorkers; i++ {
		jq.wg.Add(1)
		go func() {
			defer jq.wg.Done()
			for job := range jq.jobs {
				jq.mu.Lock()
				jq.running++
				jq.mu.Unlock()

				job.Execute()

				jq.mu.Lock()
				jq.running--
				jq.mu.Unlock()
			}
		}()
	}
}

// Enqueue adds a job to the queue
func (jq *JobQueue) Enqueue(job Job) {
	jq.jobs <- job
}

// Stop gracefully shuts down the job queue
func (jq *JobQueue) Stop() {
	close(jq.jobs)
	jq.wg.Wait()
}

// QueueStats returns statistics about the queue
func (jq *JobQueue) QueueStats() map[string]int {
	jq.mu.Lock()
	defer jq.mu.Unlock()

	return map[string]int{
		"queue_length": len(jq.jobs),
		"max_workers":  jq.maxWorkers,
		"running_jobs": jq.running,
	}
}
