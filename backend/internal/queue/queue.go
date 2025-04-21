package queue

import (
	"log"
	"sync"
	"time"

	"github.com/arnab-afk/monaco/internal/models"
)

// Job represents a job to be executed
type Job interface {
	Execute()
}

// JobQueue manages the execution of jobs
type JobQueue struct {
	queue          chan Job
	wg             sync.WaitGroup
	mu             sync.Mutex
	runningJobs    int
	completedJobs  int
	failedJobs     int
	totalProcessed int
	workerCount    int
}

// NewJobQueue creates a new job queue with the specified number of workers
func NewJobQueue(workerCount int) *JobQueue {
	q := &JobQueue{
		queue:       make(chan Job, 100), // Buffer size of 100 jobs
		workerCount: workerCount,
	}

	// Start workers
	for i := 0; i < workerCount; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}

	return q
}

// worker processes jobs from the queue
func (q *JobQueue) worker(id int) {
	defer q.wg.Done()

	log.Printf("[WORKER-%d] Started", id)

	for job := range q.queue {
		// Update stats
		q.mu.Lock()
		q.runningJobs++
		q.mu.Unlock()

		// Execute the job
		startTime := time.Now()
		log.Printf("[WORKER-%d] Processing job", id)
		
		// Execute the job and handle panics
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[WORKER-%d] Panic in job execution: %v", id, r)
					q.mu.Lock()
					q.failedJobs++
					q.runningJobs--
					q.totalProcessed++
					q.mu.Unlock()
				}
			}()
			
			job.Execute()
		}()

		// Update stats if no panic occurred
		q.mu.Lock()
		q.completedJobs++
		q.runningJobs--
		q.totalProcessed++
		q.mu.Unlock()

		log.Printf("[WORKER-%d] Job completed in %v", id, time.Since(startTime))
	}

	log.Printf("[WORKER-%d] Stopped", id)
}

// AddJob adds a job to the queue
func (q *JobQueue) AddJob(job Job) {
	q.queue <- job
}

// GetStats returns statistics about the job queue
func (q *JobQueue) GetStats() models.QueueStats {
	q.mu.Lock()
	defer q.mu.Unlock()

	return models.QueueStats{
		QueueLength:    len(q.queue),
		RunningJobs:    q.runningJobs,
		CompletedJobs:  q.completedJobs,
		FailedJobs:     q.failedJobs,
		TotalProcessed: q.totalProcessed,
	}
}

// Shutdown stops the job queue
func (q *JobQueue) Shutdown() {
	close(q.queue)
	q.wg.Wait()
}
