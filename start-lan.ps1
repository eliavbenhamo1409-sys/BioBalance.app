# Nature Bot - LAN Mode (More Stable)
# Use this if you're on the same WiFi as your phone

Write-Host "🌿 Nature Bot - LAN Mode" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "Make sure your phone is on the same WiFi network!" -ForegroundColor Yellow
Write-Host ""

$projectPath = $PSScriptRoot
Set-Location $projectPath

# Kill any existing node processes
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Clean cache
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue

# Start in LAN mode (more stable than tunnel)
npx expo start --port 8082 --lan --clear

