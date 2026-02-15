
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying Purchase Logs for Nestea...");

    // 1. Find the Item
    const items = await prisma.supplyItem.findMany({
        take: 50,
        select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            defaultUnit: true,
            currentCost: true
        }
    });

    // Debug: List similar items
    const matches = items.filter(i => i.name.toLowerCase().includes('nestea'));
    console.log("Matches found:", matches.map(m => m.name));

    const item = matches[0] || items.find(i => i.name.toLowerCase().includes('nest'));

    if (!item) {
        console.error("Item 'Nestea' not found in first 50 items!");
        console.log("Variables:", items.map(i => i.name).slice(0, 10)); // Show some names
        return;
    }

    // 2. Check Price History (to confirm purchase time)
    const history = await prisma.priceHistory.findMany({
        where: { supplyItemId: item.id },
        orderBy: { changeDate: 'desc' },
        take: 5
    });

    console.log("\n--- Recent Price History ---");
    history.forEach(h => {
        console.log(`[${h.changeDate.toISOString()}] $${h.oldCost.toFixed(2)} -> $${h.newCost.toFixed(2)} (Supplier: ${h.supplierId})`);
    });

    // 3. Check Inventory Logs
    const logs = await prisma.inventoryLog.findMany({
        where: { supplyItemId: item.id },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log("\n--- Recent Inventory Logs ---");
    if (logs.length === 0) {
        console.log("NO LOGS FOUND!");
    } else {
        logs.forEach(l => {
            console.log(`[${l.createdAt.toISOString()}] Reason: ${l.reason} | Change: ${l.changeAmount} | Notes: ${l.notes} | Tenant: ${l.tenantId}`);
        });
    }

    // 4. Check Raw Transactions checking for 'PURCHASE'
    // We can't easily link transaction to item directly without inspecting details or if we added supplyItemId to transaction (which we did!)
    const txs = await prisma.cashTransaction.findMany({
        where: {
            supplyItemId: item.id,
            type: 'PURCHASE'
        },
        orderBy: { timestamp: 'desc' },
        take: 5
    });

    console.log("\n--- Recent Cash Transactions (Linked) ---");
    txs.forEach(t => {
        console.log(`[${t.timestamp.toISOString()}] Amount: $${t.amount} | Qty: ${t.quantity} | Desc: ${t.description}`);
    });

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
