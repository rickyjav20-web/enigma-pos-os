// @ts-nocheck
import { parse } from 'csv-parse/sync';
import prisma from '../lib/prisma';
import { recipeService } from './RecipeService';

export class ProductIngestService {

    public async ingestLoyverseExport(csvContent: string, tenantId: string) {
        const records = parse(csvContent, {
            columns: false,
            skip_empty_lines: false,
            relax_column_count: true
        });

        // 0. Header Analysis
        const header = records[0];
        const colMap: any = {};
        header.forEach((h: string, i: number) => colMap[h.trim()] = i);

        const COL_HANDLE = colMap['Handle'];
        const COL_NAME = colMap['Nombre'] || colMap['Name'];
        const COL_SKU = colMap['REF'] || colMap['SKU'];
        const COL_CAT = colMap['Categoria'] || colMap['Category'];
        const COL_PRICE = colMap['Precio [Enigma Café ]'] || colMap['Price'];
        const COL_COST = colMap['Coste'] || colMap['Cost'];
        const COL_COMP_REF = colMap['REF del componente'] || colMap['Component SKU'];
        const COL_COMP_QTY = colMap['Cantidad del componente'] || colMap['Component Quantity'];
        const COL_UNIT = colMap['Vendido por'] || 'Unidad'; // Infer unit

        console.log(`[Ingest] Parsing ${records.length} rows...`);

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

                nodes.set(handle, {
                    handle,
                    sku: row[COL_SKU] || handle, // Fallback to handle if SKU missing
                    name: row[COL_NAME],
                    category,
                    price: parseFloat(row[COL_PRICE]) || 0,
                    cost: parseFloat(row[COL_COST]) || 0,
                    isSold: (parseFloat(row[COL_PRICE]) || 0) > 0, // Heuristic: If it has price, it's sold
                    isProduction
                });
            }
        }

        console.log(`[Ingest] Identified ${nodes.size} unique nodes.`);

        for (const node of nodes.values()) {
            // 1. Always create as SupplyItem (everything is a supply item potential)
            // If it is 'isProduction', we mark it so.
            // If it is 'Raw', it's just a supply item.

            // Note: Loyverse separates Products (Sold) vs Ingredients (Cost).
            // But in Enigma, a Product can ALSO be a SupplyItem (e.g. specialized resale).
            // For now, we cleanly separate: 
            // - SupplyItem: Something we stock/cook.
            // - Product: Something we sell.

            // CREATE SUPPLY ITEM (If it has a SKU, acts as inventory node)
            if (node.sku) {
                await prisma.supplyItem.upsert({
                    where: { tenantId_sku: { tenantId, sku: node.sku } },
                    create: {
                        name: node.name,
                        sku: node.sku,
                        tenantId,
                        currentCost: node.cost,
                        category: node.category,
                        defaultUnit: 'und', // Todo: infer from 'Vendido por'
                        isProduction: node.isProduction
                    },
                    update: {
                        name: node.name,
                        currentCost: node.cost, // Update cost from CSV? Or keep calculated?
                        // Strategy: If CSV cost > 0, use it. Else keep existing.
                        ...(node.cost > 0 ? { currentCost: node.cost } : {}),
                        isProduction: node.isProduction
                    }
                });
            }

            // CREATE PRODUCT (If it is sold)
            if (node.isSold) {
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
                        sku: node.sku
                    }
                });
            }
        }


        // --- PASS 2: EDGES (Link Components) ---
        console.log(`[Ingest] Linking components...`);
        let linksCreated = 0;

        // Iterate rows again to find "Component REF"
        // We track the "Current Parent" context because Loyverse exports sub-rows with empty Handle
        let currentParentHandle: string | null = null;

        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            const handle = row[COL_HANDLE];

            if (handle) {
                currentParentHandle = handle;
            }

            if (!currentParentHandle) continue; // Should not happen if first row is valid

            const compSku = row[COL_COMP_REF];
            const compQty = parseFloat(row[COL_COMP_QTY]);

            if (compSku && compQty) {
                // We have a link: Parent (currentParentHandle) -> Child (compSku)
                const parentNode = nodes.get(currentParentHandle);

                if (!parentNode) continue;

                // Find the Child Component (SupplyItem)
                const componentItem = await prisma.supplyItem.findFirst({
                    where: { tenantId, sku: compSku }
                });

                if (!componentItem) {
                    console.warn(`[Ingest] Warning: Component with SKU ${compSku} not found for parent ${currentParentHandle}`);
                    continue;
                }

                // 2A. If Parent is a PRODUCT (Saleable)
                if (parentNode.isSold) {
                    // Link Product -> SupplyItem
                    const parentProduct = await prisma.product.findUnique({
                        where: { tenantId_loyverseId: { tenantId, loyverseId: currentParentHandle } }
                    });

                    if (parentProduct) {
                        await recipeService.linkIngredient(parentProduct.id, componentItem.id, compQty, 'und');
                        linksCreated++;
                    }
                }

                // 2B. If Parent is INTERNAL (Production/Batch) 
                // Checks: It is marked isProduction OR it is used as a component elsewhere (recursive check hard here, rely on category)
                if (parentNode.isProduction || !parentNode.isSold) {
                    // Link SupplyItem -> SupplyItem (Production Recipe)
                    const parentSupplyItem = await prisma.supplyItem.findUnique({
                        where: { tenantId_sku: { tenantId, sku: parentNode.sku } }
                    });

                    if (parentSupplyItem) {
                        // Create ProductionRecipe
                        // First check if exists to avoid dupes (naive check)
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
                                    unit: 'und' // Default
                                }
                            });

                            // Auto-mark as production if it wasn't already
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

        return { nodes: nodes.size, links: linksCreated };
    }
}

export const productIngestService = new ProductIngestService();
