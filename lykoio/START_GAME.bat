@echo off
title LykoIO - Game Server Setup
color 0B

echo.
echo  ===========================================
echo   LYKOIO - Roguelike .io Game Server Setup
echo  ===========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the "LTS" version ^(recommended^)
    echo.
    echo  After installing, run this script again.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

:: Print Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js found: %NODE_VER%

:: Check if npm is installed
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo  [OK] npm found: v%NPM_VER%
echo.

:: Go to the script's directory
cd /d "%~dp0"
echo  [INFO] Working directory: %CD%
echo.

:: Install dependencies
echo  [STEP 1/2] Installing dependencies...
echo  (This may take a moment on first run)
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed successfully!
echo.

:: Start the server
echo  [STEP 2/2] Starting LykoIO server...
echo.
echo  ============================================
echo   Server will be available at:
echo   http://localhost:3000
echo  ============================================
echo.
echo  Share your local IP with friends to play together!
echo  Find your IP by running: ipconfig
echo  They can connect at: http://YOUR_IP:3000
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser automatically
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Start the game server
node server.js

echo.
echo  [INFO] Server stopped.
pause
