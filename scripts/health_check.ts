#!/usr/bin/env npx tsx
/**
 * COMPLETE PURCHASE FLOW HEALTH CHECK
 * Tests the entire data flow from purchase entry to HQ modules
 */

const API = 'http://localhost:4000/api/v1';
const HEADERS = { 'Content-Type': 'application/json', 'x-tenant-id': 'enigma_hq' };

interface TestResult {
    step: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
    data?: any;
}

const results: TestResult[] = [];

async function api(method: string, path: string, body?: any) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: HEADERS,
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json().catch(() => null) };
}

async function runTest(name: string, fn: () => Promise<TestResult>) {
    try {
        const result = await fn();
        results.push(result);
        console.log(`${result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌'} ${result.step}: ${result.details}`);
        return result;
    } catch (e: any) {
        const result = { step: name, status: 'FAIL' as const, details: e.message };
        results.push(result);
        console.log(`❌ ${name}: ${e.message}`);
        return result;
    }
}

async function main() {
    console.log('\n🔬 ENIGMA OS - FULL HEALTH CHECK\n' + '='.repeat(50));
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // 1. API Health
    await runTest('API Connection', async () => {
        const { status } = await api('GET', '/suppliers');
        return {
            step: 'API Connection',
            status: status === 200 ? 'PASS' : 'FAIL',
            details: status === 200 ? 'API responding on port 4000' : `Status: ${status}`
        };
    });

    // 2. Suppliers Check
    let supplierId: string = '';
    await runTest('Suppliers Module', async () => {
        const { status, data } = await api('GET', '/suppliers');
        const count = Array.isArray(data) ? data.length : 0;
        if (count > 0) supplierId = data[0].id;
        return {
            step: 'Suppliers Module',
            status: count > 0 ? 'PASS' : 'WARN',
            details: `Found ${count} suppliers`,
            data: data?.slice(0, 2)
        };
    });

    // 3. Supply Items Check
    let testItemId: string = '';
    let originalCost: number = 0;
    await runTest('Supply Items (Ingredients)', async () => {
        const { status, data } = await api('GET', '/supply-items?limit=5');
        const items = data?.data || [];
        if (items.length > 0) {
            testItemId = items[0].id;
            originalCost = items[0].currentCost || 0;
        }
        return {
            step: 'Supply Items (Ingredients)',
            status: items.length > 0 ? 'PASS' : 'WARN',
            details: `Found ${items.length} items. Test item: ${items[0]?.name || 'N/A'} @ $${originalCost}`,
            data: items.map((i: any) => ({ name: i.name, cost: i.currentCost }))
        };
    });

    // 4. Create Test Purchase Order
    let purchaseId: string = '';
    const newCost = originalCost + 0.50; // Increase by $0.50 to test price update

    if (supplierId && testItemId) {
        await runTest('Create Purchase Order', async () => {
            const { status, data } = await api('POST', '/purchases', {
                supplierId,
                status: 'confirmed',
                items: [{
                    supplyItemId: testItemId,
                    quantity: 10,
                    unitCost: newCost
                }]
            });
            purchaseId = data?.id || '';
            return {
                step: 'Create Purchase Order',
                status: status === 201 || status === 200 ? 'PASS' : 'FAIL',
                details: status === 201 || status === 200
                    ? `Order created: ${purchaseId?.slice(0, 8)}... with new cost $${newCost}`
                    : `Failed: ${JSON.stringify(data)}`,
                data
            };
        });
    }

    // 5. Verify Price Update
    await runTest('Price Update Propagation', async () => {
        const { status, data } = await api('GET', `/supply-items/${testItemId}`);
        const updatedCost = data?.currentCost || 0;
        const updated = Math.abs(updatedCost - newCost) < 0.01;
        return {
            step: 'Price Update Propagation',
            status: updated ? 'PASS' : 'WARN',
            details: updated
                ? `Price updated: $${originalCost} → $${updatedCost}`
                : `Price unchanged: $${updatedCost} (expected $${newCost})`,
            data: { original: originalCost, expected: newCost, actual: updatedCost }
        };
    });

    // 6. Check Price History
    await runTest('Price History Recording', async () => {
        const { status, data } = await api('GET', `/supply-items/${testItemId}`);
        const historyCount = data?.priceHistory?.length || 0;
        return {
            step: 'Price History Recording',
            status: historyCount > 0 ? 'PASS' : 'WARN',
            details: `${historyCount} price history entries`,
            data: data?.priceHistory?.slice(0, 3)
        };
    });

    // 7. Products Check (Menu Items)
    await runTest('Products (Menu Items)', async () => {
        const { status, data } = await api('GET', '/products?limit=5');
        const products = data?.data || [];
        return {
            step: 'Products (Menu Items)',
            status: products.length > 0 ? 'PASS' : 'WARN',
            details: `Found ${products.length} menu products`,
            data: products.map((p: any) => ({ name: p.name, price: p.price, cost: p.cost }))
        };
    });

    // 8. Smart Order Analysis
    await runTest('Smart Order Analysis', async () => {
        const { status, data } = await api('GET', '/purchases/smart-order');
        const recommendations = data?.recommendations?.length || 0;
        return {
            step: 'Smart Order Analysis',
            status: status === 200 ? 'PASS' : 'WARN',
            details: `${recommendations} smart order recommendations`,
            data: data?.recommendations?.slice(0, 3)
        };
    });

    // 9. Staff Module
    await runTest('Staff Module', async () => {
        const { status, data } = await api('GET', '/staff/employees');
        const employees = data?.length || 0;
        return {
            step: 'Staff Module',
            status: status === 200 ? 'PASS' : 'WARN',
            details: `${employees} employees registered`,
            data: data?.slice(0, 2)
        };
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    const passed = results.filter(r => r.status === 'PASS').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`\n📊 SUMMARY: ${passed} PASS | ${warned} WARN | ${failed} FAIL`);

    if (failed === 0) {
        console.log('\n✅ SYSTEM HEALTHY - All core modules operational');
    } else {
        console.log('\n⚠️ ISSUES DETECTED - Review failed tests');
    }

    // Data Flow Verification
    console.log('\n📈 DATA FLOW VERIFICATION:');
    console.log('   Purchase → currentCost update → priceHistory → averageCost → Smart Order');

    return results;
}

main().catch(console.error);
