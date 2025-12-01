#!/bin/bash
# Quick test script for local database connection

echo "🧪 Testing local database connection..."
echo ""

# Test database connection
echo "1. Testing database connection..."
node test-db.js
echo ""

# Build the app
echo "2. Building React app..."
npm run build
echo ""

# Start server in background
echo "3. Starting server..."
npm start &
SERVER_PID=$!
sleep 3

# Test API endpoint
echo "4. Testing API endpoint..."
RESPONSE=$(curl -s http://localhost:8000/api/poses/danceBattle_dancetwo | head -c 100)
if [[ $RESPONSE == *"x\""* ]] || [[ $RESPONSE == *"["* ]]; then
  echo "✅ API endpoint working! (returned pose data)"
else
  echo "❌ API endpoint failed or returned empty"
fi
echo ""

# Stop server
echo "5. Stopping server..."
kill $SERVER_PID 2>/dev/null || pkill -f "node server.js"
echo ""
echo "✅ Test complete!"
echo ""
echo "To run the app:"
echo "  npm start"
echo "  Then open: http://localhost:8000"

