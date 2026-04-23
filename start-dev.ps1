# PowerShell script to start Expo with QR code display
Write-Host "Starting Expo..." -ForegroundColor Green
Write-Host "QR code will be available at: http://localhost:19002" -ForegroundColor Yellow
Write-Host ""
Set-Location $PSScriptRoot
npx expo start --tunnel


