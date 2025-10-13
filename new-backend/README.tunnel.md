# Backend with Cloudflare Tunnel

This setup runs the Monaco backend service and establishes a Cloudflare tunnel, exposing the service to the internet securely via api.ishikabhoyar.tech.

## Prerequisites

- Docker and Docker Compose installed
- The Cloudflare tunnel certificate (cert.pem) in the same directory as the Dockerfile.tunnel

## Files

- `Dockerfile.tunnel`: Dockerfile that builds the backend and sets up Cloudflare tunnel
- `cert.pem`: Cloudflare tunnel certificate
- `config.json`: Cloudflare tunnel configuration that routes traffic to api.ishikabhoyar.tech
- `docker-compose.tunnel.yml`: Docker Compose configuration for easy deployment

## How to Run

```bash
# Build and start the container
docker-compose -f docker-compose.tunnel.yml up -d

# Check logs
docker-compose -f docker-compose.tunnel.yml logs -f
```

## How it Works

1. The Dockerfile builds the Go backend application
2. It installs the Cloudflare tunnel client (cloudflared)
3. On container start:
   - The backend server starts on port 8080
   - The Cloudflare tunnel connects to Cloudflare's edge network using the config.json
   - External traffic to api.ishikabhoyar.tech is routed through the tunnel to the backend
   - The cloudflared runs entirely within the container, isolated from any host cloudflared instance

## Environment Variables

You can customize the behavior by modifying the environment variables in the docker-compose.tunnel.yml file:

- `PORT`: The port the backend server listens on (default: 8080)
- `CONCURRENT_EXECUTIONS`: Number of concurrent code executions (default: 5)
- `QUEUE_CAPACITY`: Maximum queue capacity for code executions (default: 100)
- `DEFAULT_TIMEOUT`: Default timeout for code execution in seconds (default: 30)
- `SANDBOX_NETWORK_DISABLED`: Whether to disable network in sandbox containers (default: true)
- `SANDBOX_PIDS_LIMIT`: Process ID limit for sandbox containers (default: 50)
