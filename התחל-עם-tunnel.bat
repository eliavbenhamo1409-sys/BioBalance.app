@echo off
chcp 65001 >nul
cls
echo.
echo ════════════════════════════════════════════════════
echo   NATURE BOT - מתחיל עם TUNNEL MODE
echo ════════════════════════════════════════════════════
echo.
echo זה יפתור בעיות חיבור!
echo.
echo שלב 1: עובר לתיקיית הפרויקט...
cd /d "%~dp0"
echo ✓ הושלם
echo.
echo שלב 2: מתחיל את השרת עם TUNNEL...
echo.
echo ⚠ חשוב: זה יכול לקחת 30-60 שניות
echo    תחכה עד שתראה QR code בטרמינל או בדפדפן
echo.
echo ⚠ אחרי שהשרת יתחיל:
echo    1. לחץ על האות 'w' בטרמינל הזה
echo    2. או פתח דפדפן וגש ל: http://localhost:19000
echo.
echo ⚠ כדי לעצור את השרת: לחץ Ctrl+C
echo.
echo ════════════════════════════════════════════════════
echo.
pause
npx expo start --tunnel

