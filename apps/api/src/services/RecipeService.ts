import prisma from '../lib/prisma';
import { eventBus } from '../events/EventBus';
import { EventType } from '@enigma/types';

export class RecipeService {

    constructor() {
        console.log("🍳 RecipeService Initialized");
        this.setupListeners();
    }

    private setupListeners() {
        // Listen for Purchase Confirmations
        eventBus.subscribe(EventType.PURCHASE_ORDER_CONFIRMED, async (event) => {
            console.log("🍳 RecipeService: Received Purchase Confirmation");
            const { purchaseOrderId } = event.metadata;
            if (purchaseOrderId) {
                await this.handlePurchaseConfirmation(purchaseOrderId);
            }
        });
    }



    /**
     * RECURSIVE: Recalculates the cost of a SupplyItem (Batch) based on its ingredients.
     * Then triggers updates for any Parents (Batches or Products) that use this item.
     */
    public async recalculateSupplyItemCost(supplyItemId: string) {
        // 1. Calculate Cost from Ingredients (if it's a Batch)
        const recipes = await prisma.productionRecipe.findMany({
            where: { parentItemId: supplyItemId },
            include: { component: true }
        });

        // If it has ingredients, its cost is NOT manual/PO, it's calculated.
        // Fetch parent item to get yield
        const parentItem = await prisma.supplyItem.findUnique({ where: { id: supplyItemId } });
        const yieldQty = parentItem?.yieldQuantity || 1;

        if (recipes.length > 0) {
            let totalBatchCost = 0;
            for (const r of recipes) {
                // Use Average Cost (WAC) for accurate inventory valuation. Fallback to currentCost (Last Price) if 0.
                const component = r.component;
                const rawCost = component.averageCost || component.currentCost || 0;

                // SMART YIELD LOGIC:
                const factor = component.stockCorrectionFactor || 1;
                const yieldPct = component.yieldPercentage || 1;

                const effectiveUnitCost = rawCost / (factor * yieldPct);

                totalBatchCost += r.quantity * effectiveUnitCost;
            }

            // Unit Cost = Total Cost / Yield
            const unitCost = totalBatchCost / (yieldQty > 0 ? yieldQty : 1);

            await prisma.supplyItem.update({
                where: { id: supplyItemId },
                data: { currentCost: unitCost, isProduction: true }
            });
        }

        // 2. Ripple Effect: Find who uses THIS item
        // A. Used in other Batches?
        const usedInBatches = await prisma.productionRecipe.findMany({
            where: { supplyItemId: supplyItemId }
        });

        for (const usage of usedInBatches) {
            await this.recalculateSupplyItemCost(usage.parentItemId); // Recurse Up
        }

        // B. Used in Products?
        const usedInProducts = await prisma.productRecipe.findMany({
            where: { supplyItemId: supplyItemId }
        });

        for (const usage of usedInProducts) {
            await this.recalculateProductCost(usage.productId);
        }
    }

    /**
     * Update triggers from PO
     */
    public async handlePurchaseConfirmation(purchaseOrderId: string) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            include: { lines: true }
        });

        if (!po) return;

        // NOTE: Stock and WAC are already updated by the purchase route on confirmation.
        // RecipeService is responsible ONLY for the ripple-effect cost recalculation
        // (batches and products that use these ingredients). Do NOT re-increment stock or WAC here.
        for (const line of po.lines) {
            // Trigger ripple effect (for Batches/Products using this ingredient)
            await this.recalculateSupplyItemCost(line.supplyItemId);
        }
    }


    /**
     * Re-sums the cost of a product based on its DIRECT ingredients.
     */
    public async recalculateProductCost(productId: string) {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return;

        const recipes = await prisma.productRecipe.findMany({
            where: { productId },
            include: { supplyItem: true }
        });

        if (recipes.length === 0) return;

        let newTotalCost = 0;

        for (const r of recipes) {
            // Use Average Cost (WAC) if available.
            const ingredient = r.supplyItem;
            const rawCost = ingredient.averageCost || ingredient.currentCost || 0;

            // SMART YIELD LOGIC:
            // Effective Cost = RawCost / (Factor * Yield)
            const factor = ingredient.stockCorrectionFactor || 1;
            const yieldPct = ingredient.yieldPercentage || 1;

            const effectiveUnitCost = rawCost / (factor * yieldPct);

            newTotalCost += r.quantity * effectiveUnitCost;
        }

        // Check for change
        const oldCost = product.cost || 0;
        const diff = Math.abs(newTotalCost - oldCost);

        // Only update if difference is significant (e.g. > $0.001 to avoid float drift)
        if (diff > 0.001) {
            console.log(`💰 Cost Change Detected for ${product.name}: $${oldCost} -> $${newTotalCost}`);

            await prisma.$transaction([
                // 1. Update Product
                prisma.product.update({
                    where: { id: productId },
                    data: { cost: newTotalCost }
                }),
                // 2. Log History
                prisma.productCostHistory.create({
                    data: {
                        productId,
                        oldCost: oldCost,
                        newCost: newTotalCost,
                        reason: 'Auto-Recalculation (Ingredient Price Change)'
                    }
                })
            ]);
        }
    }

    /**
     * Syncs a SupplyItem's recipe (ProductionRecipe).
     * Handles Add / Remove / Update diff logic.
     */
    public async syncRecipe(parentItemId: string, ingredients: { id: string, quantity: number, unit: string }[]) {
        console.log(`🍳 Syncing Recipe for SupplyItem ${parentItemId}`);

        // 1. Get Existing Ingredients
        const existing = await prisma.productionRecipe.findMany({
            where: { parentItemId }
        });

        const currentIds = new Set(existing.map(e => e.supplyItemId));
        const newIds = new Set(ingredients.map(i => i.id));

        // 2. Determine Actions
        const toAdd = ingredients.filter(i => !currentIds.has(i.id));
        const toUpdate = ingredients.filter(i => currentIds.has(i.id));
        const toRemove = existing.filter(e => !newIds.has(e.supplyItemId));

        // 3. Execute Updates
        // REMOVE
        if (toRemove.length > 0) {
            await prisma.productionRecipe.deleteMany({
                where: { id: { in: toRemove.map(r => r.id) } }
            });
        }

        // ADD
        for (const item of toAdd) {
            await prisma.productionRecipe.create({
                data: {
                    parentItemId,
                    supplyItemId: item.id,
                    quantity: Number(item.quantity),
                    unit: item.unit || 'und'
                }
            });
        }

        // UPDATE
        for (const item of toUpdate) {
            const rel = existing.find(e => e.supplyItemId === item.id);
            if (rel) {
                await prisma.productionRecipe.update({
                    where: { id: rel.id },
                    data: {
                        quantity: Number(item.quantity),
                        unit: item.unit || 'und'
                    }
                });
            }
        }

        // 4. Mark as Production & Recalculate
        const isProduction = ingredients.length > 0;
        await prisma.supplyItem.update({
            where: { id: parentItemId },
            data: { isProduction }
        });

        await this.recalculateSupplyItemCost(parentItemId);
    }

    /**
     * Syncs a Product's recipe (ProductRecipe).
     * Handles Add / Remove / Update diff logic.
     */
    public async syncProductRecipe(productId: string, components: { id: string, quantity: number, unit: string }[]) {
        console.log(`🍳 Syncing Recipe for Product ${productId}`);

        // 1. Get Existing
        const existing = await prisma.productRecipe.findMany({
            where: { productId }
        });

        const currentIds = new Set(existing.map(e => e.supplyItemId));
        const newIds = new Set(components.map(i => i.id));

        // 2. Diff
        const toAdd = components.filter(i => !currentIds.has(i.id));
        const toUpdate = components.filter(i => currentIds.has(i.id));
        const toRemove = existing.filter(e => !newIds.has(e.supplyItemId));

        // 3. Execute
        if (toRemove.length > 0) {
            await prisma.productRecipe.deleteMany({
                where: { id: { in: toRemove.map(r => r.id) } }
            });
        }

        for (const item of toAdd) {
            await prisma.productRecipe.create({
                data: {
                    productId,
                    supplyItemId: item.id,
                    quantity: Number(item.quantity),
                    unit: item.unit || 'und'
                }
            });
        }

        for (const item of toUpdate) {
            const rel = existing.find(e => e.supplyItemId === item.id);
            if (rel) {
                await prisma.productRecipe.update({
                    where: { id: rel.id },
                    data: {
                        quantity: Number(item.quantity),
                        unit: item.unit || 'und'
                    }
                });
            }
        }

        // 4. Recalculate Cost
        await this.recalculateProductCost(productId);
    }
}

export const recipeService = new RecipeService();
