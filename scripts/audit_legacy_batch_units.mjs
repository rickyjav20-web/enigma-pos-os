const API_URL = process.env.ENIGMA_API_URL || 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_ID = process.env.ENIGMA_TENANT_ID || 'enigma_hq';

async function fetchJson(path) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: {
            'x-tenant-id': TENANT_ID,
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed ${response.status} for ${path}`);
    }

    return response.json();
}

function summarizeProductUsage(products, item) {
    const usages = [];

    for (const product of products) {
        for (const recipe of product.recipes || []) {
            if (recipe.supplyItemId !== item.id) continue;
            usages.push({
                product: product.name,
                rawQuantity: Number(recipe.quantity) || 0,
                rawUnit: recipe.unit || 'und',
                suggestedQuantity: (Number(recipe.quantity) || 0) * Number(item.yieldQuantity || 1),
                suggestedUnit: item.yieldUnit || 'und',
            });
        }
    }

    return usages;
}

async function main() {
    console.log('=== Legacy Batch Unit Audit ===');
    console.log(`API: ${API_URL}`);
    console.log(`Tenant: ${TENANT_ID}`);

    const [supplyItemsPayload, productsPayload] = await Promise.all([
        fetchJson('/supply-items?limit=1000'),
        fetchJson('/products'),
    ]);

    const supplyItems = supplyItemsPayload?.data || [];
    const products = productsPayload?.data || [];

    const legacyItems = supplyItems
        .filter(item =>
            Boolean(
                item?.isProduction &&
                Number(item?.yieldQuantity) > 1 &&
                item?.yieldUnit &&
                (!item?.recipeUnit || item.recipeUnit === 'und') &&
                Number(item?.stockCorrectionFactor || 1) === 1
            )
        )
        .map(item => {
            const usages = summarizeProductUsage(products, item);
            const hasFractionalUsage = usages.some(usage => usage.rawQuantity > 0 && usage.rawQuantity < 1);
            const hasUnitMismatch = item.defaultUnit !== item.yieldUnit;

            return {
                item,
                usages,
                hasFractionalUsage,
                hasUnitMismatch,
            };
        })
        .filter(entry => entry.hasUnitMismatch || entry.hasFractionalUsage);

    if (legacyItems.length === 0) {
        console.log('No legacy batch candidates found.');
        return;
    }

    console.log(`Found ${legacyItems.length} legacy batch candidates.\n`);

    for (const { item, usages, hasFractionalUsage, hasUnitMismatch } of legacyItems) {
        console.log(`- ${item.name}`);
        console.log(`  stock: ${item.stockQuantity} ${item.defaultUnit}`);
        console.log(`  output: ${item.yieldQuantity} ${item.yieldUnit}`);
        console.log(`  flagged because: ${[
            hasUnitMismatch ? 'stock/output unit mismatch' : null,
            hasFractionalUsage ? 'downstream recipes use batch fractions' : null,
        ].filter(Boolean).join(' + ')}`);
        console.log(`  suggested stock/recipe unit: ${item.yieldUnit}`);

        if (usages.length === 0) {
            console.log('  downstream products: none\n');
            continue;
        }

        console.log('  downstream products:');
        for (const usage of usages) {
            console.log(
                `    • ${usage.product}: ${usage.rawQuantity} ${usage.rawUnit} -> ${usage.suggestedQuantity.toFixed(3)} ${usage.suggestedUnit}`
            );
        }
        console.log('');
    }
}

main().catch((error) => {
    console.error('Legacy batch audit failed:', error);
    process.exitCode = 1;
});
