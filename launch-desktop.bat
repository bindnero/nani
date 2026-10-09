@echo off
title Launch Nani Desktop App
echo Starting Nani Desktop App...

:: Ensure dev server is running or start it in background if needed
curl -s http://localhost:1420/ >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Starting Vite server...
    start /B npm run dev
    timeout /t 2 /nobreak >nul
)

:: Launch standalone desktop application window
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:1420" --window-size=1280,820
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:1420" --window-size=1280,820
) else (
    start http://localhost:1420
)
