@echo off
title LykoIO - Game Server
color 0B

echo.
echo  ===========================================
echo   LYKOIO - Roguelike .io Game Server
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
    pause
    start https://nodejs.org
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js found: %NODE_VER%

:: Always cd to where this bat file lives (the lykoio folder)
cd /d "%~dp0"
echo  [INFO] Working directory: %CD%

:: Verify server.js exists here
if not exist "server.js" (
    echo.
    echo  [ERROR] server.js not found in %CD%
    echo  Make sure START_GAME.bat is inside the lykoio folder!
    pause
    exit /b 1
)

:: Verify public folder exists
if not exist "public\index.html" (
    echo.
    echo  [ERROR] public\index.html not found!
    echo  Make sure the public folder is inside the lykoio folder.
    pause
    exit /b 1
)

echo  [OK] All files found.
echo.

:: Install dependencies if node_modules missing
if not exist "node_modules" (
    echo  [STEP 1/2] Installing dependencies for the first time...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed!
) else (
    echo  [OK] Dependencies already installed.
)

echo.
echo  ============================================
echo   Server starting at: http://localhost:3000
echo  ============================================
echo.
echo  HOW TO PLAY WITH FRIENDS:
echo  1. Find your IP:  run "ipconfig" in a new terminal
echo  2. Look for "IPv4 Address" e.g. 192.168.1.50
echo  3. Friends visit:  http://192.168.1.50:3000
echo.
echo  For PUBLIC access (anyone on internet):
echo  Use a free tunnel - see README.md for instructions
echo.
echo  Press Ctrl+C to stop the server.
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000

node server.js

echo.
echo  [INFO] Server stopped.
pause
