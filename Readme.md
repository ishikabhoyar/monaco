# Monaco Online Code Compiler

A full-featured online code compiler with a VS Code-like interface. This project allows users to write, edit, and execute code in multiple programming languages directly in the browser.

## Features

- **VS Code-like Interface**: Familiar editor experience with syntax highlighting, tabs, and file explorer
- **Multi-language Support**: Run code in Python, JavaScript, Go, Java, C, and C++
- **Input/Output Handling**: Enter input for your programs and see the output in real-time
- **Secure Execution**: Code runs in isolated Docker containers on the backend
- **File Management**: Create, edit, and organize files and folders

## Project Structure

- **Frontend**: React-based UI with Monaco Editor
- **Backend**: Go-based code execution service with Docker integration
  - HTTP Handlers (internal/api/handlers): Processes API requests
  - Execution Service (internal/executor): Manages code execution in containers
  - Job Queue (internal/queue): Handles concurrent execution of code submissions
  - Submission Model (internal/models): Defines the data structure for code submissions

## Getting Started

### Prerequisites

- Node.js 18+ for the frontend
- Go 1.22+ for the backend
- Docker for code execution

### Running the Frontend

```bash
cd Frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

### Running the Backend

```bash
cd backend
go build -o monaco ./cmd/server
./monaco
```

The backend API will be available at http://localhost:8080

## Using the Online Compiler

1. **Create a File**: Click the "+" button in the editor tabs or use the file explorer
2. **Write Code**: Use the Monaco editor to write your code
3. **Run Code**: Click the "Play" button in the top right corner
4. **Enter Input**: If your program requires input, enter it in the terminal panel
5. **View Output**: See the execution results in the terminal panel

## Supported Languages

- **Python** (.py)
- **JavaScript** (.js)
- **Go** (.go)
- **Java** (.java)
- **C** (.c)
- **C++** (.cpp)

## Examples

### Python

```python
name = input("Enter your name: ")
print(f"Hello, {name}!")
for i in range(5):
    print(f"Count: {i}")
```

### JavaScript

```javascript
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your name: ', (name) => {
  console.log(`Hello, ${name}!`);
  for (let i = 0; i < 5; i++) {
    console.log(`Count: ${i}`);
  }
  rl.close();
});
```

### Go

```go
package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
)

func main() {
    fmt.Print("Enter your name: ")
    reader := bufio.NewReader(os.Stdin)
    name, _ := reader.ReadString('\n')
    name = strings.TrimSpace(name)
    fmt.Printf("Hello, %s!\n", name)
    for i := 0; i < 5; i++ {
        fmt.Printf("Count: %d\n", i)
    }
}
```

## Security Considerations

- All code is executed in isolated Docker containers
- Network access is disabled
- Memory and CPU limits are enforced
- Execution timeouts prevent infinite loops