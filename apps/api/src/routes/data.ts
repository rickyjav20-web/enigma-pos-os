import { FastifyInstance } from 'fastify';
import { productIngestService } from '../services/ProductIngestService';
import prisma from '../lib/prisma';

export default async function (fastify: FastifyInstance) {

    // POST /api/v1/data/import
    // Body: { csvContent: string, tenantId: string }
    fastify.post('/data/import', async (request, reply) => {
        const { csvContent, tenantId } = request.body as { csvContent: string, tenantId: string };

        if (!csvContent || !tenantId) {
            return reply.code(400).send({ error: 'Missing csvContent or tenantId' });
        }

        try {
            const result = await productIngestService.ingestLoyverseExport(csvContent, tenantId);
            return reply.send({ success: true, ...result });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Import failed', details: (error as Error).message });
        }
    });

    // GET /api/v1/data/export
    // Query: ?tenantId=...
    fastify.get('/data/export', async (request, reply) => {
        const tenantId = request.tenantId || (request.query as any).tenantId;

        if (!tenantId) {
            return reply.code(400).send({ error: 'Missing tenantId' });
        }

        try {
            // Fetch all Products and SupplyItems
            const products = await prisma.product.findMany({ where: { tenantId } });
            const supplyItems = await prisma.supplyItem.findMany({
                where: { tenantId },
                include: { ingredients: { include: { component: true } } }
            });

            // Convert to CSV manually (Loyverse Format ish)
            const rows = [];
            // Header
            rows.push([
                'Handle', 'Nombre', 'REF', 'Categoria', 'Precio', 'Coste',
                'REF del componente', 'Cantidad del componente', 'Vendido por'
            ].join(','));

            // 1. Supply Items (Ingredients & Batches)
            for (const item of supplyItems) {
                // Main Row
                rows.push([
                    item.sku ?? '',
                    `"${item.name}"`, // Quote name for safety
                    item.sku ?? '',
                    item.category ?? '',
                    '0', // Not sold primarily
                    item.currentCost.toFixed(4),
                    '', '', // Component cols empty for main row
                    item.defaultUnit
                ].join(','));

                // Recipe Rows (if Batch)
                if (item.ingredients.length > 0) {
                    for (const ing of item.ingredients) {
                        rows.push([
                            item.sku ?? '', // Parent Handle
                            '', '', '', '', '', // Empty main info
                            ing.component.sku ?? '', // Component SKU
                            ing.quantity.toString(),
                            ''
                        ].join(','));
                    }
                }
            }

            // 2. Products (Sold Items)
            for (const prod of products) {
                rows.push([
                    prod.loyverseId ?? '',
                    `"${prod.name}"`,
                    prod.sku ?? '',
                    'Product', // Todo: store real category
                    prod.price.toFixed(2),
                    prod.cost?.toFixed(4) ?? '0',
                    '', '',
                    'Unit'
                ].join(','));

                // TODO: Fetch Product Recipes too if we want full fidelity export.
                // For MVP, exporting SupplyItems with structure is the main goal.
            }

            const csvString = rows.join('\n');

            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', 'attachment; filename="enigma_inventory.csv"');
            return reply.send(csvString);

        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Export failed' });
        }
    });

    // GET /api/v1/data/export/staff
    // CSV Export of Staff and Shifts
    // CSV Export of Staff and Shifts
    fastify.get('/data/export/staff', async (request, reply) => {
        const tenantId = request.tenantId || (request.query as any).tenantId;

        if (!tenantId) return reply.code(400).send({ error: 'Missing tenantId' });

        try {
            const employees = await prisma.employee.findMany({
                where: { tenantId },
                include: { shifts: { orderBy: { clockIn: 'desc' }, take: 500 } } // Last 500 shifts per employee
            });

            const rows = [];
            // Header
            rows.push([
                'ID', 'Name', 'Role', 'Status', 'PIN',
                'Email', 'Phone', 'Address',
                'GovID', 'Nationality', 'BirthDate', 'StartDate',
                'EmergencyContact', 'EmergencyPhone',
                'PaymentMethod', 'BankName', 'AccountNumber', 'AccountHolder',
                'SalaryType', 'SalaryAmount', 'Currency',
                'Notes',
                'Last Shift Start', 'Last Shift End'
            ].join(','));

            for (const emp of employees) {
                // Helper to safe quote CSV string
                const q = (str: string | null | undefined) => `"${(str || '').replace(/"/g, '""')}"`;
                const d = (date: Date | null | undefined) => date ? date.toISOString().split('T')[0] : '';

                const lastShift = emp.shifts[0];
                rows.push([
                    emp.id,
                    q(emp.fullName),
                    q(emp.role),
                    emp.status,
                    emp.pinCode,
                    q(emp.email),
                    q(emp.phone),
                    q(emp.address),
                    q(emp.govId),
                    q(emp.nationality),
                    d(emp.birthDate),
                    d(emp.startDate),
                    q(emp.emergencyContact),
                    q(emp.emergencyPhone),
                    q(emp.paymentMethod),
                    q(emp.bankName),
                    q(emp.accountNumber),
                    q(emp.accountHolder),
                    q(emp.salaryType),
                    emp.salaryAmount?.toString() || '0',
                    emp.currency,
                    q(emp.notes),
                    lastShift ? lastShift.clockIn.toISOString() : '',
                    lastShift && lastShift.clockOut ? lastShift.clockOut.toISOString() : ''
                ].join(','));
            }

            const csvString = rows.join('\n');
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', 'attachment; filename="enigma_staff.csv"');
            return reply.send(csvString);

        } catch (e) {
            return reply.code(500).send({ error: 'Staff export failed' });
        }
    });

    // GET /api/v1/data/backup/full
    // FULL JSON DUMP (The Parachute)
    fastify.get('/data/backup/full', async (request, reply) => {
        const { tenantId } = request.query as { tenantId: string };
        if (!tenantId) return reply.code(400).send({ error: 'Missing tenantId' });

        try {
            // Parallel Fetch for Speed
            const [tenant, employees, shifts, products, supplyItems, purchaseOrders] = await Promise.all([
                prisma.tenant.findUnique({ where: { id: tenantId } }),
                prisma.employee.findMany({ where: { tenantId } }),
                prisma.shift.findMany({ where: { tenantId } }),
                prisma.product.findMany({ where: { tenantId } }),
                prisma.supplyItem.findMany({ where: { tenantId }, include: { ingredients: true } }),
                prisma.purchaseOrder.findMany({ where: { tenantId }, include: { lines: true } })
            ]);

            const backup = {
                metadata: {
                    timestamp: new Date(),
                    version: 'v0.01',
                    tenant: tenant?.name
                },
                data: {
                    tenant,
                    employees,
                    shifts,
                    products,
                    supplyItems,
                    purchaseOrders
                    // SalesOrders would go here when implemented
                }
            };

            reply.header('Content-Type', 'application/json');
            reply.header('Content-Disposition', `attachment; filename="enigma_backup_${Date.now()}.json"`);
            return reply.send(backup);

        } catch (e) {
            return reply.code(500).send({ error: 'Full backup failed', details: (e as Error).message });
        }
    });
}
