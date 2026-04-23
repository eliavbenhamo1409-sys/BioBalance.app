@echo off
title Nature Bot Development Server
color 0A

echo.
echo  ======================================
echo    Nature Bot - Development Server
echo  ======================================
echo.
echo  Choose an option:
echo.
echo  [1] Tunnel Mode (works from anywhere, less stable)
echo  [2] LAN Mode (same WiFi only, very stable)
echo  [3] Exit
echo.

set /p choice="Enter choice (1, 2, or 3): "

if "%choice%"=="1" (
    echo.
    echo Starting Tunnel Mode...
    powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
) else if "%choice%"=="2" (
    echo.
    echo Starting LAN Mode...
    echo Make sure your phone is on the same WiFi!
    powershell -ExecutionPolicy Bypass -File "%~dp0start-lan.ps1"
) else if "%choice%"=="3" (
    exit
) else (
    echo Invalid choice. Please try again.
    pause
    "%~f0"
)

