# Quick Start - Tunnel Only Mode

## What This Does
- Runs **only** the Cloudflare tunnel in Docker
- Your backend runs **outside Docker** on port 9090
- Tunnel forwards traffic from `api.ishikabhoyar.tech` to your local backend

## Quick Start

### Step 1: Start your backend on port 9090
```bash
PORT=9090 go run main.go
```

### Step 2: Start the tunnel

**Windows (PowerShell):**
```powershell
.\start-tunnel-only.ps1
```

**Linux/Mac:**
```bash
chmod +x start-tunnel-only.sh
./start-tunnel-only.sh
```

**Or manually:**
```bash
docker-compose -f docker-compose.tunnel-only.yml up --build
```

## Files Created

1. **Dockerfile.tunnel-only** - Lightweight Docker image with only cloudflared
2. **docker-compose.tunnel-only.yml** - Docker Compose config for tunnel only
3. **config.tunnel-only.json** - Cloudflare tunnel config pointing to port 9090
4. **start-tunnel-only.ps1** - PowerShell helper script
5. **start-tunnel-only.sh** - Bash helper script
6. **README.tunnel-only.md** - Detailed documentation

## Test It

1. Start backend: `PORT=9090 go run main.go`
2. Start tunnel: `docker-compose -f docker-compose.tunnel-only.yml up --build`
3. Test: `curl https://api.ishikabhoyar.tech`

## Stop

```bash
docker-compose -f docker-compose.tunnel-only.yml down
```

## Troubleshooting

**Backend not reachable?**
- Check backend is running: `curl http://localhost:9090`
- Check tunnel logs: `docker-compose -f docker-compose.tunnel-only.yml logs -f`

**Tunnel not connecting?**
- Verify credentials.json and cert.pem are valid
- Check Cloudflare dashboard

## Original Files (Unchanged)

The original tunnel setup files are still available:
- `Dockerfile.tunnel` - Backend + Tunnel in one container
- `docker-compose.tunnel.yml` - Original compose file
- These files still point to port 8080
