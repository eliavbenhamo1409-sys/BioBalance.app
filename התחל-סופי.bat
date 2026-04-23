@echo off
chcp 65001 >nul
cls
echo.
echo ════════════════════════════════════════════════════
echo   NATURE BOT - מתחיל את השרת...
echo ════════════════════════════════════════════════════
echo.
echo שלב 1: עוצר כל השרתים הישנים...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✓ הושלם
echo.
echo שלב 2: עובר לתיקיית הפרויקט...
cd /d "%~dp0"
echo ✓ הושלם
echo.
echo שלב 3: מתחיל את השרת על פורט 8082...
echo.
echo ⚠ חשוב: אחרי שהשרת יתחיל (30-60 שניות):
echo    1. לחץ על האות 'w' בטרמינל הזה
echo    2. או פתח דפדפן וגש ל: http://localhost:19000
echo.
echo ⚠ כדי לעצור את השרת: לחץ Ctrl+C
echo.
echo ════════════════════════════════════════════════════
echo.
pause
npx expo start --port 8082 --tunnel

