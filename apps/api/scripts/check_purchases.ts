
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking recent Purchase Orders...");

    const purchases = await prisma.purchaseOrder.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
            supplier: { select: { name: true } },
            registeredBy: { select: { fullName: true } }
        }
    });

    console.table(purchases.map(p => ({
        id: p.id.split('-')[0],
        supplier: p.supplier.name,
        total: p.totalAmount,
        method: p.paymentMethod,
        registeredBy: p.registeredBy?.fullName || 'N/A',
        status: p.status,
        date: p.date.toISOString()
    })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
