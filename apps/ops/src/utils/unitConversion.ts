/**
 * Unit Conversion System for Purchases
 * Normalizes purchases to base units for consistent cost tracking
 */

// Base units for each category
export const BASE_UNITS = {
    weight: 'kg',
    volume: 'L',
    count: 'unidad'
} as const;

// All available purchase units with conversion factors to base unit
export interface PurchaseUnitOption {
    value: string;
    label: string;
    labelShort: string;
    category: 'weight' | 'volume' | 'count';
    toBaseUnit: number;  // Multiply by this to get base unit value
    baseUnit: string;
}

export const PURCHASE_UNITS: PurchaseUnitOption[] = [
    // WEIGHT - base: kg
    { value: 'kg', label: 'Kilogramo (kg)', labelShort: 'kg', category: 'weight', toBaseUnit: 1, baseUnit: 'kg' },
    { value: 'g', label: 'Gramos (g)', labelShort: 'g', category: 'weight', toBaseUnit: 0.001, baseUnit: 'kg' },
    { value: '500g', label: 'Bolsa 500g', labelShort: '500g', category: 'weight', toBaseUnit: 0.5, baseUnit: 'kg' },
    { value: '250g', label: 'Bolsa 250g', labelShort: '250g', category: 'weight', toBaseUnit: 0.25, baseUnit: 'kg' },
    { value: '25kg', label: 'Costal 25kg', labelShort: 'costal', category: 'weight', toBaseUnit: 25, baseUnit: 'kg' },
    { value: '50kg', label: 'Costal 50kg', labelShort: 'costal 50', category: 'weight', toBaseUnit: 50, baseUnit: 'kg' },
    { value: 'lb', label: 'Libra (lb)', labelShort: 'lb', category: 'weight', toBaseUnit: 0.453592, baseUnit: 'kg' },

    // VOLUME - base: L
    { value: 'L', label: 'Litro (L)', labelShort: 'L', category: 'volume', toBaseUnit: 1, baseUnit: 'L' },
    { value: 'ml', label: 'Mililitros (ml)', labelShort: 'ml', category: 'volume', toBaseUnit: 0.001, baseUnit: 'L' },
    { value: '500ml', label: 'Botella 500ml', labelShort: '500ml', category: 'volume', toBaseUnit: 0.5, baseUnit: 'L' },
    { value: '250ml', label: 'Botella 250ml', labelShort: '250ml', category: 'volume', toBaseUnit: 0.25, baseUnit: 'L' },
    { value: 'gal', label: 'Galón (3.78L)', labelShort: 'gal', category: 'volume', toBaseUnit: 3.78541, baseUnit: 'L' },

    // COUNT - base: unidad
    { value: 'unidad', label: 'Unidad', labelShort: 'und', category: 'count', toBaseUnit: 1, baseUnit: 'unidad' },
    { value: 'docena', label: 'Docena (12)', labelShort: 'doc', category: 'count', toBaseUnit: 12, baseUnit: 'unidad' },
    { value: 'caja', label: 'Caja', labelShort: 'caja', category: 'count', toBaseUnit: 1, baseUnit: 'unidad' },
    { value: 'paquete', label: 'Paquete', labelShort: 'paq', category: 'count', toBaseUnit: 1, baseUnit: 'unidad' },
];

/**
 * Get the category of a base unit
 */
export function getUnitCategory(baseUnit: string): 'weight' | 'volume' | 'count' {
    const lowerUnit = baseUnit.toLowerCase();
    if (['kg', 'g', 'lb'].includes(lowerUnit)) return 'weight';
    if (['l', 'ml', 'gal'].includes(lowerUnit)) return 'volume';
    return 'count';
}

/**
 * Get available purchase units for a given base unit
 */
export function getPurchaseUnitsForBase(baseUnit: string): PurchaseUnitOption[] {
    const category = getUnitCategory(baseUnit);
    return PURCHASE_UNITS.filter(u => u.category === category);
}

/**
 * Find a purchase unit by value
 */
export function findPurchaseUnit(value: string): PurchaseUnitOption | undefined {
    return PURCHASE_UNITS.find(u => u.value === value);
}

/**
 * Convert a quantity from any unit to base unit
 */
export function convertToBaseUnit(quantity: number, purchaseUnit: string): {
    normalizedQuantity: number;
    baseUnit: string;
} {
    const unit = findPurchaseUnit(purchaseUnit);
    if (!unit) {
        // Fallback: assume it's already in base unit
        return { normalizedQuantity: quantity, baseUnit: purchaseUnit };
    }
    return {
        normalizedQuantity: quantity * unit.toBaseUnit,
        baseUnit: unit.baseUnit
    };
}

/**
 * Calculate cost per base unit from purchase data
 */
export function calculateCostPerBaseUnit(
    quantity: number,
    purchaseUnit: string,
    price: number,
    priceType: 'total' | 'per_unit'
): {
    normalizedQuantity: number;
    baseUnit: string;
    totalCost: number;
    costPerBaseUnit: number;
} {
    const { normalizedQuantity, baseUnit } = convertToBaseUnit(quantity, purchaseUnit);

    // Calculate total cost
    const totalCost = priceType === 'total' ? price : price * quantity;

    // Cost per base unit
    const costPerBaseUnit = normalizedQuantity > 0 ? totalCost / normalizedQuantity : 0;

    return {
        normalizedQuantity,
        baseUnit,
        totalCost,
        costPerBaseUnit
    };
}

/**
 * Format quantity with unit for display
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
    const purchaseUnit = findPurchaseUnit(unit);
    const label = purchaseUnit?.labelShort || unit;

    // Format number nicely
    const formattedQty = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2);

    return `${formattedQty} ${label}`;
}

/**
 * Format price change percentage
 */
export function formatPriceChange(oldPrice: number, newPrice: number): {
    percentage: number;
    direction: 'up' | 'down' | 'same';
    formatted: string;
} {
    if (oldPrice === 0 || Math.abs(newPrice - oldPrice) < 0.001) {
        return { percentage: 0, direction: 'same', formatted: '' };
    }

    const percentage = ((newPrice - oldPrice) / oldPrice) * 100;
    const direction = percentage > 0 ? 'up' : 'down';
    const formatted = `${direction === 'up' ? '+' : ''}${percentage.toFixed(1)}%`;

    return { percentage, direction, formatted };
}
