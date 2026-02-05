
const API_URL = 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

async function bugHunterTest() {
    console.log('🤠 STARTING BUG HUNTER AUDIT (API MODE)...');

    try {
        // PRE-STEP: Ensure Supplier Exists
        console.log('\n[PRE-STEP] Checking Suppliers...');
        let supplierId;
        const supRes = await fetch(`${API_URL}/suppliers`, { headers: { 'x-tenant-id': TENANT_ID } });
        const suppliers = await supRes.json();

        if (suppliers && suppliers.length > 0) {
            supplierId = suppliers[0].id; // Use first available
            console.log(`✅ Using existing supplier: ${suppliers[0].name} (${supplierId})`);
        } else {
            // Create one
            console.log('Creating dummy supplier...');
            const createSupRes = await fetch(`${API_URL}/suppliers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
                body: JSON.stringify({ name: 'Mercado General', category: 'General' })
            });
            if (!createSupRes.ok) throw new Error('Failed to create supplier');
            const newSup = await createSupRes.json();
            supplierId = newSup.id;
            console.log(`✅ Created supplier: Mercado General (${supplierId})`);
        }

        // 1. CREATE ITEM (Simulate New Ingredient Modal)
        console.log('\n[STEP 1] Creating "Harina Audit"...');
        const createRes = await fetch(`${API_URL}/supply-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
            body: JSON.stringify({
                name: `Harina Audit ${Date.now()}`,
                category: 'Otros',
                defaultUnit: 'kg',
                currentCost: 4.00,
                sku: `AUDIT-${Date.now()}`
            })
        });

        if (!createRes.ok) throw new Error(`Create failed: ${await createRes.text()}`);
        const itemRes = await createRes.json();
        const item = itemRes.data || itemRes;
        const itemId = item.id;
        console.log(`✅ Item Created: ${item.name} (ID: ${itemId})`);


        // 2. SIMULATE PURCHASE (Cart Checkout)
        console.log('\n[STEP 2] Processing Purchase of 10kg...');
        const purchaseRes = await fetch(`${API_URL}/purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
            body: JSON.stringify({
                supplierId: supplierId, // Valid ID now
                status: 'confirmed',
                items: [{
                    supplyItemId: itemId,
                    quantity: 10, // Normalized quantity (kg)
                    unitCost: 3.50, // $35 / 10kg
                    purchaseUnit: 'kg',
                    purchaseQuantity: 10,
                    purchasePrice: 35.00,
                    priceType: 'total'
                }]
            })
        });

        if (!purchaseRes.ok) throw new Error(`Purchase failed: ${await purchaseRes.text()}`);
        console.log('✅ Purchase Confirmed');


        // 3. VERIFY INVENTORY (HQ Check)
        await new Promise(r => setTimeout(r, 1000));

        console.log('\n[STEP 3] Verifying Inventory...');
        const verifyRes = await fetch(`${API_URL}/supply-items/${itemId}`, {
            headers: { 'x-tenant-id': TENANT_ID }
        });
        const verifiedItem = await verifyRes.json();

        console.log(`📉 Stock Level: ${verifiedItem.stockQuantity} ${verifiedItem.defaultUnit}`);
        console.log(`💰 Current Cost: $${verifiedItem.currentCost}`);


        // 4. SMART SHOPPER check
        console.log('\n[STEP 4] Running Smart Shopper Optimization...');
        const analyzeRes = await fetch(`${API_URL}/optimizer/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
            body: JSON.stringify({
                items: [{ id: itemId, quantity: 5 }]
            })
        });

        const plan = await analyzeRes.json();
        const suppliersFound = Object.keys(plan || {});
        console.log(`🧠 Optimization Result: Found ${suppliersFound.length} supplier(s)`);
        console.log('Supplier Names:', suppliersFound);

        console.log('\n🤠 AUDIT COMPLETE.');

    } catch (e) {
        console.error('❌ TEST FAILED:', e);
    }
}

bugHunterTest();
