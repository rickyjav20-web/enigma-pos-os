
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

async function runTest() {
    console.log("🚀 Starting End-to-End Cash Register Verification...");

    try {
        // --- PREP: Clean up previous test data ---
        console.log("🧹 Cleaning up previous test data...");
        const testEmployee = await prisma.employee.findFirst({ where: { fullName: 'Test Waitress' } });
        if (testEmployee) {
            await prisma.cashTransaction.deleteMany({ where: { session: { employeeId: testEmployee.id } } });
            await prisma.registerSession.deleteMany({ where: { employeeId: testEmployee.id } });
            await prisma.employee.delete({ where: { id: testEmployee.id } });
        }

        // --- STEP 1: Create Employee (Staff Module) ---
        console.log("👤 Creating Test Employee...");
        const employee = await prisma.employee.create({
            data: {
                tenantId: 'enigma_hq',
                fullName: 'Test Waitress',
                role: 'Mesero',
                pinCode: '9999',
                status: 'active'
            }
        });
        console.log(`✅ Employee Created: ${employee.fullName} (PIN: 9999)`);

        // --- STEP 2: Login (Auth) ---
        console.log("⏳ Waiting for API to be ready...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log("🔐 Testing Login...");
        const loginRes = await axios.post(`${API_URL}/auth/employee-login`, { pin: '9999' }, { headers: { 'x-tenant-id': TENANT_ID } });
        if (!loginRes.data.employee) throw new Error("Login failed");
        console.log("✅ Login Successful");

        // --- STEP 3: Open Register (Apertura) ---
        console.log("🔓 Opening Register...");
        const openRes = await axios.post(`${API_URL}/register/open`, {
            employeeId: employee.id,
            startingCash: 100.00
        }, { headers: { 'x-tenant-id': TENANT_ID } });
        const sessionId = openRes.data.id;
        console.log(`✅ Register Opened. Session ID: ${sessionId}. Starting Cash: $100.00`);

        // --- STEP 4: Manual Sale (Venta Manual) ---
        console.log("💰 Registering Manual Cash Sale...");
        await axios.post(`${API_URL}/register/transaction`, {
            sessionId: sessionId,
            amount: 15.50,
            type: 'SALE',
            description: 'Mesa 1 - Lunch',
            referenceId: 'TEST-SALE-1'
        }, { headers: { 'x-tenant-id': TENANT_ID } });
        console.log("✅ Cash Sale Registered: +$15.50");

        // --- STEP 5: Purchase (Compra - Flujo Automático) ---
        // First create a supplier
        const supplier = await prisma.supplier.create({
            data: { tenantId: TENANT_ID, name: 'Test Supplier', category: 'General' }
        });

        console.log("🚚 Registering Cash Purchase...");
        // Call the purchase endpoint which should trigger the cash deduction
        await axios.post(`${API_URL}/purchases`, {
            tenantId: TENANT_ID,
            supplierId: supplier.id,
            date: new Date(),
            totalAmount: 40.00,
            status: 'confirmed',
            paymentMethod: 'cash', // CRITICAL
            registeredById: employee.id, // CRITICAL
            lines: [] // Empty for test
        }, { headers: { 'x-tenant-id': TENANT_ID } });
        console.log("✅ Cash Purchase Registered: -$40.00");

        // --- STEP 6: Manual Expense ---
        console.log("💸 Registering Manual Expense...");
        await axios.post(`${API_URL}/register/transaction`, {
            sessionId: sessionId,
            amount: -5.00, // Expense is negative
            type: 'EXPENSE',
            description: 'Ice Bag',
        }, { headers: { 'x-tenant-id': TENANT_ID } });
        console.log("✅ Expense Registered: -$5.00");

        // --- STEP 7: Verify Current Balance (Backend Only Audit) ---
        const txRes = await axios.get(`${API_URL}/register/transactions/${sessionId}`, { headers: { 'x-tenant-id': TENANT_ID } });
        const transactions = txRes.data;
        const totalTx = transactions.reduce((acc: number, tx: any) => acc + tx.amount, 0);
        const expectedCash = 100 + 15.50 - 40.00 - 5.00; // 70.50

        console.log(`📊 Audit Check:
        Starting: $100.00
        Sale: +$15.50
        Purchase: -$40.00
        Expense: -$5.00
        ----------------
        Expected: $70.50
        Actual Sum: $${(100 + totalTx).toFixed(2)}
        `);

        if (Math.abs((100 + totalTx) - expectedCash) > 0.01) {
            throw new Error(`❌ Balance Mismatch! Expected ${expectedCash}, got ${100 + totalTx}`);
        }
        console.log("✅ Balance Matches Perfectly.");

        // --- STEP 8: Blind Close (Cierre) ---
        console.log("🔒 Closing Register (Blind Mock)...");
        // We simulate the user counting correctly
        const closeRes = await axios.post(`${API_URL}/register/close`, {
            sessionId: sessionId,
            declaredCash: 70.50, // Correct amount
            declaredCard: 0,
            declaredTransfer: 0,
            notes: 'All good'
        }, { headers: { 'x-tenant-id': TENANT_ID } });

        console.log("✅ Register Closed.");
        console.log("📝 Close Report:", closeRes.data);

        // Final Verify in DB
        const finalSession = await prisma.registerSession.findUnique({ where: { id: sessionId } });
        if (finalSession?.status !== 'closed') throw new Error("Session status is not closed");

        console.log("🎉 FINAL SUCCESS: Full Flow Verified.");

    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
        if (error.response) {
            console.error("API Error Status:", error.response.status);
            console.error("API Error Data:", JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error("No response received from API");
        }
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
