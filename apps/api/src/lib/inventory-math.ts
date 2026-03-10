export function normalizeYield(yieldPercentage?: number | null): number {
    const value = Number(yieldPercentage);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return value;
}

export function normalizeFactor(stockCorrectionFactor?: number | null): number {
    const value = Number(stockCorrectionFactor);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return value;
}

export function getEffectiveRecipeUnitCost(input: {
    rawCost?: number | null;
    stockCorrectionFactor?: number | null;
    yieldPercentage?: number | null;
}): number {
    const rawCost = Number(input.rawCost) || 0;
    const factor = normalizeFactor(input.stockCorrectionFactor);
    const yieldPct = normalizeYield(input.yieldPercentage);

    return rawCost / (factor * yieldPct);
}

export function getInventoryDeduction(input: {
    recipeQuantity?: number | null;
    multiplier?: number | null;
    stockCorrectionFactor?: number | null;
    yieldPercentage?: number | null;
}): number {
    const recipeQuantity = Number(input.recipeQuantity) || 0;
    const multiplier = Number(input.multiplier) || 1;
    const factor = normalizeFactor(input.stockCorrectionFactor);
    const yieldPct = normalizeYield(input.yieldPercentage);

    const qtyInStockUnit = recipeQuantity / factor;
    const grossDeductionPerUnit = qtyInStockUnit / yieldPct;

    return grossDeductionPerUnit * multiplier;
}
