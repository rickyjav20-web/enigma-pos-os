#!/bin/bash
#
# ENIGMA OS - ROBUST STARTUP SCRIPT
# Handles zombie processes and port conflicts automatically
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ENIGMA OS - STARTUP SCRIPT           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Kill zombie processes
echo -e "${YELLOW}[1/5]${NC} Limpiando procesos zombies..."

for PORT in 4000 4001 4002 4003; do
    PID=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null || true
        echo -e "  ${RED}✗${NC} Puerto $PORT liberado (PID $PID terminado)"
    else
        echo -e "  ${GREEN}✓${NC} Puerto $PORT disponible"
    fi
done

sleep 2

# Step 2: Verify PostgreSQL
echo ""
echo -e "${YELLOW}[2/5]${NC} Verificando PostgreSQL..."

if pg_isready -q 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL corriendo"
else
    echo -e "  ${RED}✗${NC} PostgreSQL no responde"
    echo "    Intenta: brew services start postgresql@15"
    exit 1
fi

# Step 3: Start API
echo ""
echo -e "${YELLOW}[3/5]${NC} Iniciando API (puerto 4000)..."
cd "$PROJECT_ROOT/apps/api"
npm run dev > /tmp/enigma_api.log 2>&1 &
API_PID=$!
echo -e "  ${GREEN}✓${NC} API iniciado (PID: $API_PID)"

# Wait for API
sleep 4
if curl -s --connect-timeout 2 http://localhost:4000/api/v1/suppliers > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API respondiendo"
else
    echo -e "  ${RED}✗${NC} API no responde - ver /tmp/enigma_api.log"
fi

# Step 4: Start HQ
echo ""
echo -e "${YELLOW}[4/5]${NC} Iniciando HQ (puerto 4001)..."
cd "$PROJECT_ROOT/apps/hq"
npm run dev > /tmp/enigma_hq.log 2>&1 &
HQ_PID=$!
echo -e "  ${GREEN}✓${NC} HQ iniciado (PID: $HQ_PID)"

# Step 5: Start OPS
echo ""
echo -e "${YELLOW}[5/5]${NC} Iniciando OPS Mobile (puerto 4002)..."
cd "$PROJECT_ROOT/apps/ops"
npm run dev > /tmp/enigma_ops.log 2>&1 &
OPS_PID=$!
echo -e "  ${GREEN}✓${NC} OPS iniciado (PID: $OPS_PID)"

# Wait for frontends to compile
echo ""
echo -e "${YELLOW}Esperando compilación de frontends (15 segundos)...${NC}"
sleep 15

# Final verification
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ESTADO FINAL                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

check_service() {
    local NAME=$1
    local PORT=$2
    local URL=$3
    
    if curl -s --connect-timeout 2 "$URL" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $NAME → http://localhost:$PORT"
    else
        echo -e "  ${RED}✗${NC} $NAME → NO RESPONDE (ver /tmp/enigma_${NAME,,}.log)"
    fi
}

check_service "API" 4000 "http://localhost:4000/api/v1/suppliers"
check_service "HQ"  4001 "http://localhost:4001/"
check_service "OPS" 4002 "http://localhost:4002/"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "📋 Logs disponibles en:"
echo "   /tmp/enigma_api.log"
echo "   /tmp/enigma_hq.log"
echo "   /tmp/enigma_ops.log"
echo ""
echo "🛑 Para detener: pkill -f 'node'"
echo ""
