# Monaco Backend - Tunnel Only Setup

This setup runs **only the Cloudflare tunnel** in Docker, while the backend runs **outside Docker on port 9090**.

## Prerequisites

1. Backend must be running on port 9090 on your local machine
2. Required files in this directory:
   - `cert.pem` - Cloudflare tunnel certificate
   - `credentials.json` - Cloudflare tunnel credentials
   - `config.tunnel-only.json` - Tunnel configuration (points to port 9090)

## Setup

### 1. Start your backend on port 9090

Run your Go backend locally:
```bash
# Option 1: Run directly
PORT=9090 go run main.go

# Option 2: Build and run
go build -o main
PORT=9090 ./main
```

### 2. Start the tunnel

In this directory, run:
```bash
docker-compose -f docker-compose.tunnel-only.yml up --build
```

Or run in detached mode:
```bash
docker-compose -f docker-compose.tunnel-only.yml up --build -d
```

### 3. Check logs

```bash
docker-compose -f docker-compose.tunnel-only.yml logs -f
```

## How It Works

1. The tunnel container runs only `cloudflared`
2. It connects to Cloudflare's edge network
3. Traffic from `api.ishikabhoyar.tech` is routed through the tunnel
4. The tunnel forwards requests to `host.docker.internal:9090` (your local backend)
5. Your backend on port 9090 handles the requests and sends responses back

## Configuration

The tunnel is configured in `config.tunnel-only.json`:
```json
{
  "tunnel": "5d2682ef-0b5b-47e5-b0fa-ad48968ce016",
  "credentials-file": "/etc/cloudflared/credentials.json",
  "ingress": [
    {
      "hostname": "api.ishikabhoyar.tech",
      "service": "http://host.docker.internal:9090"
    },
    {
      "service": "http_status:404"
    }
  ],
  "protocol": "http2",
  "loglevel": "info"
}
```

## Troubleshooting

### Tunnel can't reach backend
- Make sure your backend is running on port 9090
- Test locally: `curl http://localhost:9090`
- Check firewall settings

### Tunnel connection issues
- Verify `credentials.json` and `cert.pem` are valid
- Check tunnel status in Cloudflare dashboard
- Review logs: `docker-compose -f docker-compose.tunnel-only.yml logs -f`

### DNS not resolving
- DNS routing should be set up during first build
- Verify in Cloudflare dashboard under Zero Trust > Networks > Tunnels

## Stop the tunnel

```bash
docker-compose -f docker-compose.tunnel-only.yml down
```

## Architecture

```
Internet
   ↓
Cloudflare Edge (api.ishikabhoyar.tech)
   ↓
Cloudflare Tunnel (in Docker)
   ↓
host.docker.internal:9090
   ↓
Your Backend (running locally)
```

## Notes

- The tunnel only forwards traffic; it doesn't run the backend
- Backend must be started before or after the tunnel (order doesn't matter)
- If backend restarts, tunnel will automatically reconnect
- Port 9090 is not exposed to the internet, only accessible via the tunnel
