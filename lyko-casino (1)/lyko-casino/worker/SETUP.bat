@echo off
setlocal enabledelayedexpansion
title LYKO CASINO — Auto Setup

:: ============================================================
::  LYKO CASINO — One-Click Backend Setup
::  Run this from inside the "worker" folder from the zip.
::  It will install everything, deploy the worker, and 
::  patch lyko.js with your real worker URL automatically.
:: ============================================================

color 0A
echo.
echo  ██╗  ██╗   ██╗██╗  ██╗ ██████╗ 
echo  ██║  ╚██╗ ██╔╝██║ ██╔╝██╔═══██╗
echo  ██║   ╚████╔╝ █████╔╝ ██║   ██║
echo  ██║    ╚██╔╝  ██╔═██╗ ██║   ██║
echo  ███████╗██║   ██║  ██╗╚██████╔╝
echo  ╚══════╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ 
echo.
echo  Casino Backend Setup
echo  ════════════════════════════════
echo.

:: ── Check we're in the right place ──────────────────────────
if not exist "index.js" (
    echo  [ERROR] index.js not found.
    echo  Please run this .bat from inside the "worker" folder.
    echo.
    pause
    exit /b 1
)

if not exist "wrangler.toml" (
    echo  [ERROR] wrangler.toml not found.
    echo  Please run this .bat from inside the "worker" folder.
    echo.
    pause
    exit /b 1
)

:: ── Check Node.js ────────────────────────────────────────────
echo  [1/7] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo  Please download and install it from: https://nodejs.org
    echo  Then run this script again.
    echo.
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo         Found: %%v
echo.

:: ── Install npm packages ─────────────────────────────────────
echo  [2/7] Installing packages (wrangler, itty-router, jwt)...
call npm install >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo         Done.
echo.

:: ── Install wrangler globally ────────────────────────────────
echo  [3/7] Installing Wrangler CLI...
call npm install -g wrangler >nul 2>&1
echo         Done.
echo.

:: ── Cloudflare login ─────────────────────────────────────────
echo  [4/7] Logging into Cloudflare...
echo.
echo  A browser window will open — click "Allow" to authorize.
echo  Come back here when it says "Successfully logged in".
echo.
pause
call wrangler login
if errorlevel 1 (
    echo  [ERROR] Wrangler login failed.
    pause
    exit /b 1
)
echo.
echo         Logged in.
echo.

:: ── Create KV namespace ──────────────────────────────────────
echo  [5/7] Creating KV storage namespace...
echo.

:: Capture wrangler output to a temp file
call wrangler kv:namespace create "LYKO_KV" > "%TEMP%\kv_output.txt" 2>&1
type "%TEMP%\kv_output.txt"
echo.

:: Extract the id from the output
:: Output looks like: { binding = "KV", id = "abc123..." }
set "KV_ID="
for /f "tokens=*" %%L in (%TEMP%\kv_output.txt) do (
    set "LINE=%%L"
    echo !LINE! | findstr /i "id = " >nul
    if not errorlevel 1 (
        for /f "tokens=2 delims==" %%A in ("!LINE!") do (
            set "RAW=%%A"
        )
    )
)

:: Try a more reliable extraction using PowerShell
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Content '%TEMP%\kv_output.txt' | Select-String 'id = \"([a-f0-9]+)\"' | ForEach-Object { $_.Matches[0].Groups[1].Value }" 2^>nul') do (
    set "KV_ID=%%i"
)

if "!KV_ID!"=="" (
    echo.
    echo  [!] Could not auto-extract KV ID from output above.
    echo  Please look at the output above and find the line that says:
    echo      id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    echo.
    set /p KV_ID="  Paste just the ID here and press Enter: "
)

echo.
echo         KV ID: !KV_ID!
echo.

:: ── Patch wrangler.toml ──────────────────────────────────────
echo  [5b] Patching wrangler.toml with KV ID...
powershell -NoProfile -Command ^
  "(Get-Content 'wrangler.toml') -replace 'YOUR_KV_NAMESPACE_ID', '!KV_ID!' -replace 'YOUR_KV_PREVIEW_ID', '!KV_ID!' | Set-Content 'wrangler.toml'"
echo         Done.
echo.

:: ── Set JWT secret ───────────────────────────────────────────
echo  [6/7] Setting JWT secret...
echo.
echo  This is a secret password used to sign login tokens.
echo  It can be anything — just make it long and random.
echo  Example: xK9mP2qR7vN4wL8jQ3zA6bC1dE5fG0h
echo.
set /p JWT_SECRET="  Enter your JWT secret (or press Enter to auto-generate): "

if "!JWT_SECRET!"=="" (
    :: Auto-generate using PowerShell
    for /f "delims=" %%i in ('powershell -NoProfile -Command "[System.Web.Security.Membership]::GeneratePassword(32,4)" 2^>nul') do set "JWT_SECRET=%%i"
    if "!JWT_SECRET!"=="" (
        :: Fallback generator
        for /f "delims=" %%i in ('powershell -NoProfile -Command "-join ((65..90)+(97..122)+(48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})"') do set "JWT_SECRET=%%i"
    )
    echo         Auto-generated: !JWT_SECRET!
)

echo !JWT_SECRET! | call wrangler secret put JWT_SECRET
echo.
echo         JWT secret saved.
echo.

:: ── Deploy ───────────────────────────────────────────────────
echo  [7/7] Deploying worker to Cloudflare...
echo.
call wrangler deploy > "%TEMP%\deploy_output.txt" 2>&1
type "%TEMP%\deploy_output.txt"
echo.

:: Extract deployed URL
set "WORKER_URL="
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Content '%TEMP%\deploy_output.txt' | Select-String 'https://[a-zA-Z0-9\-]+\.workers\.dev' | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1" 2^>nul') do (
    set "WORKER_URL=%%i"
)

if "!WORKER_URL!"=="" (
    echo.
    echo  [!] Could not auto-detect worker URL.
    echo  Look at the deploy output above for a line like:
    echo      https://lyko-casino.yourname.workers.dev
    echo.
    set /p WORKER_URL="  Paste your full worker URL here and press Enter: "
)

echo.
echo  ════════════════════════════════════════════════
echo   Worker deployed at: !WORKER_URL!
echo  ════════════════════════════════════════════════
echo.

:: ── Patch lyko.js ────────────────────────────────────────────
echo  Patching lyko.js with your worker URL...
echo.

:: Look for lyko.js relative to the worker folder (../frontend/casino/lyko.js)
set "LYKO_PATH=..\frontend\casino\lyko.js"

if not exist "!LYKO_PATH!" (
    :: Try sibling casino folder
    set "LYKO_PATH=..\casino\lyko.js"
)
if not exist "!LYKO_PATH!" (
    :: Search one level up
    for /r ".." %%f in (lyko.js) do (
        set "LYKO_PATH=%%f"
        goto :found_lyko
    )
)
:found_lyko

if not exist "!LYKO_PATH!" (
    echo  [!] Could not find lyko.js automatically.
    echo  Please manually open lyko.js and on line 7 change:
    echo.
    echo      const API = 'https://lyko-casino.YOUR-SUBDOMAIN.workers.dev';
    echo  to:
    echo      const API = '!WORKER_URL!';
    echo.
) else (
    powershell -NoProfile -Command ^
      "(Get-Content '!LYKO_PATH!') -replace 'https://lyko-casino\.YOUR-SUBDOMAIN\.workers\.dev', '!WORKER_URL!' | Set-Content '!LYKO_PATH!'"
    echo         Patched: !LYKO_PATH!
    echo.
)

:: ── Done ─────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                  SETUP COMPLETE!                    ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║                                                      ║
echo  ║  Worker URL:  !WORKER_URL!
echo  ║  KV ID:       !KV_ID!
echo  ║                                                      ║
echo  ║  NEXT STEPS:                                         ║
echo  ║  1. Copy these files to your repo root:              ║
echo  ║     - frontend\casino.html                           ║
echo  ║     - frontend\leaderboard.html                      ║
echo  ║     - frontend\casino\lyko.js  (already patched)     ║
echo  ║     - frontend\casino\*.html   (all game files)      ║
echo  ║                                                      ║
echo  ║  2. git add . ^&^& git commit -m "backend" ^&^& git push  ║
echo  ║                                                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Save details to a log file
echo LYKO CASINO SETUP LOG > setup-log.txt
echo ======================== >> setup-log.txt
echo Worker URL: !WORKER_URL! >> setup-log.txt
echo KV ID: !KV_ID! >> setup-log.txt
echo JWT Secret: !JWT_SECRET! >> setup-log.txt
echo Deployed: %DATE% %TIME% >> setup-log.txt
echo. >> setup-log.txt
echo Keep this file safe - you may need these values later. >> setup-log.txt

echo  Setup details saved to: worker\setup-log.txt
echo  (Keep this file - it has your KV ID and worker URL)
echo.
pause
