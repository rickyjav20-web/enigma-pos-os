import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Clean up (Optional - be careful in prod)
    // await prisma.shift.deleteMany();
    // await prisma.employee.deleteMany();
    // await prisma.tenant.deleteMany();

    // 2. Create Tenant (MATCHING FRONTEND DEFAULT)
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'enigma_hq' },
        update: {},
        create: {
            name: 'Enigma HQ',
            slug: 'enigma_hq',
        },
    });
    console.log('🏢 Tenant created:', tenant.name);

    // 3. Create Staff
    const admin = await prisma.employee.upsert({
        where: { id: 'emp-admin-01' },
        update: { tenantId: tenant.id }, // Ensure it moves to new tenant if exists
        create: {
            id: 'emp-admin-01',
            tenantId: tenant.id,
            fullName: 'Ricky Admin',
            role: 'ADMIN',
            pinCode: '1234',
            email: 'admin@enigma.com',
        },
    });

    // Re-create staff for this tenant if they don't exist
    const staff1 = await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: 'Juan Perez',
            role: 'WAITER',
            pinCode: '0001',
            status: 'active',
            salaryType: 'hourly',
            salaryAmount: 5.0,
        },
    });

    const staff2 = await prisma.employee.create({
        data: {
            tenantId: tenant.id,
            fullName: 'Maria Gonzalez',
            role: 'CHEF',
            pinCode: '0002',
            status: 'active',
            salaryType: 'fixed',
            salaryAmount: 1200.0,
        },
    });
    console.log('👥 Staff created: 1 Admin, 2 Employees');

    // 4. Create Suppliers
    const sysco = await prisma.supplier.create({
        data: {
            tenantId: tenant.id,
            name: 'Sysco International',
            category: 'General',
            email: 'orders@sysco.com',
            phone: '+1-800-SYSCO',
            notes: 'Main distributor for dry goods.',
        },
    });

    const localFarm = await prisma.supplier.create({
        data: {
            tenantId: tenant.id,
            name: 'Finca La Esperanza',
            category: 'Frescos',
            email: 'contacto@laesperanza.com',
            phone: '+58-414-1234567',
            notes: 'Vegetables provided every Tuesday.',
        },
    });
    console.log('🚚 Suppliers created');

    // 5. Create Inventory (SupplyItems)
    const flour = await prisma.supplyItem.create({
        data: {
            tenantId: tenant.id,
            name: 'Harina de Trigo (Todo Uso)',
            category: 'Secos',
            defaultUnit: 'kg',
            currentCost: 1.50,
            averageCost: 1.45,
            stockQuantity: 50,
            preferredSupplierId: sysco.id,
        },
    });

    const tomatoes = await prisma.supplyItem.create({
        data: {
            tenantId: tenant.id,
            name: 'Tomates Perita',
            category: 'Vegetales',
            defaultUnit: 'kg',
            currentCost: 2.20,
            averageCost: 2.00,
            stockQuantity: 15,
            preferredSupplierId: localFarm.id,
        },
    });

    const cheese = await prisma.supplyItem.create({
        data: {
            tenantId: tenant.id,
            name: 'Queso Mozzarella',
            category: 'Lácteos',
            defaultUnit: 'kg',
            currentCost: 8.50,
            averageCost: 8.20,
            stockQuantity: 10,
            preferredSupplierId: sysco.id,
        },
    });
    console.log('📦 Inventory items created');

    // 6. Create Price History (for Smart Shopper)
    await prisma.priceHistory.create({
        data: {
            supplyItemId: tomatoes.id,
            supplierId: localFarm.id,
            oldCost: 1.80,
            newCost: 2.20,
            changeDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        },
    });

    await prisma.priceHistory.create({
        data: {
            supplyItemId: cheese.id,
            supplierId: sysco.id,
            oldCost: 7.90,
            newCost: 8.50,
            changeDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },
    });
    console.log('📈 Price history populated');

    // 7. Create Products & Recipes
    const pizza = await prisma.product.create({
        data: {
            tenantId: tenant.id,
            name: 'Pizza Margarita',
            price: 12.00,
            cost: 3.50, // Calculated manually for seed
            categoryId: 'Pizzas',
        },
    });

    await prisma.productRecipe.create({
        data: {
            productId: pizza.id,
            supplyItemId: flour.id,
            quantity: 0.3, // 300g
            unit: 'kg',
        },
    });

    await prisma.productRecipe.create({
        data: {
            productId: pizza.id,
            supplyItemId: cheese.id,
            quantity: 0.2, // 200g
            unit: 'kg',
        },
    });

    await prisma.productRecipe.create({
        data: {
            productId: pizza.id,
            supplyItemId: tomatoes.id,
            quantity: 0.15, // 150g
            unit: 'kg',
        },
    });
    console.log('🍕 Products and recipes created');

    console.log('✅ Seed complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
