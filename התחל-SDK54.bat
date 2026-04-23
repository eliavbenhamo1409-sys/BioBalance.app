@echo off
chcp 65001 >nul
cls
echo.
echo ════════════════════════════════════════════════════
echo   NATURE BOT - SDK 54 - מוכן!
echo ════════════════════════════════════════════════════
echo.
echo הפרויקט עודכן ל-SDK 54 - עכשיו זה יעבוד עם Expo Go!
echo.
echo שלב 1: עובר לתיקיית הפרויקט...
cd /d "%~dp0"
echo ✓ הושלם
echo.
echo שלב 2: מתחיל את השרת...
echo.
echo ⚠ חשוב: אחרי שהשרת יתחיל:
echo    1. לחץ על האות 'w' בטרמינל הזה
echo    2. או פתח דפדפן וגש ל: http://localhost:19000
echo.
echo ⚠ כדי לעצור את השרת: לחץ Ctrl+C
echo.
echo ════════════════════════════════════════════════════
echo.
pause
npx expo start --tunnel

