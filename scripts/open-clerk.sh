#!/bin/bash

echo "Opening Clerk Dashboard..."
echo ""
echo "Please follow these steps:"
echo "1. Create a new application named 'MS Elevate Indonesia'"
echo "2. Enable Google OAuth only"
echo "3. Copy your API keys"
echo "4. Run: pnpm setup:clerk-env"
echo ""

# Try to open in browser
if command -v open &> /dev/null; then
    open "https://dashboard.clerk.com"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://dashboard.clerk.com"
else
    echo "Please open: https://dashboard.clerk.com"
fi