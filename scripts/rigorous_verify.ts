#!/usr/bin/env npx tsx
/**
 * RIGOROUS VERIFICATION SCRIPT - SIMPLIFIED
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('='.repeat(60));
    console.log('1️⃣ DEMOSTRACIÓN OBLIGATORIA - EVIDENCIA CONCRETA');
    console.log('='.repeat(60));

    console.log('\n📊 BASE DE DATOS: enigma_os_core (PostgreSQL)');
    console.log('📍 Ubicación: localhost:5432');

    // Get all supply items
    const items = await prisma.supplyItem.findMany({
        where: { tenantId: 'enigma_hq' },
        take: 5,
        include: { priceHistory: { orderBy: { changeDate: 'desc' }, take: 3 } }
    });

    console.log(`\n📦 REGISTROS EN SupplyItem (enigma_hq): ${items.length}`);

    for (const item of items) {
        console.log(`\n   ID: ${item.id}`);
        console.log(`   Nombre: ${item.name}`);
        console.log(`   Costo Actual: $${item.currentCost}`);
        console.log(`   PriceHistory entries: ${item.priceHistory.length}`);
        for (const h of item.priceHistory) {
            console.log(`      ${h.changeDate?.toISOString().slice(0, 19)}: $${h.oldCost} → $${h.newCost}`);
        }
    }

    // Get suppliers
    const suppliers = await prisma.supplier.findMany({ take: 3 });
    console.log(`\n📦 SUPPLIERS: ${suppliers.length}`);
    for (const s of suppliers) {
        console.log(`   ${s.id.slice(0, 8)}... - ${s.name}`);
    }

    // Get purchase orders
    const purchases = await prisma.purchaseOrder.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { lines: true }
    });
    console.log(`\n📋 PURCHASE ORDERS recientes: ${purchases.length}`);
    for (const p of purchases) {
        console.log(`   ${p.id.slice(0, 8)}... - ${p.date?.toISOString().slice(0, 10)} - ${p.lines.length} líneas - Status: ${p.status}`);
    }

    // ========== CASO MÍNIMO REPRODUCIBLE ==========
    console.log('\n' + '='.repeat(60));
    console.log('5️⃣ CASO MÍNIMO REPRODUCIBLE');
    console.log('='.repeat(60));

    if (items.length > 0) {
        const testItem = items[0];
        const oldCost = testItem.currentCost;
        const newCost = oldCost + 0.10;

        console.log(`\n📝 PASO 1: SELECT - currentCost = $${oldCost}`);

        // Direct update
        const updated = await prisma.supplyItem.update({
            where: { id: testItem.id },
            data: { currentCost: newCost }
        });
        console.log(`📝 PASO 2: UPDATE SET currentCost = $${newCost}`);
        console.log(`   Result: $${updated.currentCost}`);

        // Read back
        const verified = await prisma.supplyItem.findUnique({ where: { id: testItem.id } });
        console.log(`📝 PASO 3: SELECT - currentCost = $${verified?.currentCost}`);

        const match = Math.abs((verified?.currentCost || 0) - newCost) < 0.01;
        console.log(`\n✅ RESULTADO: ${match ? 'FLUJO DB FUNCIONA' : '❌ PROBLEMA EN DB'}`);
    }

    // ========== SERVIDOR STATUS ==========
    console.log('\n' + '='.repeat(60));
    console.log('🖥️ ESTADO DE SERVIDORES');
    console.log('='.repeat(60));

    const ports = [
        { port: 4000, name: 'API' },
        { port: 4001, name: 'HQ' },
        { port: 4002, name: 'OPS' },
        { port: 4003, name: 'Kiosk' }
    ];

    for (const { port, name } of ports) {
        try {
            const res = await fetch(`http://localhost:${port}/`, {
                signal: AbortSignal.timeout(1500)
            });
            console.log(`${name} (${port}): ✅ RUNNING (status ${res.status})`);
        } catch (e: any) {
            console.log(`${name} (${port}): ❌ NO RESPONDE`);
        }
    }

    // ========== 4. HIPÓTESIS ALTERNATIVAS ==========
    console.log('\n' + '='.repeat(60));
    console.log('4️⃣ HIPÓTESIS - POR QUÉ NO ABREN LOS LINKS');
    console.log('='.repeat(60));
    console.log(`
1. SERVIDORES NO INICIADOS
   - Los procesos npm run dev terminaron o nunca se iniciaron
   - Verificar: lsof -i :4000,4001,4002

2. FIREWALL / SEGURIDAD macOS
   - macOS puede bloquear conexiones localhost
   - Verificar: Preferencias del Sistema > Seguridad

3. PUERTOS OCUPADOS POR OTRO PROCESO
   - Otro proceso podría estar usando el puerto
   - Verificar: lsof -ti:4000

4. PROBLEMA DE RED / LOCALHOST
   - localhost no resuelve a 127.0.0.1
   - Verificar: cat /etc/hosts

5. VITE DEV SERVER NO ARRANCA
   - Error en la compilación del frontend
   - Verificar: npm run dev en terminal y ver errores
`);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
});
