#!/bin/bash

# Enigma OS V2 - Unified Startup Script
# "The One Script to Rule Them All"

echo "🛑 DETENIENDO PROCESOS ANTIGUOS..."
# Kill ports 4000 (API), 4001 (HQ), 4002 (OPS), 4003 (Staff)
lsof -ti :4000,4001,4002,4003 | xargs kill -9 2>/dev/null || true
echo "✅ Puertos liberados."

echo "🚀 INICIANDO SISTEMA ENIGMA OS..."
echo "📂 Directorio Base: $(pwd)"

# Start API
echo "   -> Iniciando API (Port 4000)..."
npm run dev --prefix apps/api > api.log 2>&1 &
API_PID=$!

# Start HQ
echo "   -> Iniciando HQ (Port 4001)..."
npm run dev --prefix apps/hq > hq.log 2>&1 &
HQ_PID=$!

# Start OPS
echo "   -> Iniciando OPS (Port 4002)..."
npm run dev --prefix apps/ops > ops.log 2>&1 &
OPS_PID=$!

# Start Staff Client
echo "   -> Iniciando STAFF APP (Port 4003)..."
npm run dev --prefix apps/staff/client > staff.log 2>&1 &
STAFF_PID=$!

echo "⏳ Esperando 10 segundos para arranque de servicios..."
sleep 10

echo "🎉 SISTEMA UPLINE!"
echo "---------------------------------------------------"
echo "🔗  HQ (Backoffice):   http://localhost:4001"
echo "🔗  OPS (Compras):     http://localhost:4002"
echo "🔗  STAFF APP:         http://localhost:4003"
echo "🔗  API Health:        http://localhost:4000/api/v1/health"
echo "---------------------------------------------------"
echo "⚠️  Para ver logs: 'tail -f *.log'"
echo "❌  Presiona CTRL+C para detener todo."

# Cleanup trap
trap "kill $API_PID $HQ_PID $OPS_PID $STAFF_PID; echo '🛑 Sistema Detenido'; exit" SIGINT SIGTERM

# Keep script running
wait
