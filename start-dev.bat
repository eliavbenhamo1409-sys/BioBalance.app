@echo off
cd /d "%~dp0"
echo Starting Expo with tunnel mode...
echo This will show QR code in browser at http://localhost:19002
echo.
npx expo start --tunnel
pause


