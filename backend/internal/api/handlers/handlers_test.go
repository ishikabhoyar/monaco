package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSubmitHandler(t *testing.T) {
	h := NewHandler()

	// Create a test request
	reqBody := map[string]string{
		"language": "python",
		"code":     "print('Hello, World!')",
		"input":    "",
	}
	reqJSON, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", "/submit", bytes.NewBuffer(reqJSON))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler
	h.SubmitHandler(rr, req)

	// Check the status code
	assert.Equal(t, http.StatusAccepted, rr.Code)

	// Check the response body
	var response map[string]string
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "id")
	assert.NotEmpty(t, response["id"])
}

func TestHealthCheckHandler(t *testing.T) {
	h := NewHandler()

	// Create a test request
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a response recorder
	rr := httptest.NewRecorder()

	// Call the handler
	h.HealthCheckHandler(rr, req)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Contains(t, response, "timestamp")
}
