#!/bin/bash

# Enigma Staff - Launcher V2 (Robust)
# 1. Limpia puertos
# 2. Inicia Backend y Frontend
# 3. Abre Safari

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🧹 Limpiando procesos antiguos (Puertos 3000 y 5173)..."
# Kill processes on 3000 and 5173 carefully
lsof -ti :3000,5173 | xargs kill -9 2>/dev/null || true

echo "🚀 Iniciando Enigma Staff..."

# 1. Start Backend in new Terminal window
echo "   -> Iniciando Servidor (Backend)..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR/server' && echo 'Starting Backend...' && npm run dev\""

# 2. Start Frontend in new Terminal window
echo "   -> Iniciando Cliente (Frontend)..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR/client' && echo 'Starting Frontend...' && npm run dev\""

echo "⏳ Esperando a que los servicios arranquen..."
sleep 5

# 3. Open Browser
echo "🌍 Abriendo Safari..."
open -a Safari "http://localhost:5173/admin"

echo "✅ Sistema iniciado exitosamente."
