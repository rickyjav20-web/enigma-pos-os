import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1'; // Production URL

async function main() {
    console.log('🔍 Starting Diagnostic for Staff Login...');

    // 1. Check Tenants in DB
    const tenants = await prisma.tenant.findMany();
    console.log(`\n🏢 Found ${tenants.length} Tenants:`);
    tenants.forEach(t => console.log(` - ID: ${t.id} | Slug: ${t.slug} | Name: ${t.name}`));

    if (tenants.length === 0) {
        console.error('❌ No tenants found! Seed might have failed.');
        return;
    }

    const defaultTenant = tenants.find(t => t.slug === 'enigma_hq') || tenants[0];
    console.log(`\n🎯 Using Tenant for Test: ${defaultTenant.name} (${defaultTenant.id})`);

    // 2. Check Employees in DB for this Tenant
    const employees = await prisma.employee.findMany({
        where: { tenantId: defaultTenant.id }
    });
    console.log(`\n👥 Found ${employees.length} Employees:`);
    employees.forEach(e => console.log(` - ${e.fullName} | Role: ${e.role} | PIN: '${e.pinCode}' | Status: ${e.status}`));

    // 3. Simulate Login Request (External API Call)
    console.log('\n🔐 Testing Login via API Endpoint...');
    const pinToTest = '0001';

    try {
        const response = await axios.post(`${API_URL}/auth/verify-pin`,
            { pin: pinToTest },
            { headers: { 'x-tenant-id': defaultTenant.id } }
        );
        console.log('✅ Login SUCCESS:', response.data);
    } catch (error: any) {
        console.error('❌ Login FAILED:', error.response?.data || error.message);
        console.log('   Headers sent:', { 'x-tenant-id': defaultTenant.id });
    }

    // 4. Test with 'enigma_hq' slug as ID (Common mistake)
    console.log('\n🔐 Testing Login with Slug as ID (Common Frontend Mistake)...');
    try {
        const response = await axios.post(`${API_URL}/auth/verify-pin`,
            { pin: pinToTest },
            { headers: { 'x-tenant-id': 'enigma_hq' } }
        );
        console.log('✅ Login SUCCESS (Using Slug):', response.data);
    } catch (error: any) {
        console.error('❌ Login FAILED (Using Slug):', error.response?.data || error.message);
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
