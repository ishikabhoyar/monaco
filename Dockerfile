# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Define a build-time argument for the API URL with a default value
ARG VITE_API_URL=""
# Set it as an environment variable for the build command
ENV VITE_API_URL=$VITE_API_URL

# Copy package files and install dependencies
COPY Frontend/package.json Frontend/package-lock.json* Frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile

# Copy the rest of the frontend source code
COPY Frontend/ ./

# Build the static files. Vite will use the VITE_API_URL env var.
RUN yarn build

# Stage 2: Build the Go backend
FROM golang:1.19-alpine AS backend-builder
WORKDIR /app/backend

# Install git for dependency fetching
RUN apk update && apk add --no-cache git

# Copy go module files and download dependencies
COPY new-backend/go.mod new-backend/go.sum ./
RUN go mod download

# Copy the backend source code
COPY new-backend/ ./

# Build the Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-s -w" -o /monaco-backend .

# Stage 3: Create the final image with Nginx
FROM nginx:1.25-alpine

# Install Docker client for the backend
RUN apk update && apk add --no-cache docker-cli

# Copy the Go backend binary
COPY --from=backend-builder /monaco-backend /usr/local/bin/monaco-backend

# Copy the built frontend files to the Nginx html directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf  

# Expose the public port for Nginx
EXPOSE 80

# Start both the backend and Nginx
CMD sh -c 'monaco-backend & nginx -g "daemon off;"'