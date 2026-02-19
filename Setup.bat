@echo off
echo ========================================
echo  PaintWeb - Setup Script
echo ========================================
echo.

:: Create project directories
echo [1/4] Creating project directories...
mkdir paintweb 2>nul
mkdir paintweb\assets 2>nul
mkdir paintweb\exports 2>nul
echo  Directories created.

:: Copy the main HTML file if it exists next to this bat
echo [2/4] Setting up project files...
if exist "paintweb.html" (
    copy paintweb.html paintweb\index.html >nul
    echo  Copied paintweb.html to paintweb\index.html
) else (
    echo  NOTE: Place paintweb.html next to this .bat and re-run, OR open paintweb\index.html directly.
)

:: Check for Node.js (optional, for future server use)
echo [3/4] Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo  Node.js found: 
    node --version
) else (
    echo  Node.js not found. Not required to run - just open index.html in a browser.
    echo  To install Node.js visit: https://nodejs.org
)

:: Done
echo [4/4] Setup complete!
echo.
echo ========================================
echo  HOW TO RUN:
echo  Open paintweb\index.html in any modern browser.
echo  No server required - it runs fully client-side!
echo ========================================
echo.
pause