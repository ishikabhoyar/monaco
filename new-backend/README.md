# Monaco Code Execution Backend

A modern, secure, and efficient code execution backend inspired by online code editors like Programiz. This backend is written in Go and uses Docker containers for secure code execution.

## Features

- **Multi-language Support**: Execute code in Python, Java, C, C++, JavaScript, and Go
- **Real-time Output**: Stream code execution output via WebSockets
- **Interactive Input**: Send input to running programs via WebSockets
- **Secure Execution**: All code runs in isolated Docker containers
- **Resource Limits**: Memory, CPU, and execution time limits
- **Scalable Architecture**: Concurrent execution with configurable worker pools

## Requirements

- Go 1.19+
- Docker
- Git (for development)

## Getting Started

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/monaco.git
   cd monaco/new-backend
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Build and run:
   ```bash
   go run main.go
   ```

The server will start on `http://localhost:8080` by default.

### Using Docker

Build and run using Docker:

```bash
docker build -t monaco-backend .
docker run -p 8080:8080 -v /var/run/docker.sock:/var/run/docker.sock monaco-backend
```

Note: Mounting the Docker socket is necessary for container-in-container execution.

## API Endpoints

- `POST /api/submit`: Submit code for execution
- `GET /api/status/{id}`: Get execution status
- `GET /api/result/{id}`: Get complete execution result
- `GET /api/languages`: List supported languages
- `GET /api/health`: Health check endpoint
- `WS /api/ws/terminal/{id}`: WebSocket for real-time output

## WebSocket Communication

The `/api/ws/terminal/{id}` endpoint supports these message types:

- `output`: Code execution output
- `input`: User input to the program
- `input_prompt`: Input prompt detected
- `status`: Execution status updates
- `error`: Error messages

## Configuration

Configuration is handled through environment variables:

- `PORT`: Server port (default: 8080)
- `CONCURRENT_EXECUTIONS`: Number of concurrent executions (default: 5)
- `QUEUE_CAPACITY`: Execution queue capacity (default: 100)
- `DEFAULT_TIMEOUT`: Default execution timeout in seconds (default: 30)

See `config/config.go` for more configuration options.

## Security Considerations

- All code execution happens in isolated Docker containers
- Network access is disabled in execution containers
- Memory and CPU limits are enforced
- Process limits prevent fork bombs
- Execution timeouts prevent infinite loops

## License

MIT
