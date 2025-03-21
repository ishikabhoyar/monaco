# Monaco Code Execution Engine
Monaco is a secure, containerized code execution engine that allows you to run code in multiple programming languages through a simple REST API.

## Features
- Multi-language support: Run code in Python, Java, C, and C++
- Secure execution: All code runs in isolated Docker containers
- Resource limits: Memory, CPU, and file descriptor limits to prevent abuse
- Concurrent processing: Efficient job queue for handling multiple requests
- Simple REST API: Easy to integrate with any frontend

## Architecture
Monaco consists of several components:

- HTTP Handlers (handler/handler.go): Processes API requests
- Execution Service (service/execution.go): Manages code execution in containers
- Job Queue (queue/queue.go): Handles concurrent execution of code submissions
- Submission Model (model/submission.go): Defines the data structure for code submissions

## Requirements
- Go 1.22.3 or higher
- Docker
- Network connectivity for container image pulling