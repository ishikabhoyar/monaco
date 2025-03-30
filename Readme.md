# Monaco Code Execution Engine

Monaco is a secure, containerized code execution engine that allows you to run code in multiple programming languages through a simple REST API and WebSocket connections for real-time terminal interaction.

## Features

- **Multi-language support**: Run code in Python, Java, C, and C++
- **Secure execution**: All code runs in isolated Docker containers
- **Resource limits**: Memory, CPU, and file descriptor limits to prevent abuse
- **Concurrent processing**: Efficient job queue for handling multiple requests
- **Simple REST API**: Easy to integrate with any frontend
- **Interactive terminal**: Real-time code execution with input/output via WebSockets
- **VS Code-like interface**: Modern editor with syntax highlighting and file management

## Architecture

Monaco consists of several components:

### Backend Components

- **HTTP Handlers** (`handler/handler.go`): Processes API requests and WebSocket connections
- **Execution Service** (`service/execution.go`): Manages code execution in containers
- **Job Queue** (`queue/queue.go`): Handles concurrent execution of code submissions
- **Submission Model** (`model/submission.go`): Defines the data structure for code submissions

### Frontend Components

- **Editor Area** (`EditorArea.jsx`): Main code editor with Monaco editor integration
- **Terminal Panel** (`Panel.jsx`): Interactive terminal for code execution and input
- **Sidebar** (`Sidebar.jsx`): File explorer and project structure navigation
- **Status Bar** (`StatusBar.jsx`): Information display and quick actions

### Communication Flow

1. Frontend submits code to backend via REST API
2. Backend assigns a unique ID and queues the execution
3. Frontend connects to WebSocket endpoint with the execution ID
4. Backend sends real-time execution output through WebSocket
5. Frontend can send user input back through WebSocket
6. Results are stored and retrievable via REST endpoints

## Requirements

- **Backend**:
  - Go 1.22.3 or higher
  - Docker
  - Network connectivity for container image pulling
- **Frontend**:
  - Node.js and npm/yarn
  - Modern web browser

## Installation

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/arnab-afk/monaco.git
   cd monaco/backend

2.Install Go dependencies:

```bash
    go mod download
```

3.Build the application:
```bash
go build -o monaco
```

4.Run the service
```bash
    ./monaco
```

The backend service will start on port 8080 by default.

### Frontend Setup
1. Navigate to the Frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables: Create a ```.env``` or ```.env.local.``` file with:
```bash
VITE_API_URL=http://localhost:8080
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:5173 by default.

### API Reference

### REST Endpoints
```POST /submit```

Submits code for execution
```json
{
  "language": "python",
  "code": "print('Hello, World!')",
  "input": ""
}
```

Response:
```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1"
}
```

```GET /status?id={submissionId}```

Checks the status of submission:
```json
{
  "id": "6423259c-ee14-c5aa-1c90-d5e989f92aa1", 
  "status": "completed",
  "queuedAt": "2025-03-25T14:30:00Z",
  "startedAt": "2025-03-25T14:30:01Z",
  "completedAt": "2025-03-25T14:30:02Z",
  "executionTime": 1000
}
```

```GET /result?id={submissionId}```

Gets the execution result of a submission.

Response:
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

```GET /queue-stats```
Gets the statistics about the job queue.

Response:
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

### WebSocket Endpoints
```ws://localhost:8080/ws/terminal?id={submissionId}```

Establishes a real-time connection for terminal interaction.

- The server sends execution output as plain text messages.
- The client can send input as plain text messages (with newline).
- Connection automatically closes when execution completes or fails.

### Terminal Input Handling
The system supports interactive programs requiring user input:

1. The frontend detects possible input prompts by looking for patterns
2. When detected, it focuses the terminal and allows user input
3. User input is captured in the terminal component's inputBuffer
4. When the user presses Enter, the input is:
    - Sent to the backend via WebSocket.
    - Displayed in the terminal.
    - Buffer is cleared for next input.
5. The input is processed by the running program in real-time.


Troubleshooting tips:

- Ensure WebSocket connection is established before sending input
- Check for WebSocket errors in console
- Verify input reaches the backend by checking server logs
- Ensure newline characters are properly appended to input.

### Language Support
### Python
- **Version**: Python 3.9
- **Input Handling**: Direct stdin piping
- **Limitations**: No file I/O, no package imports outside standard library
- **Resource Limits**: 100MB memory, 10% CPU
### Java
- **Version**: Java 11 (Eclipse Temurin)
- **Class Detection**: Extracts class name from code using regex.
- **Memory Settings**: 64MB min heap, 256MB max heap
- **Resource Limits**: 400MB memory, 50% CPU
C
- **Version**: Latest GCC
- **Compilation Flags**: Default GCC settings
- **Resource Limits**: 100MB memory, 10% CPU

### C++
- **Version**: Latest G++
- **Standard**: C++17
- **Resource Limits**: 100MB memory, 10% CPU

### Security Considerations
All code execution happens within isolated Docker containers with:

- No network access (```--network=none```)
- Limited CPU and memory resources
- Limited file system access
- No persistent storage
- Execution time limits (10-15 seconds)

### Debugging
Check backend logs for execution details
Use browser developer tools to debug WebSocket connections
Terminal panel shows WebSocket connection status and errors
Check Docker logs for container-related issues.

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

