#!/bin/bash

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

# Ports
PORT_API=4000
PORT_HQ=4001
PORT_OPS=4002
PORT_STAFF=4003

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛡️  ENIGMA OS: ROBUST LAUNCHER V2.0${NC}"
echo "-----------------------------------------------"

# 1. CLEANUP (The "Nuclear Option")
echo -e "${YELLOW}[1/5] Limpiando procesos en puertos $PORT_API-$PORT_STAFF...${NC}"
lsof -ti :$PORT_API,$PORT_HQ,$PORT_OPS,$PORT_STAFF | xargs kill -9 2>/dev/null || true
echo -e "${GREEN}✓ Puertos liberados.${NC}"

# 2. START SERVICES (Detached & Persisted)
echo -e "${YELLOW}[2/5] Iniciando servicios en segundo plano...${NC}"

# Function to start service
start_service() {
    local name=$1
    local path=$2
    local port=$3
    local logfile="$LOG_DIR/$name.log"

    echo -n "   -> Iniciando $name (:$port)... "
    # Use nohup to detach from terminal session completely
    nohup npm run dev --prefix "$ROOT_DIR/$path" > "$logfile" 2>&1 &
    echo "PID: $!"
}

start_service "API" "apps/api" $PORT_API
start_service "HQ" "apps/hq" $PORT_HQ
start_service "OPS" "apps/ops" $PORT_OPS
start_service "STAFF" "apps/staff/client" $PORT_STAFF

# 3. HEALTH CHECK (Smart Wait)
echo -e "${YELLOW}[3/5] Esperando que los servicios estén activos...${NC}"

wait_for_port() {
    local port=$1
    local name=$2
    local retries=30
    local wait_time=1

    echo -n "   Waiting for $name (:$port)... "
    for ((i=1; i<=retries; i++)); do
        if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
            echo -e "${GREEN}ONLINE${NC}"
            return 0
        fi
        sleep $wait_time
    done
    echo -e "${RED}TIMEOUT${NC}"
    return 1
}

wait_for_port $PORT_API "API"
wait_for_port $PORT_HQ "HQ"
wait_for_port $PORT_OPS "OPS"
wait_for_port $PORT_STAFF "STAFF"

# 4. FINAL STATUS
echo "-----------------------------------------------"
echo -e "${GREEN}🚀 SISTEMA LISTO Y ANCLADO${NC}"
echo -e "   Logs disponibles en: ${YELLOW}$LOG_DIR${NC}"
echo "-----------------------------------------------"
echo "🔗  HQ:     http://localhost:$PORT_HQ"
echo "🔗  OPS:    http://localhost:$PORT_OPS"
echo "🔗  STAFF:  http://localhost:$PORT_STAFF"
echo "-----------------------------------------------"

# 5. AUTO OPEN
open "http://localhost:$PORT_HQ" "http://localhost:$PORT_OPS/purchases" "http://localhost:$PORT_STAFF" 
