package queue

import (
	"log"
	"sync"
	"time"
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
	log.Printf("[QUEUE] Initializing job queue with %d workers and buffer size 100", maxWorkers)
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
		workerId := i + 1
		log.Printf("[WORKER-%d] Starting worker", workerId)
		jq.wg.Add(1)
		go func(id int) {
			defer jq.wg.Done()
			for job := range jq.jobs {
				jq.mu.Lock()
				jq.running++
				queueLen := len(jq.jobs)
				jq.mu.Unlock()

				log.Printf("[WORKER-%d] Processing job (running: %d, queued: %d)",
					id, jq.running, queueLen)

				startTime := time.Now()
				job.Execute()
				elapsed := time.Since(startTime)

				jq.mu.Lock()
				jq.running--
				jq.mu.Unlock()

				log.Printf("[WORKER-%d] Completed job in %v (running: %d, queued: %d)",
					id, elapsed, jq.running, len(jq.jobs))
			}
			log.Printf("[WORKER-%d] Worker shutting down", id)
		}(workerId)
	}
}

// Enqueue adds a job to the queue
func (jq *JobQueue) Enqueue(job Job) {
	jq.mu.Lock()
	queueLen := len(jq.jobs)
	jq.mu.Unlock()

	log.Printf("[QUEUE] Job enqueued (queue length: %d, running: %d)", queueLen, jq.running)
	jq.jobs <- job
}

// Stop gracefully shuts down the job queue
func (jq *JobQueue) Stop() {
	log.Println("[QUEUE] Stopping job queue, waiting for running jobs to complete")
	close(jq.jobs)
	jq.wg.Wait()
	log.Println("[QUEUE] Job queue shutdown complete")
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
