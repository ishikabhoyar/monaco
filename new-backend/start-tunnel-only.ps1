# Monaco Backend - Tunnel Only Runner
# This script helps you run the tunnel with backend on port 9090

Write-Host "Monaco Backend - Tunnel Only Setup" -ForegroundColor Green
Write-Host "====================================`n" -ForegroundColor Green

# Check if required files exist
$requiredFiles = @("cert.pem", "credentials.json", "config.tunnel-only.json")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "ERROR: Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host "`nPlease ensure all required files are present." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ All required files found`n" -ForegroundColor Green

# Check if backend is running on port 9090
Write-Host "Checking if backend is running on port 9090..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9090" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Backend is running on port 9090`n" -ForegroundColor Green
} catch {
    Write-Host "⚠ Backend doesn't appear to be running on port 9090" -ForegroundColor Yellow
    Write-Host "  Make sure to start your backend with: PORT=9090 go run main.go`n" -ForegroundColor Yellow
}

# Start the tunnel
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "Command: docker-compose -f docker-compose.tunnel-only.yml up --build`n" -ForegroundColor Gray

docker-compose -f docker-compose.tunnel-only.yml up --build
