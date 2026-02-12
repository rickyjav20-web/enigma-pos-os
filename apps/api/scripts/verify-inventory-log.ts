
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching latest inventory logs...");

    const logs = await prisma.inventoryLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
            supplyItem: true
        }
    });

    if (logs.length === 0) {
        console.log("No inventory logs found.");
    } else {
        console.table(logs.map(log => ({
            Date: log.createdAt.toISOString(),
            Item: log.supplyItem.name,
            Change: log.changeAmount,
            Reason: log.reason,
            Previous: log.previousStock,
            New: log.newStock
        })));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
