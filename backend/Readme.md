# Monaco Backend - Code Execution Service

## Table of Contents

1. Introduction
2. Architecture
3. Installation
4. API Reference
5. Code Execution
6. Job Queue System
7. Language Support
8. Security Considerations
9. Configuration
10. Testing
11. Performance Tuning
12. Troubleshooting

## Introduction

Monaco is a secure, containerized code execution backend service designed to run user-submitted code in multiple programming languages. It features a job queue system to manage execution resources, containerized execution environments for security, and a RESTful API for submission and monitoring.

**Key Features:**
- Multi-language support (Python, Java, C, C++)
- Secure containerized execution using Docker
- Resource limiting to prevent abuse
- Job queuing for managing concurrent executions
- Detailed execution statistics and monitoring
- Support for user input via stdin
- CORS support for browser-based clients

## Architecture

### Component Overview

Monaco follows a layered architecture with the following key components:

1. **HTTP Handlers** (handler package) - Processes incoming HTTP requests
2. **Execution Service** (service package) - Manages code execution in containers
3. **Job Queue** (queue package) - Controls concurrent execution
4. **Data Models** (model package) - Defines data structures

### Request Flow

1. Client submits code via `/submit` endpoint
2. Request is validated and assigned a unique ID
3. Submission is added to the job queue
4. Worker picks job from queue when available
5. Code is executed in appropriate Docker container
6. Results are stored and available via `/result` endpoint

### Dependency Diagram

```
Client Request → HTTP Handlers → Execution Service → Job Queue → Docker Containers
                                     ↑
                                Data Models
```

## Installation

### Prerequisites

- Go 1.22+ 
- Docker Engine
- Docker images for supported languages:
  - `python:3.9`
  - `eclipse-temurin:11-jdk-alpine`
  - `gcc:latest`

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/arnab-afk/monaco.git
   cd monaco/backend
   ```

2. Install Go dependencies:
   ```bash
   go mod download
   ```

3. Build the application:
   ```bash
   go build -o monaco main.go
   ```

4. Run the service:
   ```bash
   ./monaco
   ```

The service will start on port 8080 by default.

## API Reference

### Endpoints

#### `POST /submit`

Submits code for execution.

**Request Body:**
```json
{
  "language": "python",  // Required: "python", "java", "c", or "cpp"
  "code": "print('Hello, World!')",  // Required: source code to execute
  "input": "optional input string"  // Optional: input to stdin
}
```

**Response:**
```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1"  // Unique ID for this submission
}
```

**Status Codes:**
- 202 Accepted - Code accepted for execution
- 400 Bad Request - Invalid request (e.g., unsupported language)

#### `GET /status?id={submissionId}`

Checks the status of a submission.

**Response:**
```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1", 
  "status": "completed",  // "pending", "queued", "running", "completed", "failed"
  "queuedAt": "2025-03-25T14:30:00Z",
  "startedAt": "2025-03-25T14:30:01Z",  // Only present if status is "running", "completed", or "failed"
  "completedAt": "2025-03-25T14:30:02Z", // Only present if status is "completed" or "failed"
  "executionTime": 1000  // Execution time in milliseconds (only if completed)
}
```

**Status Codes:**
- 200 OK - Status retrieved successfully
- 400 Bad Request - Missing ID parameter
- 404 Not Found - Submission with given ID not found

#### `GET /result?id={submissionId}`

Gets the execution result of a submission.

**Response:**
```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1",
  "status": "completed",
  "language": "python",
  "output": "Hello, World!",
  "queuedAt": "2025-03-25T14:30:00Z",
  "startedAt": "2025-03-25T14:30:01Z",
  "completedAt": "2025-03-25T14:30:02Z",
  "executionTime": 1000,
  "executionTimeFormatted": "1.0s",
  "totalTime": 2000,
  "totalTimeFormatted": "2.0s"
}
```

**Status Codes:**
- 200 OK - Result retrieved successfully
- 400 Bad Request - Missing ID parameter
- 404 Not Found - Submission with given ID not found

#### `GET /queue-stats`

Gets statistics about the job queue.

**Response:**
```json
{
  "queue_stats": {
    "queue_length": 5,
    "max_workers": 3,
    "running_jobs": 3
  },
  "submissions": 42
}
```

## Code Execution

### Execution Process

1. **Language Detection**: The system identifies the programming language of the submission.
2. **Environment Setup**: A temporary directory is created for compiled languages.
3. **Container Setup**: Docker containers are configured with resource limits.
4. **Compilation**: For compiled languages (Java, C, C++), code is compiled first.
5. **Execution**: The program is executed with the provided input.
6. **Resource Monitoring**: Memory and CPU usage are limited during execution.
7. **Result Collection**: Output and errors are captured and stored.

### Language-Specific Processing

#### Python
- Directly executes Python code using the `-c` flag
- Uses `python:3.9` Docker image
- Resource limits: 100MB memory, 10% CPU

#### Java
- Detects class name using regex pattern matching
- Compiles with `javac` and runs with optimized JVM settings
- Uses `eclipse-temurin:11-jdk-alpine` Docker image
- Resource limits: 400MB memory, 50% CPU
- JVM flags: `-XX:+TieredCompilation`, `-XX:TieredStopAtLevel=1`, `-Xverify:none`

#### C/C++
- Saves code to a file in a temporary directory
- Compiles with `gcc`/`g++` and runs the executable
- Uses `gcc:latest` Docker image
- Resource limits: 100MB memory, 10% CPU

### Timeout Handling

All executions have a timeout limit:
- Python: 10 seconds
- Java: 15 seconds
- C/C++: 10 seconds

If execution exceeds this limit, the process is killed and an error is returned.

## Job Queue System

### Worker Pool

Monaco uses a worker pool to manage concurrent code executions:

- Default pool size: 20 workers (configurable)
- Maximum queue capacity: 100 jobs
- FIFO (First-In-First-Out) processing order

### Job Lifecycle

1. **Creation**: Job created when code is submitted
2. **Queuing**: Job added to queue with `queued` status
3. **Execution**: Worker picks job from queue and changes status to `running`
4. **Completion**: Job finishes with either `completed` or `failed` status

### Performance Metrics

The queue tracks and reports:
- Current queue length
- Number of running jobs
- Maximum worker count
- Total number of submissions

## Language Support

### Python
- **Version**: Python 3.9
- **Input Handling**: Direct stdin piping
- **Limitations**: No file I/O, no package imports outside standard library

### Java
- **Version**: Java 11 (Eclipse Temurin)
- **Class Detection**: Extracts class name from code using regex
- **Memory Settings**: 64MB min heap, 256MB max heap
- **Best Practices**: Use `public class` with the main method

### C
- **Version**: Latest GCC
- **Compilation Flags**: Default GCC settings
- **Execution**: Compiled binary

### C++
- **Version**: Latest G++
- **Standard**: C++17
- **Execution**: Compiled binary

## Security Considerations

### Containerization

All code execution happens within isolated Docker containers with:
- No network access (`--network=none`)
- Limited CPU and memory resources
- Limited file system access
- No persistent storage

### Resource Limiting

- **Memory Limits**: 100-400MB depending on language
- **CPU Limits**: 10-50% of CPU depending on language
- **File Descriptors**: Limited to 64 for Python
- **Execution Time**: Enforced timeouts (10-15 seconds)

### Known Limitations

- Container escape vulnerabilities
- Docker daemon security depends on host configuration
- Resource limits can be circumvented with certain techniques

## Configuration

The service can be configured through environment variables:

- `PORT`: HTTP port (default: 8080)
- `MAX_WORKERS`: Maximum concurrent executions (default: 3)
- `QUEUE_SIZE`: Maximum queue size (default: 100)
- `DEFAULT_LANGUAGE`: Default language if none specified (default: "python")

## Testing

### Unit Tests

Run unit tests with:
```bash
go test ./...
```

# Monaco Backend Test Plan

## Overview
This test plan outlines the testing approach for the Monaco code execution backend service.

## Test Environment
- Development: Local workstations with Docker and Go
- Testing: Dedicated test server with Docker
- Production-like: Staging environment with similar resources to production

## Test Types

### Unit Tests
- **Purpose**: Verify individual components work as expected
- **Components to Test**:
  - Handler package
  - Queue package
  - Execution service
  - Models
- **Tools**: Go testing framework

### Integration Tests
- **Purpose**: Verify components work together correctly
- **Focus Areas**:
  - API endpoints
  - End-to-end code execution flow
  - Error handling
- **Tools**: Go testing framework, HTTP test utilities

### Load Tests
- **Purpose**: Verify system performance under load
- **Scenarios**:
  - Concurrent submissions
  - Mixed language workloads
  - Queue saturation
- **Metrics**:
  - Request throughput
  - Response times
  - Success rates
  - Resource utilization
- **Tools**: Custom Python test scripts

## Test Data
- Simple programs in each language
- Programs with input requirements
- Programs with compile errors
- Programs with runtime errors
- Programs with timeouts

## Test Execution
1. Run unit tests on every code change
2. Run integration tests before merging to main branch
3. Run load tests weekly and before major releases

## Success Criteria
- All unit tests pass
- Integration tests complete successfully
- Load tests show acceptable performance metrics:
  - 95% of requests complete successfully
  - 95th percentile response time < 5 seconds
  - System can handle 20 concurrent users

## Reporting
- Test results stored in CI/CD pipeline
- Performance metrics graphed over time
- Issues logged in GitHub issues

### Load Testing

A Python script (`test.py`) is included for load testing:
```bash
python test.py
```

This script sends 500 requests concurrently and reports performance metrics.

### Manual Testing with Curl

#### Python Example
```bash
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello, World!\")\nfor i in range(5):\n    print(f\"Number: {i}\")",
    "input": ""
  }'
```

#### Java Example
```bash
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "java",
    "code": "public class Solution {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n        for (int i = 0; i < 5; i++) {\n            System.out.println(\"Number: \" + i);\n        }\n    }\n}",
    "input": ""
  }'
```

## Performance Tuning

### Optimizing Worker Count

The optimal worker count depends on:
- CPU cores available
- Memory available
- Docker container startup time

For most single-server deployments, 3-5 workers is optimal.

### Memory Considerations

Each language has different memory requirements:
- Python: ~50-100MB per instance
- Java: ~200-400MB per instance
- C/C++: ~50-100MB per instance

Calculate total memory needs as: `(Python instances × 100MB) + (Java instances × 400MB) + (C/C++ instances × 100MB)`

### Disk Space Management

Temporary files are cleaned up after execution, but with high request volumes, ensure adequate disk space for concurrent operations (approximately 1-5MB per request for compiled languages).

## Troubleshooting

### Common Issues

#### Docker Connection Errors
```
Error: Cannot connect to the Docker daemon
```
**Solution**: Ensure Docker daemon is running with `systemctl start docker` or `docker --version`

#### Permissions Issues
```
Error: Permission denied while trying to connect to the Docker daemon socket
```
**Solution**: Add user to docker group: `sudo usermod -aG docker $USER`

#### Container Resource Limits
```
Error: Container killed due to memory limit
```
**Solution**: Increase memory limits in execution service or optimize submitted code

#### File Not Found Errors
```
Error: Failed to write Java file
```
**Solution**: Check temporary directory permissions and disk space

### Logs

The service provides structured logs with prefixes for easier filtering:
- `[HTTP]` - API requests
- `[QUEUE]` - Queue operations
- `[WORKER-n]` - Worker activities
- `[EXEC-id]` - Execution details
- `[PYTHON/JAVA/C/CPP-id]` - Language-specific logs
- `[TIMEOUT-id]` - Timeout events
- `[RESULT-id]` - Execution results

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
