# Nature Bot - Auto-restart Development Server
# This script keeps the Expo server running and restarts it if it crashes

Write-Host "🌿 Nature Bot Development Server" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

$projectPath = $PSScriptRoot
Set-Location $projectPath

# Kill any existing node processes
Write-Host "Cleaning up old processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Clean cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

$restartCount = 0

while ($true) {
    $restartCount++
    Write-Host ""
    Write-Host "Starting server (attempt $restartCount)..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    
    try {
        # Start expo with tunnel mode
        npx expo start --port 8082 --tunnel
    }
    catch {
        Write-Host "Server crashed. Restarting in 5 seconds..." -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Server stopped. Restarting in 5 seconds..." -ForegroundColor Yellow
    Write-Host "(Press Ctrl+C now to exit completely)" -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

