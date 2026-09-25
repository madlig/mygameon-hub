@echo off
title MyGameON Studio Auto-Starter
color 0A
cls
echo ========================================================
echo        MYGAMEON STUDIO - ONE-CLICK AUTO STARTER
echo ========================================================
echo.
echo [1/2] Menyalakan MyGameON Hub (Port 3000)...
start "MyGameON Hub (Port 3000)" cmd /k "cd /d c:\mad\proyek\mygameon-hub && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Menyalakan n8n Automation Engine (Port 5678)...
start "n8n Tunnel (Port 5678)" cmd /k "n8n start --tunnel"

echo.
echo ========================================================
echo   SEMUA SERVER OTOMATISASI TELAH BERHASIL DINYALAKAN!
echo ========================================================
echo   - MyGameON Hub : http://localhost:3000
echo   - n8n Workflow : http://localhost:5678
echo.
echo   Catatan: Biarkan kedua jendela terminal yang muncul
echo   tetap terbuka (bisa di-minimize ke taskbar).
echo ========================================================
echo.
pause
