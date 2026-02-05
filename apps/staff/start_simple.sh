#!/bin/bash
# Launcher Fallback (Todo en una ventana)
# Úsalo si el otro falla.

echo "🧹 Limpiando puertos..."
lsof -ti :3000,5173 | xargs kill -9 2>/dev/null || true

echo "🚀 Iniciando (Modo simple)..."

# Start Server in background
cd server
npm run dev &
SERVER_PID=$!

# Start Client in background
cd ../client
npm run dev &
CLIENT_PID=$!

echo "✅ Servidores corriendo en segundo plano (PIDs: $SERVER_PID, $CLIENT_PID)."
echo "   -> Presiona CTRL+C para detener todo."

sleep 5
open "http://localhost:5173/admin" || echo "Abre http://localhost:5173 manualmente"

# Cleanup on exit
trap "kill $SERVER_PID $CLIENT_PID" EXIT
wait
