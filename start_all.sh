#!/bin/bash
# Enigma OS Complete Startup Script
# Run this from Terminal.app (NOT from Antigravity)

echo "🚀 Starting Enigma OS..."
echo ""

# 1. Kill any existing processes
echo "1️⃣ Cleaning up old processes..."
pkill -9 -f "node" 2>/dev/null
lsof -ti:4000,4001,4002,4003 | xargs kill -9 2>/dev/null
sleep 2

# 2. Start API
echo "2️⃣ Starting API (port 4000)..."
cd /Users/rickyjav/Desktop/Enigma_OS_V2/enigma-pos-os/apps/api
npm run dev &
sleep 5

# 3. Start HQ
echo "3️⃣ Starting HQ (port 4001)..."
cd /Users/rickyjav/Desktop/Enigma_OS_V2/enigma-pos-os/apps/hq
npm run dev &
sleep 5

# 4. Start OPS
echo "4️⃣ Starting OPS (port 4002)..."
cd /Users/rickyjav/Desktop/Enigma_OS_V2/enigma-pos-os/apps/ops
npm run dev &
sleep 3

# 5. Start POS
echo "5️⃣ Starting POS (port 4003)..."
cd /Users/rickyjav/Desktop/Enigma_OS_V2/enigma-pos-os/apps/pos
npm run dev &
sleep 3

echo ""
echo "✅ All servers started!"
echo ""
echo "📍 Access your apps:"
echo "   • HQ:  http://localhost:4001"
echo "   • OPS: http://localhost:4002"
echo "   • POS: http://localhost:4003"
echo "   • API: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Keep script running
wait
