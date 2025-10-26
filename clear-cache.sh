#!/bin/bash

echo "🧹 Clearing all caches..."

# Stop any running dev servers
echo "1. Make sure to stop the dev server (Ctrl+C)"

# Clear Vite cache
echo "2. Clearing Vite cache..."
rm -rf node_modules/.vite
rm -rf .vite

# Clear dist
echo "3. Clearing dist..."
rm -rf dist

# Clear browser cache instructions
echo "
4. Clear browser cache:
   - Chrome: Ctrl+Shift+Delete → Clear browsing data → Cached images and files
   - Or open in Incognito mode: Ctrl+Shift+N
   - Or hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

5. Restart dev server:
   npm run dev

Done! ✅
"
