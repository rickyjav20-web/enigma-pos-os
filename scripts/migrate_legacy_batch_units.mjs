import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = process.env.ENIGMA_API_URL || 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_ID = process.env.ENIGMA_TENANT_ID || 'enigma_hq';
const EXECUTE = process.argv.includes('--execute');

async function fetchJson(pathname, options = {}) {
    const response = await fetch(`${API_URL}${pathname}`, {
        headers: {
            'x-tenant-id': TENANT_ID,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed ${response.status} for ${pathname}: ${text}`);
    }

    return response.status === 204 ? null : response.json();
}

function normalizeUnit(unit) {
    return (unit || 'und').trim().toLowerCase();
}

function roundRecipeQuantity(value) {
    const roundedInt = Math.round(value);
    if (Math.abs(value - roundedInt) < 0.01) return roundedInt;
    return Math.round(value * 1000) / 1000;
}

function isSafeDiscreteConversion(item, usage) {
    const targetUnit = normalizeUnit(item.yieldUnit || item.defaultUnit || 'und');
    if (targetUnit !== 'und') return true;
    const converted = (Number(usage.rawQuantity) || 0) * Number(item.yieldQuantity || 1);
    return Math.abs(converted - Math.round(converted)) < 0.05 || converted >= 1;
}

function summarizeProductUsage(products, item) {
    const usages = [];

    for (const product of products) {
        for (const recipe of product.recipes || []) {
            if (recipe.supplyItemId !== item.id) continue;
            usages.push({
                ownerType: 'product',
                ownerId: product.id,
                ownerName: product.name,
                rawQuantity: Number(recipe.quantity) || 0,
                rawUnit: recipe.unit || 'und',
                suggestedQuantity: roundRecipeQuantity((Number(recipe.quantity) || 0) * Number(item.yieldQuantity || 1)),
                suggestedUnit: item.yieldUnit || 'und',
            });
        }
    }

    return usages;
}

function summarizeBatchUsage(supplyItems, item) {
    const usages = [];

    for (const parent of supplyItems) {
        for (const ingredient of parent.ingredients || []) {
            if (ingredient.supplyItemId !== item.id) continue;
            usages.push({
                ownerType: 'batch',
                ownerId: parent.id,
                ownerName: parent.name,
                rawQuantity: Number(ingredient.quantity) || 0,
                rawUnit: ingredient.unit || 'und',
                suggestedQuantity: roundRecipeQuantity((Number(ingredient.quantity) || 0) * Number(item.yieldQuantity || 1)),
                suggestedUnit: item.yieldUnit || 'und',
            });
        }
    }

    return usages;
}

function isLegacyCandidate(item, usages) {
    const hasFractionalUsage = usages.some((usage) => usage.rawQuantity > 0 && usage.rawQuantity < 1);
    const hasUnitMismatch = normalizeUnit(item.defaultUnit) !== normalizeUnit(item.yieldUnit);

    const baseLegacy =
        item?.isProduction &&
        Number(item?.yieldQuantity) > 1 &&
        item?.yieldUnit &&
        (!item?.recipeUnit || item.recipeUnit === 'und') &&
        Number(item?.stockCorrectionFactor || 1) === 1;

    return {
        baseLegacy,
        hasFractionalUsage,
        hasUnitMismatch,
        actionable: Boolean(baseLegacy && (hasFractionalUsage || hasUnitMismatch)),
    };
}

function shouldTransformUsage(item, line) {
    const targetUnit = normalizeUnit(item.yieldUnit || item.defaultUnit || 'und');
    const rawUnit = normalizeUnit(line.unit || 'und');
    const rawQuantity = Number(line.quantity) || 0;
    const legacyDefaultUnit = normalizeUnit(item.defaultUnit);

    return (
        rawUnit !== targetUnit ||
        (rawQuantity > 0 && rawQuantity < 1 && Number(item.yieldQuantity || 1) > 1) ||
        (legacyDefaultUnit !== targetUnit && rawUnit === legacyDefaultUnit)
    );
}

function buildTransformedLine(item, line) {
    if (!shouldTransformUsage(item, line)) return { changed: false, line };

    return {
        changed: true,
        line: {
            ...line,
            quantity: roundRecipeQuantity((Number(line.quantity) || 0) * Number(item.yieldQuantity || 1)),
            unit: normalizeUnit(item.yieldUnit || item.defaultUnit || 'und'),
        },
    };
}

async function ensureReportDir() {
    const reportDir = path.resolve(process.cwd(), 'scripts', 'reports');
    await fs.mkdir(reportDir, { recursive: true });
    return reportDir;
}

async function main() {
    console.log('=== Legacy Batch Unit Migration ===');
    console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
    console.log(`API: ${API_URL}`);
    console.log(`Tenant: ${TENANT_ID}`);

    const [supplyItemsPayload, productsPayload] = await Promise.all([
        fetchJson('/supply-items?limit=1000'),
        fetchJson('/products'),
    ]);

    const supplyItems = supplyItemsPayload?.data || [];
    const products = productsPayload?.data || [];

    const report = {
        generatedAt: new Date().toISOString(),
        apiUrl: API_URL,
        tenantId: TENANT_ID,
        execute: EXECUTE,
        candidates: [],
        updates: {
            legacyItems: [],
            parentBatches: [],
            products: [],
        },
    };

    const skippedEntries = [];
    const candidateEntries = supplyItems
        .map((item) => {
            const productUsages = summarizeProductUsage(products, item);
            const batchUsages = summarizeBatchUsage(supplyItems, item);
            const usages = [...productUsages, ...batchUsages];
            const status = isLegacyCandidate(item, usages);
            const unsafeUsages = usages.filter((usage) => !isSafeDiscreteConversion(item, usage));
            return {
                item,
                productUsages,
                batchUsages,
                usages,
                unsafeUsages,
                ...status,
            };
        })
        .filter((entry) => {
            if (!entry.actionable) return false;
            if (entry.unsafeUsages.length > 0) {
                skippedEntries.push(entry);
                return false;
            }
            return true;
        });

    if (candidateEntries.length === 0) {
        console.log('No actionable legacy batch candidates found.');
        return;
    }

    console.log(`Found ${candidateEntries.length} actionable legacy batches.\n`);
    if (skippedEntries.length > 0) {
        console.log(`Skipped ${skippedEntries.length} suspicious candidates for manual review:`);
        for (const entry of skippedEntries) {
            console.log(`  - ${entry.item.name}`);
        }
        console.log('');
    }

    const candidateMap = new Map(candidateEntries.map((entry) => [entry.item.id, entry]));

    for (const entry of candidateEntries) {
        const targetUnit = normalizeUnit(entry.item.yieldUnit || entry.item.defaultUnit || 'und');
        console.log(`- ${entry.item.name}`);
        console.log(`  stock: ${entry.item.stockQuantity} ${entry.item.defaultUnit}`);
        console.log(`  output: ${entry.item.yieldQuantity} ${entry.item.yieldUnit}`);
        console.log(`  target: ${targetUnit}`);
        console.log(`  reasons: ${[
            entry.hasUnitMismatch ? 'stock/output unit mismatch' : null,
            entry.hasFractionalUsage ? 'fractional downstream usage' : null,
        ].filter(Boolean).join(' + ')}`);

        report.candidates.push({
            id: entry.item.id,
            name: entry.item.name,
            defaultUnit: entry.item.defaultUnit,
            yieldUnit: entry.item.yieldUnit,
            yieldQuantity: entry.item.yieldQuantity,
            stockQuantity: entry.item.stockQuantity,
            productUsages: entry.productUsages,
            batchUsages: entry.batchUsages,
        });
    }

    const batchUpdatePayloads = [];
    for (const parent of supplyItems) {
        let changed = false;
        const ingredients = (parent.ingredients || []).map((ingredient) => {
            const candidate = candidateMap.get(ingredient.supplyItemId);
            if (!candidate) {
                return {
                    id: ingredient.supplyItemId,
                    quantity: Number(ingredient.quantity) || 0,
                    unit: ingredient.unit || 'und',
                };
            }

            const transformed = buildTransformedLine(candidate.item, ingredient);
            if (transformed.changed) changed = true;
            return {
                id: ingredient.supplyItemId,
                quantity: Number(transformed.line.quantity) || 0,
                unit: transformed.line.unit || 'und',
            };
        });

        if (changed) {
            batchUpdatePayloads.push({
                id: parent.id,
                name: parent.name,
                ingredients,
            });
        }
    }

    const productUpdatePayloads = [];
    for (const product of products) {
        let changed = false;
        const recipes = (product.recipes || []).map((recipe) => {
            const candidate = candidateMap.get(recipe.supplyItemId);
            if (!candidate) {
                return {
                    id: recipe.supplyItemId,
                    quantity: Number(recipe.quantity) || 0,
                    unit: recipe.unit || 'und',
                };
            }

            const transformed = buildTransformedLine(candidate.item, recipe);
            if (transformed.changed) changed = true;
            return {
                id: recipe.supplyItemId,
                quantity: Number(transformed.line.quantity) || 0,
                unit: transformed.line.unit || 'und',
            };
        });

        if (changed) {
            productUpdatePayloads.push({
                id: product.id,
                name: product.name,
                recipes,
            });
        }
    }

    const legacyItemUpdates = candidateEntries.map((entry) => {
        const targetUnit = normalizeUnit(entry.item.yieldUnit || entry.item.defaultUnit || 'und');
        return {
            id: entry.item.id,
            name: entry.item.name,
            payload: {
                defaultUnit: targetUnit,
                recipeUnit: targetUnit,
                yieldUnit: targetUnit,
                isProduction: true,
                stockCorrectionFactor: 1,
            },
        };
    });

    report.updates.legacyItems = legacyItemUpdates;
    report.updates.parentBatches = batchUpdatePayloads.map(({ id, name, ingredients }) => ({ id, name, ingredients }));
    report.updates.products = productUpdatePayloads.map(({ id, name, recipes }) => ({ id, name, recipes }));
    report.skipped = skippedEntries.map((entry) => ({
        id: entry.item.id,
        name: entry.item.name,
        reasons: entry.unsafeUsages,
    }));

    const reportDir = await ensureReportDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `legacy-batch-migration-${timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nPlan saved to ${reportPath}`);
    console.log(`Legacy items to update: ${legacyItemUpdates.length}`);
    console.log(`Parent batches to update: ${batchUpdatePayloads.length}`);
    console.log(`Products to update: ${productUpdatePayloads.length}`);

    if (!EXECUTE) {
        console.log('\nDry run only. Re-run with --execute to apply changes.');
        return;
    }

    console.log('\nApplying legacy item unit updates...');
    for (const update of legacyItemUpdates) {
        console.log(`  PUT /supply-items/${update.id} (${update.name})`);
        await fetchJson(`/supply-items/${update.id}`, {
            method: 'PUT',
            body: JSON.stringify(update.payload),
        });
    }

    console.log('\nApplying parent batch recipe updates...');
    for (const update of batchUpdatePayloads) {
        console.log(`  PUT /supply-items/${update.id} (${update.name})`);
        await fetchJson(`/supply-items/${update.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ingredients: update.ingredients }),
        });
    }

    console.log('\nApplying product recipe updates...');
    for (const update of productUpdatePayloads) {
        console.log(`  PUT /products/${update.id} (${update.name})`);
        await fetchJson(`/products/${update.id}`, {
            method: 'PUT',
            body: JSON.stringify({ recipes: update.recipes }),
        });
    }

    console.log('\nMigration applied. Running verification audit...');
    const [postSupplyItemsPayload, postProductsPayload] = await Promise.all([
        fetchJson('/supply-items?limit=1000'),
        fetchJson('/products'),
    ]);

    const postSupplyItems = postSupplyItemsPayload?.data || [];
    const postProducts = postProductsPayload?.data || [];
    const remaining = postSupplyItems
        .map((item) => {
            const usages = [
                ...summarizeProductUsage(postProducts, item),
                ...summarizeBatchUsage(postSupplyItems, item),
            ];
            const status = isLegacyCandidate(item, usages);
            return { item, ...status };
        })
        .filter((entry) => entry.actionable);

    console.log(`Remaining actionable legacy items: ${remaining.length}`);
    if (remaining.length > 0) {
        for (const entry of remaining) {
            console.log(`  - ${entry.item.name}`);
        }
    }
}

main().catch((error) => {
    console.error('Legacy batch migration failed:', error);
    process.exitCode = 1;
});
