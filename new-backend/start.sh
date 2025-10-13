#!/bin/sh
# Start the backend
/monaco-backend &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Start cloudflared tunnel using config file
echo "Starting Cloudflare tunnel to api.ishikabhoyar.tech..."
cloudflared tunnel --no-autoupdate run --config /etc/cloudflared/config.json

# If cloudflared exits, kill the backend too
kill $BACKEND_PID
