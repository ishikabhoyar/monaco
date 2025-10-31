#!/bin/bash

# Monaco Backend - Tunnel Only Runner
# This script helps you run the tunnel with backend on port 9090

echo "Monaco Backend - Tunnel Only Setup"
echo "===================================="
echo ""

# Check if required files exist
REQUIRED_FILES=("cert.pem" "credentials.json" "config.tunnel-only.json")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo "ERROR: Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "Please ensure all required files are present."
    exit 1
fi

echo "✓ All required files found"
echo ""

# Check if backend is running on port 9090
echo "Checking if backend is running on port 9090..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9090 > /dev/null 2>&1; then
    echo "✓ Backend is running on port 9090"
else
    echo "⚠ Backend doesn't appear to be running on port 9090"
    echo "  Make sure to start your backend with: PORT=9090 go run main.go"
fi
echo ""

# Start the tunnel
echo "Starting Cloudflare tunnel..."
echo "Command: docker-compose -f docker-compose.tunnel-only.yml up --build"
echo ""

docker-compose -f docker-compose.tunnel-only.yml up --build
