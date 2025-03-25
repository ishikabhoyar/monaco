package handler

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/arnab-afk/monaco/model"
    "github.com/stretchr/testify/assert"
)

func TestSubmitHandler(t *testing.T) {
    h := NewHandler()

    // Test valid Python submission
    body := map[string]string{
        "language": "python",
        "code":     "print('Hello, World!')",
    }
    bodyBytes, _ := json.Marshal(body)
    req := httptest.NewRequest("POST", "/submit", bytes.NewReader(bodyBytes))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()

    h.SubmitHandler(w, req)

    assert.Equal(t, http.StatusAccepted, w.Code)
    var response map[string]string
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)
    assert.NotEmpty(t, response["id"])

    // Test invalid language
    body["language"] = "invalid"
    bodyBytes, _ = json.Marshal(body)
    req = httptest.NewRequest("POST", "/submit", bytes.NewReader(bodyBytes))
    req.Header.Set("Content-Type", "application/json")
    w = httptest.NewRecorder()

    h.SubmitHandler(w, req)

    assert.Equal(t, http.StatusBadRequest, w.Code)
    assert.Contains(t, w.Body.String(), "Unsupported language")
}

func TestStatusHandler(t *testing.T) {
    h := NewHandler()

    // Create a test submission
    submission := &model.CodeSubmission{
        ID:        "test-id",
        Language:  "python",
        Code:      "print('Hello')",
        Status:    "completed",
        QueuedAt:  time.Now().Add(-2 * time.Second),
        StartedAt: time.Now().Add(-1 * time.Second),
        CompletedAt: time.Now(),
        Output:    "Hello",
    }

    h.submissions["test-id"] = submission

    // Test valid status request
    req := httptest.NewRequest("GET", "/status?id=test-id", nil)
    w := httptest.NewRecorder()

    h.StatusHandler(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)
    assert.Equal(t, "test-id", response["id"])
    assert.Equal(t, "completed", response["status"])

    // Test missing ID
    req = httptest.NewRequest("GET", "/status", nil)
    w = httptest.NewRecorder()

    h.StatusHandler(w, req)

    assert.Equal(t, http.StatusBadRequest, w.Code)
    assert.Contains(t, w.Body.String(), "ID is required")

    // Test non-existent ID
    req = httptest.NewRequest("GET", "/status?id=nonexistent", nil)
    w = httptest.NewRecorder()

    h.StatusHandler(w, req)

    assert.Equal(t, http.StatusNotFound, w.Code)
    assert.Contains(t, w.Body.String(), "Submission not found")
}

func TestResultHandler(t *testing.T) {
    h := NewHandler()

    // Create a test submission
    submission := &model.CodeSubmission{
        ID:        "test-id",
        Language:  "python",
        Code:      "print('Hello')",
        Status:    "completed",
        QueuedAt:  time.Now().Add(-2 * time.Second),
        StartedAt: time.Now().Add(-1 * time.Second),
        CompletedAt: time.Now(),
        Output:    "Hello",
    }

    h.submissions["test-id"] = submission

    // Test valid result request
    req := httptest.NewRequest("GET", "/result?id=test-id", nil)
    w := httptest.NewRecorder()

    h.ResultHandler(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)
    assert.Equal(t, "test-id", response["id"])
    assert.Equal(t, "completed", response["status"])
    assert.Equal(t, "Hello", response["output"])
}

func TestQueueStatsHandler(t *testing.T) {
    h := NewHandler()

    // Add some test submissions
    h.submissions["test-id1"] = &model.CodeSubmission{ID: "test-id1"}
    h.submissions["test-id2"] = &model.CodeSubmission{ID: "test-id2"}

    req := httptest.NewRequest("GET", "/queue-stats", nil)
    w := httptest.NewRecorder()

    h.QueueStatsHandler(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)
    
    stats, ok := response["queue_stats"].(map[string]interface{})
    assert.True(t, ok)
    assert.Contains(t, stats, "queue_length")
    assert.Contains(t, stats, "max_workers")
    assert.Contains(t, stats, "running_jobs")
    
    assert.Equal(t, float64(2), response["submissions"])
}