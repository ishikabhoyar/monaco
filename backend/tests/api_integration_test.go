package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/arnab-afk/monaco/handler"
	"github.com/stretchr/testify/assert"
)

func setupTestServer() *httptest.Server {
	h := handler.NewHandler()

	mux := http.NewServeMux()
	mux.HandleFunc("/submit", h.SubmitHandler)
	mux.HandleFunc("/status", h.StatusHandler)
	mux.HandleFunc("/result", h.ResultHandler)
	mux.HandleFunc("/queue-stats", h.QueueStatsHandler)

	return httptest.NewServer(mux)
}

func TestAPIIntegration(t *testing.T) {
	server := setupTestServer()
	defer server.Close()

	// Test: Submit code, check status, and get results
	// 1. Submit a Python job
	submitURL := server.URL + "/submit"
	body := map[string]string{
		"language": "python",
		"code":     "print('Hello, Integration Test!')",
	}

	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(submitURL, "application/json", bytes.NewReader(bodyBytes))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusAccepted, resp.StatusCode)

	// Get the job ID
	var submitResp map[string]string
	json.NewDecoder(resp.Body).Decode(&submitResp)
	resp.Body.Close()

	jobID := submitResp["id"]
	assert.NotEmpty(t, jobID)

	// 2. Check status
	statusURL := server.URL + "/status?id=" + jobID

	// Wait for job to complete (try multiple times)
	var statusResp map[string]interface{}
	maxRetries := 10

	for i := 0; i < maxRetries; i++ {
		resp, err = http.Get(statusURL)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		json.NewDecoder(resp.Body).Decode(&statusResp)
		resp.Body.Close()

		// If job completed or failed, break
		status, _ := statusResp["status"].(string)
		if status == "completed" || status == "failed" {
			break
		}

		// Wait before next retry
		time.Sleep(200 * time.Millisecond)
	}

	// 3. Get results
	resultURL := server.URL + "/result?id=" + jobID
	resp, err = http.Get(resultURL)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var resultResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&resultResp)
	resp.Body.Close()

	assert.Equal(t, jobID, resultResp["id"])
	assert.Contains(t, resultResp["output"], "Hello, Integration Test!")

	// 4. Check queue stats
	statsURL := server.URL + "/queue-stats"
	resp, err = http.Get(statsURL)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var statsResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&statsResp)
	resp.Body.Close()

	assert.Contains(t, statsResp, "queue_stats")
	assert.Contains(t, statsResp, "submissions")
}

func TestMultipleLanguageSubmissions(t *testing.T) {
	server := setupTestServer()
	defer server.Close()

	// Test submissions for different languages
	languages := []string{"python", "java", "c", "cpp"}
	codes := map[string]string{
		"python": "print('Hello from Python')",
		"java":   "public class Solution { public static void main(String[] args) { System.out.println(\"Hello from Java\"); } }",
		"c":      "#include <stdio.h>\nint main() { printf(\"Hello from C\\n\"); return 0; }",
		"cpp":    "#include <iostream>\nint main() { std::cout << \"Hello from C++\" << std::endl; return 0; }",
	}

	submitURL := server.URL + "/submit"

	for _, lang := range languages {
		body := map[string]string{
			"language": lang,
			"code":     codes[lang],
		}

		bodyBytes, _ := json.Marshal(body)
		resp, err := http.Post(submitURL, "application/json", bytes.NewReader(bodyBytes))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusAccepted, resp.StatusCode)

		var submitResp map[string]string
		json.NewDecoder(resp.Body).Decode(&submitResp)
		resp.Body.Close()

		jobID := submitResp["id"]
		assert.NotEmpty(t, jobID)

		// We don't wait for completion in this test
		// This is just to verify submission acceptance for all languages
	}
}

func TestInputHandling(t *testing.T) {
	server := setupTestServer()
	defer server.Close()

	// Test code submission with input
	submitURL := server.URL + "/submit"
	body := map[string]string{
		"language": "python",
		"code":     "name = input('Enter name: ')\nprint('Hello, ' + name + '!')",
		"input":    "Integration Test",
	}

	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(submitURL, "application/json", bytes.NewReader(bodyBytes))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusAccepted, resp.StatusCode)

	var submitResp map[string]string
	json.NewDecoder(resp.Body).Decode(&submitResp)
	resp.Body.Close()

	jobID := submitResp["id"]
	assert.NotEmpty(t, jobID)

	// Wait for job to complete and check result
	resultURL := server.URL + "/result?id=" + jobID

	// Poll for results
	var resultResp map[string]interface{}
	maxRetries := 10

	for i := 0; i < maxRetries; i++ {
		time.Sleep(300 * time.Millisecond)

		resp, err = http.Get(resultURL)
		assert.NoError(t, err)

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}

		json.NewDecoder(resp.Body).Decode(&resultResp)
		resp.Body.Close()

		status, _ := resultResp["status"].(string)
		if status == "completed" || status == "failed" {
			break
		}
	}

	// Verify output contains the greeting with input
	assert.Contains(t, resultResp["output"], "Hello, Integration Test!")
}
