type UnitCategory = 'weight' | 'volume' | 'count';

interface UnitDefinition {
    value: string;
    label: string;
    labelShort: string;
    category: UnitCategory;
    toBase: number;
    aliases?: string[];
}

export interface PurchaseUnitOption extends UnitDefinition {
    toReference: number;
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
    { value: 'kg', label: 'Kilogramo (kg)', labelShort: 'kg', category: 'weight', toBase: 1000, aliases: ['kilogramo'] },
    { value: 'g', label: 'Gramos (g)', labelShort: 'g', category: 'weight', toBase: 1, aliases: ['gramos'] },
    { value: '500g', label: 'Bolsa 500g', labelShort: '500g', category: 'weight', toBase: 500 },
    { value: '250g', label: 'Bolsa 250g', labelShort: '250g', category: 'weight', toBase: 250 },
    { value: '25kg', label: 'Costal 25kg', labelShort: '25kg', category: 'weight', toBase: 25000 },
    { value: '50kg', label: 'Costal 50kg', labelShort: '50kg', category: 'weight', toBase: 50000 },
    { value: 'lb', label: 'Libra (lb)', labelShort: 'lb', category: 'weight', toBase: 453.592 },
    { value: 'lt', label: 'Litro (lt)', labelShort: 'lt', category: 'volume', toBase: 1000, aliases: ['l', 'litro', 'litros'] },
    { value: 'ml', label: 'Mililitros (ml)', labelShort: 'ml', category: 'volume', toBase: 1 },
    { value: '500ml', label: 'Botella 500ml', labelShort: '500ml', category: 'volume', toBase: 500 },
    { value: '250ml', label: 'Botella 250ml', labelShort: '250ml', category: 'volume', toBase: 250 },
    { value: 'gal', label: 'Galon', labelShort: 'gal', category: 'volume', toBase: 3785.41 },
    { value: 'und', label: 'Unidad', labelShort: 'und', category: 'count', toBase: 1, aliases: ['unidad', 'unidades'] },
    { value: 'docena', label: 'Docena (12)', labelShort: 'doc', category: 'count', toBase: 12 },
    { value: 'caja', label: 'Caja', labelShort: 'caja', category: 'count', toBase: 1 },
    { value: 'paquete', label: 'Paquete', labelShort: 'paq', category: 'count', toBase: 1 },
];

const UNIT_LOOKUP = new Map<string, UnitDefinition>();
for (const definition of UNIT_DEFINITIONS) {
    UNIT_LOOKUP.set(definition.value, definition);
    for (const alias of definition.aliases || []) {
        UNIT_LOOKUP.set(alias, definition);
    }
}

export function normalizeUnit(unit?: string | null): string {
    const value = String(unit || 'und').trim().toLowerCase();
    return UNIT_LOOKUP.get(value)?.value || value || 'und';
}

function getDefinition(unit?: string | null): UnitDefinition | undefined {
    return UNIT_LOOKUP.get(normalizeUnit(unit));
}

export function getUnitCategory(baseUnit: string): UnitCategory {
    return getDefinition(baseUnit)?.category || 'count';
}

export function getPurchaseUnitsForBase(baseUnit: string): PurchaseUnitOption[] {
    const normalizedBase = normalizeUnit(baseUnit);
    const baseDefinition = getDefinition(normalizedBase);
    if (!baseDefinition) return [];

    return UNIT_DEFINITIONS
        .filter((definition) => definition.category === baseDefinition.category)
        .map((definition) => ({
            ...definition,
            toReference: definition.toBase / baseDefinition.toBase,
        }));
}

export function findPurchaseUnit(value: string): PurchaseUnitOption | undefined {
    const normalized = normalizeUnit(value);
    const definition = getDefinition(normalized);
    if (!definition) return undefined;
    return {
        ...definition,
        toReference: 1,
    };
}

export function convertToBaseUnit(quantity: number, purchaseUnit: string, baseUnit: string): {
    normalizedQuantity: number;
    baseUnit: string;
} {
    const baseDefinition = getDefinition(baseUnit);
    const purchaseDefinition = getDefinition(purchaseUnit);

    if (!baseDefinition || !purchaseDefinition || baseDefinition.category !== purchaseDefinition.category) {
        return { normalizedQuantity: quantity, baseUnit: normalizeUnit(baseUnit) };
    }

    const normalizedQuantity = (Number(quantity) || 0) * (purchaseDefinition.toBase / baseDefinition.toBase);
    return {
        normalizedQuantity,
        baseUnit: baseDefinition.value,
    };
}

export function calculateCostPerBaseUnit(
    quantity: number,
    purchaseUnit: string,
    baseUnit: string,
    price: number,
    priceType: 'total' | 'per_unit'
): {
    normalizedQuantity: number;
    baseUnit: string;
    totalCost: number;
    costPerBaseUnit: number;
} {
    const { normalizedQuantity, baseUnit: normalizedBaseUnit } = convertToBaseUnit(quantity, purchaseUnit, baseUnit);
    const totalCost = priceType === 'total' ? price : price * quantity;
    const costPerBaseUnit = normalizedQuantity > 0 ? totalCost / normalizedQuantity : 0;

    return {
        normalizedQuantity,
        baseUnit: normalizedBaseUnit,
        totalCost,
        costPerBaseUnit,
    };
}

export function formatQuantityWithUnit(quantity: number, unit: string): string {
    const definition = getDefinition(unit);
    const label = definition?.labelShort || unit;
    const formattedQty = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2);
    return `${formattedQty} ${label}`;
}

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

    return {
        percentage,
        direction,
        formatted: `${direction === 'up' ? '+' : ''}${percentage.toFixed(1)}%`,
    };
}
