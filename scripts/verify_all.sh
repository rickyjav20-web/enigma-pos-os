#!/bin/bash
#
# ENIGMA OS - VERIFICATION SCRIPT
# Checks all services are running correctly
#

echo ""
echo "🔍 ENIGMA OS - VERIFICACIÓN RÁPIDA"
echo "═══════════════════════════════════"
echo ""

# Check ports
echo "📡 PUERTOS:"
for PORT in 4000 4001 4002 4003; do
    if lsof -i :$PORT | grep -q LISTEN; then
        echo "   ✅ Puerto $PORT → ACTIVO"
    else
        echo "   ❌ Puerto $PORT → LIBRE"
    fi
done

echo ""
echo "🌐 SERVICIOS:"

# API
if curl -s --connect-timeout 2 http://localhost:4000/api/v1/suppliers > /dev/null 2>&1; then
    COUNT=$(curl -s http://localhost:4000/api/v1/suppliers 2>/dev/null | grep -o '"id"' | wc -l | tr -d ' ')
    echo "   ✅ API (4000) → OK ($COUNT suppliers)"
else
    echo "   ❌ API (4000) → NO RESPONDE"
fi

# HQ
if curl -s --connect-timeout 2 http://localhost:4001/ > /dev/null 2>&1; then
    echo "   ✅ HQ (4001) → OK"
else
    echo "   ❌ HQ (4001) → NO RESPONDE"
fi

# OPS
if curl -s --connect-timeout 2 http://localhost:4002/ > /dev/null 2>&1; then
    echo "   ✅ OPS (4002) → OK"
else
    echo "   ❌ OPS (4002) → NO RESPONDE"
fi

# Kiosk
if curl -s --connect-timeout 2 http://localhost:4003/ > /dev/null 2>&1; then
    echo "   ✅ Kiosk (4003) → OK"
else
    echo "   ❌ Kiosk (4003) → NO RESPONDE"
fi

echo ""
echo "═══════════════════════════════════"
echo ""
