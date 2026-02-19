#!/bin/bash

echo ""
echo " ==========================================="
echo "  LYKOIO - Roguelike .io Game Server Setup"
echo " ==========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo " [ERROR] Node.js is not installed!"
    echo ""
    echo " Install it from: https://nodejs.org"
    echo " Or via Homebrew (Mac): brew install node"
    echo " Or via apt (Linux):   sudo apt install nodejs npm"
    echo ""
    exit 1
fi

echo " [OK] Node.js: $(node -v)"
echo " [OK] npm: v$(npm -v)"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

echo " [STEP 1/2] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo " [ERROR] npm install failed."
    exit 1
fi

echo ""
echo " [OK] Dependencies installed!"
echo ""
echo " [STEP 2/2] Starting LykoIO server..."
echo ""
echo " ============================================"
echo "  Open your browser at: http://localhost:3000"
echo " ============================================"
echo ""
echo " Share your local IP with friends to play!"
echo " Find it with: ifconfig | grep 'inet '"
echo ""

# Open browser
sleep 1
if command -v open &> /dev/null; then
    open http://localhost:3000        # Mac
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000    # Linux
fi

node server.js
