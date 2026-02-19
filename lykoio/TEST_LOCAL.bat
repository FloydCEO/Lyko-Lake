@echo off
title LykoIO - Local Test
color 0B
cd /d "%~dp0"

echo.
echo  ================================
echo   LykoIO - Local Test
echo  ================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found! Get it from nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo  [OK] Node %%i

if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    call npm install
)

echo.
echo  [OK] Starting local server at http://localhost:3000
echo  NOTE: Local version connects to localhost.
echo  The Wispbyte version connects to 212.132.120.102:13888
echo.
timeout /t 2 /nobreak >nul
start http://localhost:3000
node server.js
pause
