package model

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCodeSubmissionSerialization(t *testing.T) {
	// Create a submission
	now := time.Now()
	submission := CodeSubmission{
		ID:          "test-id",
		Code:        "print('Hello, World!')",
		Language:    "python",
		Input:       "test input",
		Status:      "completed",
		QueuedAt:    now.Add(-2 * time.Second),
		StartedAt:   now.Add(-1 * time.Second),
		CompletedAt: now,
		Output:      "Hello, World!",
	}

	// Serialize to JSON
	jsonBytes, err := json.Marshal(submission)
	assert.NoError(t, err)
	assert.NotNil(t, jsonBytes)

	// Deserialize back
	var decoded CodeSubmission
	err = json.Unmarshal(jsonBytes, &decoded)
	assert.NoError(t, err)

	// Verify fields match
	assert.Equal(t, submission.ID, decoded.ID)
	assert.Equal(t, submission.Code, decoded.Code)
	assert.Equal(t, submission.Language, decoded.Language)
	assert.Equal(t, submission.Input, decoded.Input)
	assert.Equal(t, submission.Status, decoded.Status)
	assert.Equal(t, submission.Output, decoded.Output)

	// Time fields need special handling due to JSON serialization
	assert.Equal(t, submission.QueuedAt.Format(time.RFC3339), decoded.QueuedAt.Format(time.RFC3339))
	assert.Equal(t, submission.StartedAt.Format(time.RFC3339), decoded.StartedAt.Format(time.RFC3339))
	assert.Equal(t, submission.CompletedAt.Format(time.RFC3339), decoded.CompletedAt.Format(time.RFC3339))
}

func TestCodeSubmissionDefaults(t *testing.T) {
	// Test that zero time values work correctly
	submission := CodeSubmission{
		ID:       "test-id",
		Code:     "print('Hello')",
		Language: "python",
		Status:   "pending",
	}

	assert.True(t, submission.QueuedAt.IsZero())
	assert.True(t, submission.StartedAt.IsZero())
	assert.True(t, submission.CompletedAt.IsZero())

	// Test JSON marshaling with zero time values
	jsonBytes, err := json.Marshal(submission)
	assert.NoError(t, err)

	// The zero time values should still be included in the JSON
	jsonStr := string(jsonBytes)
	assert.Contains(t, jsonStr, `"id":"test-id"`)
	assert.Contains(t, jsonStr, `"status":"pending"`)
}
