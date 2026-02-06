// @ts-nocheck
import { parse } from 'csv-parse/sync';
import prisma from '../lib/prisma';
import { recipeService } from './RecipeService';

export class ProductIngestService {

    public async ingestLoyverseExport(csvContent: string, tenantId: string) {
        const records = parse(csvContent, {
            columns: false,
            skip_empty_lines: false,
            relax_column_count: true,
            bom: true
        });

        // 0. Header Analysis
        const header = records[0];
        const colMap: any = {};

        console.log('[Ingest] Raw Headers:', header);

        header.forEach((h: string, i: number) => {
            let key = h.trim();
            // Manual BOM Strip (just in case csv-parse fails)
            if (key.charCodeAt(0) === 0xFEFF) {
                key = key.slice(1);
            }
            // Normalize to lowercase for case-insensitive matching
            colMap[key.toLowerCase()] = i;
        });

        console.log('[Ingest] Normalized Column Map:', Object.keys(colMap));

        // Map Columns (lowercase keys)
        const COL_HANDLE = colMap['handle'];
        const COL_NAME = colMap['nombre'] || colMap['name'];
        const COL_SKU = colMap['ref'] || colMap['sku'];
        const COL_CAT = colMap['categoria'] || colMap['category'];
        const COL_PRICE = colMap['precio [enigma café ]'] || colMap['price'];
        const COL_COST = colMap['coste'] || colMap['cost'];
        const COL_COMP_REF = colMap['ref del componente'] || colMap['component sku'];
        const COL_COMP_QTY = colMap['cantidad del componente'] || colMap['component quantity'];

        // Supplier Columns
        const COL_SUPPLIER = colMap['proveedor'] || colMap['supplier'] || colMap['vendor'];
        const COL_PURCHASE_COST = colMap['costo de compra'] || colMap['purchase cost'];

        // VALIDATION
        if (typeof COL_HANDLE === 'undefined') {
            throw new Error(`Critical: Could not find 'Handle' column in CSV. Found: ${Object.keys(colMap).join(', ')}`);
        }

        console.log(`[Ingest] Parsing ${records.length} rows...`);

        // --- PASS 0: PRE-PROCESS SUPPLIERS ---
        // Identify all unique suppliers and create them first to ensure IDs are available.
        const supplierNames = new Set<string>();
        if (typeof COL_SUPPLIER !== 'undefined') {
            for (let i = 1; i < records.length; i++) {
                const row = records[i];
                const sName = row[COL_SUPPLIER]?.trim();
                // Filter out empty or "Default" if needed
                if (sName && sName.length > 1) {
                    supplierNames.add(sName);
                }
            }
        }

        const supplierMap = new Map<string, string>(); // Name -> ID

        console.log(`[Ingest] Found ${supplierNames.size} unique suppliers.`);

        for (const sName of supplierNames) {
            // Find or Create Supplier
            try {
                let supplier = await prisma.supplier.findFirst({
                    where: { tenantId, name: sName }
                });

                if (!supplier) {
                    supplier = await prisma.supplier.create({
                        data: {
                            tenantId,
                            name: sName,
                            category: 'General', // Default
                            email: '',
                            phone: ''
                        }
                    });
                    console.log(`[Ingest] Created new supplier: ${sName}`);
                }
                supplierMap.set(sName, supplier.id);
            } catch (e) {
                console.error(`[Ingest] Error processing supplier ${sName}:`, e);
            }
        }

        // --- PASS 1: NODES (Create all Products and SupplyItems) ---
        // We need to identify unique items by Handle/SKU.
        // A single item might span multiple rows (for ingredients), so we use a Map to dedup.

        type ItemNode = {
            handle: string;
            sku: string;
            name: string;
            category: string;
            price: number;
            cost: number;
            isSold: boolean;
            isProduction: boolean;
            supplierId?: string;
        };

        const nodes = new Map<string, ItemNode>();

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            const handle = row[COL_HANDLE];

            // Only process rows that define a new item handle
            if (handle && !nodes.has(handle)) {
                const category = row[COL_CAT] || 'Uncategorized';
                const isProduction = category.toLowerCase().includes('preparado') ||
                    category.toLowerCase().includes('salsa') ||
                    category.toLowerCase().includes('batch');

                // Determine Supplier
                let supplierId = undefined;
                if (typeof COL_SUPPLIER !== 'undefined') {
                    const sName = row[COL_SUPPLIER]?.trim();
                    if (sName && supplierMap.has(sName)) {
                        supplierId = supplierMap.get(sName);
                    }
                }

                // Determine Cost (Prefer Purchase Cost if available)
                const basicCost = parseFloat(row[COL_COST]) || 0;
                let finalCost = basicCost;

                if (typeof COL_PURCHASE_COST !== 'undefined') {
                    const purchaseCost = parseFloat(row[COL_PURCHASE_COST]) || 0;
                    if (purchaseCost > 0) {
                        finalCost = purchaseCost;
                    }
                }

                nodes.set(handle, {
                    handle,
                    sku: row[COL_SKU] || handle, // Fallback to handle if SKU missing
                    name: row[COL_NAME],
                    category,
                    price: parseFloat(row[COL_PRICE]) || 0,
                    cost: finalCost,
                    isSold: (parseFloat(row[COL_PRICE]) || 0) > 0,
                    isProduction,
                    supplierId
                });
            }
        }

        console.log(`[Ingest] Identified ${nodes.size} unique nodes.`);

        for (const node of nodes.values()) {

            // 1. CREATE SUPPLY ITEM (Use SKU as key)
            // Even if it's a product, we create a supply item for inventory tracking if desired.
            // In Enigma, sold items also map to supply items if they are stocked directly (like Soda cans).
            // OR they map to Recipes.
            // For safety, we create SupplyItem for EVERYTHING that has a SKU.

            if (node.sku) {
                try {
                    await prisma.supplyItem.upsert({
                        where: { tenantId_sku: { tenantId, sku: node.sku } },
                        create: {
                            name: node.name,
                            sku: node.sku,
                            tenantId,
                            currentCost: node.cost,
                            category: node.category,
                            defaultUnit: 'und',
                            isProduction: node.isProduction,
                            preferredSupplierId: node.supplierId
                        },
                        update: {
                            name: node.name,
                            currentCost: node.cost,
                            // If CSV has provider, update it. If not, leave existing? 
                            // User wants CLEAN IMPORT, so we enforce what's in CSV.
                            preferredSupplierId: node.supplierId,
                            isProduction: node.isProduction
                        }
                    });
                } catch (e) {
                    console.error(`[Ingest] Error upserting SupplyItem ${node.sku}:`, e);
                }
            }

            // 2. CREATE PRODUCT (Only if it is Sold / has Price)
            if (node.isSold) {
                try {
                    await prisma.product.upsert({
                        where: { tenantId_loyverseId: { tenantId, loyverseId: node.handle } },
                        create: {
                            name: node.name,
                            price: node.price,
                            cost: node.cost,
                            tenantId,
                            loyverseId: node.handle,
                            sku: node.sku,
                            isActive: true
                        },
                        update: {
                            name: node.name,
                            price: node.price,
                            sku: node.sku,
                            cost: node.cost
                        }
                    });
                } catch (e) {
                    console.error(`[Ingest] Error upserting Product ${node.handle}:`, e);
                }
            }
        }


        // --- PASS 2: EDGES (Link Components) ---
        console.log(`[Ingest] Linking components...`);
        let linksCreated = 0;

        let currentParentHandle: string | null = null;

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            const handle = row[COL_HANDLE];

            if (handle) {
                currentParentHandle = handle;
            }

            if (!currentParentHandle) continue;

            const compSku = row[COL_COMP_REF];
            const compQty = parseFloat(row[COL_COMP_QTY]);

            if (compSku && compQty) {
                const parentNode = nodes.get(currentParentHandle);
                if (!parentNode) continue;

                // Find the Child Component (SupplyItem)
                const componentItem = await prisma.supplyItem.findFirst({
                    where: { tenantId, sku: compSku }
                });

                if (!componentItem) {
                    // console.warn(`[Ingest] Warning: Component with SKU ${compSku} not found for parent ${currentParentHandle}`);
                    continue;
                }

                // 2A. If Parent is a PRODUCT (Saleable)
                if (parentNode.isSold) {
                    const parentProduct = await prisma.product.findUnique({
                        where: { tenantId_loyverseId: { tenantId, loyverseId: currentParentHandle } }
                    });

                    if (parentProduct) {
                        try {
                            await recipeService.linkIngredient(parentProduct.id, componentItem.id, compQty, 'und');
                            linksCreated++;
                        } catch (e) {
                            // Ignore duplicates
                        }
                    }
                }

                // 2B. If Parent is INTERNAL (Production/Batch) 
                if (parentNode.isProduction || !parentNode.isSold) {
                    const parentSupplyItem = await prisma.supplyItem.findUnique({
                        where: { tenantId_sku: { tenantId, sku: parentNode.sku } }
                    });

                    if (parentSupplyItem) {
                        const existingLink = await prisma.productionRecipe.findFirst({
                            where: {
                                parentItemId: parentSupplyItem.id,
                                supplyItemId: componentItem.id
                            }
                        });

                        if (!existingLink) {
                            await prisma.productionRecipe.create({
                                data: {
                                    parentItemId: parentSupplyItem.id,
                                    supplyItemId: componentItem.id,
                                    quantity: compQty,
                                    unit: 'und'
                                }
                            });
                            // Mark as production
                            if (!parentSupplyItem.isProduction) {
                                await prisma.supplyItem.update({
                                    where: { id: parentSupplyItem.id },
                                    data: { isProduction: true }
                                });
                            }
                            linksCreated++;
                        }
                    }
                }
            }
        }

        return { nodes: nodes.size, links: linksCreated, suppliers: supplierMap.size };
    }
}

export const productIngestService = new ProductIngestService();
