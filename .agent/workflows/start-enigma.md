---
description: How to start Enigma OS and troubleshoot server issues
---

# Enigma OS - Startup & Troubleshooting Workflow

## Quick Start (Recommended)
// turbo
1. Run the startup script:
```bash
cd /Users/rickyjav/Desktop/Enigma_OS_V2/enigma-pos-os
./scripts/start_enigma.sh
```

## Manual Start

### Step 1: Clean zombie processes
// turbo
```bash
lsof -ti:4000,4001,4002,4003 | xargs kill -9 2>/dev/null
```

### Step 2: Start API
// turbo
```bash
cd apps/api && npm run dev &
```

### Step 3: Start HQ
// turbo
```bash
cd apps/hq && npm run dev &
```

### Step 4: Start OPS
// turbo
```bash
cd apps/ops && npm run dev &
```

### Step 5: Verify
// turbo
```bash
./scripts/verify_all.sh
```

## Troubleshooting

### Error: "Port XXXX is in use, trying another one..."
**Cause:** Zombie processes occupying ports
**Solution:** Run `lsof -ti:4000,4001,4002,4003 | xargs kill -9`

### Error: Cannot access localhost:4001
**Cause:** Server started on different port due to conflict
**Solution:** Check terminal for actual port, then use `./scripts/start_enigma.sh`

### Error: API not responding
**Solution:** 
1. Check PostgreSQL: `brew services start postgresql@15`
2. Check logs: `cat /tmp/enigma_api.log`

## Expected Ports
| App | Port | URL |
|-----|------|-----|
| API | 4000 | http://localhost:4000/api/v1 |
| HQ | 4001 | http://localhost:4001 |
| OPS | 4002 | http://localhost:4002 |
| Kiosk | 4003 | http://localhost:4003 |
