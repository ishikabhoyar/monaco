# Tunnel Connection Options - Troubleshooting Guide

## The Problem
When the tunnel runs in Docker and tries to reach your backend on the host, there are different ways to address the host machine. The method that works depends on your Docker setup.

## Solution 1: Direct Bridge IP (config.tunnel-only.json) ✅ WORKING

**Files:** 
- `Dockerfile.tunnel-only`
- `docker-compose.tunnel-only.yml`
- `config.tunnel-only.json` (updated to use `172.18.0.1:9090`)

**How it works:**
- Uses the Docker bridge network IP directly
- You verified this works: `curl 172.18.0.1:9090` ✅

**Usage:**
```bash
docker-compose -f docker-compose.tunnel-only.yml up --build
```

**Config:**
```json
"service": "http://172.18.0.1:9090"
```

## Solution 2: Host Network Mode (NEW - Recommended for Linux)

**Files:**
- `Dockerfile.tunnel-only-v2`
- `docker-compose.tunnel-only-v2.yml`
- `config.tunnel-only-v2.json` (uses `localhost:9090`)

**How it works:**
- Container runs in host network mode
- Can access `localhost:9090` directly as if running on host

**Usage:**
```bash
docker-compose -f docker-compose.tunnel-only-v2.yml up --build
```

**Config:**
```json
"service": "http://localhost:9090"
```

**Note:** Host network mode works best on Linux. May have limitations on Windows/Mac.

## Quick Test Guide

### 1. Rebuild and restart with updated config (Solution 1)
```bash
# Stop current tunnel
docker-compose -f docker-compose.tunnel-only.yml down

# Rebuild with updated config (now uses 172.18.0.1)
docker-compose -f docker-compose.tunnel-only.yml up --build
```

### 2. Or try host network mode (Solution 2)
```bash
docker-compose -f docker-compose.tunnel-only-v2.yml up --build
```

## Expected Success Output
```
INF Registered tunnel connection connIndex=0 connection=xxx event=0 ip=xxx location=bom protocol=http2
INF Registered tunnel connection connIndex=1 connection=xxx event=0 ip=xxx location=bom protocol=http2
INF Registered tunnel connection connIndex=2 connection=xxx event=0 ip=xxx location=bom protocol=http2
INF Registered tunnel connection connIndex=3 connection=xxx event=0 ip=xxx location=bom protocol=http2
```

**No "Unable to reach the origin service" errors!**

## Test the Connection

### From outside Docker (your current working test):
```bash
curl 172.18.0.1:9090
# Should return: Monaco Code Execution Server v1.0.0
```

### From the tunnel (once running):
```bash
# Test via the public URL
curl https://api.ishikabhoyar.tech
```

## Troubleshooting

### If Solution 1 still doesn't work:
1. Check if Docker bridge IP changed:
   ```bash
   docker network inspect bridge | grep Gateway
   ```
2. Update `config.tunnel-only.json` with the correct IP

### If Solution 2 doesn't work:
- Host network mode may not be fully supported on your OS
- Fall back to Solution 1 with correct bridge IP

### Check tunnel logs:
```bash
docker-compose -f docker-compose.tunnel-only.yml logs -f
```

### Verify backend is accessible from Docker:
```bash
docker run --rm alpine/curl:latest curl http://172.18.0.1:9090
```

## Summary

**Current Status:** ✅ Config updated to use `172.18.0.1:9090`

**Next Step:** Rebuild and restart the tunnel:
```bash
docker-compose -f docker-compose.tunnel-only.yml down
docker-compose -f docker-compose.tunnel-only.yml up --build
```

The tunnel should now successfully connect to your backend! 🎉
