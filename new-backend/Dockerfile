FROM golang:1.19-alpine AS builder

# Install git and required dependencies
RUN apk update && apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-s -w" -o monaco-backend .

# Use a smaller image for the final container
FROM alpine:latest

# Install Docker client (required for container-in-container execution)
RUN apk update && apk add --no-cache docker-cli

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from builder
COPY --from=builder /app/monaco-backend /monaco-backend

# Use non-root user
USER appuser

# Run the binary
ENTRYPOINT ["/monaco-backend"]
