@echo off
chcp 65001 >nul
echo.
echo ============================================
echo   מריץ את NATURE BOT...
echo ============================================
echo.
cd /d "%~dp0"
echo ממתין שהשרת יתחיל...
echo.
echo אחרי שהשרת יתחיל:
echo 1. פתח דפדפן וגש ל: http://localhost:19002
echo 2. סרוק את ה-QR code עם Expo Go בטלפון
echo.
echo לחץ Ctrl+C כדי לעצור את השרת
echo.
pause
npx expo start --port 8082


