export type UnitDimension = 'weight' | 'volume' | 'count';

type UnitDefinition = {
    canonical: string;
    dimension: UnitDimension;
    toBase: number;
    aliases?: string[];
};

const UNIT_DEFINITIONS: UnitDefinition[] = [
    { canonical: 'kg', dimension: 'weight', toBase: 1000, aliases: ['kilogramo', 'kilogramos'] },
    { canonical: 'g', dimension: 'weight', toBase: 1, aliases: ['gramo', 'gramos'] },
    { canonical: 'lb', dimension: 'weight', toBase: 453.592, aliases: ['libras', 'libra'] },
    { canonical: '250g', dimension: 'weight', toBase: 250 },
    { canonical: '500g', dimension: 'weight', toBase: 500 },
    { canonical: '25kg', dimension: 'weight', toBase: 25000 },
    { canonical: '50kg', dimension: 'weight', toBase: 50000 },
    { canonical: 'lt', dimension: 'volume', toBase: 1000, aliases: ['l', 'litro', 'litros'] },
    { canonical: 'ml', dimension: 'volume', toBase: 1, aliases: ['mililitro', 'mililitros'] },
    { canonical: '250ml', dimension: 'volume', toBase: 250 },
    { canonical: '500ml', dimension: 'volume', toBase: 500 },
    { canonical: 'gal', dimension: 'volume', toBase: 3785.41, aliases: ['galon', 'galones'] },
    { canonical: 'und', dimension: 'count', toBase: 1, aliases: ['unidad', 'unidades', 'unit', 'units'] },
    { canonical: 'docena', dimension: 'count', toBase: 12 },
    { canonical: 'caja', dimension: 'count', toBase: 1 },
    { canonical: 'paquete', dimension: 'count', toBase: 1 },
];

const UNIT_ALIAS_MAP = new Map<string, UnitDefinition>();

for (const definition of UNIT_DEFINITIONS) {
    UNIT_ALIAS_MAP.set(definition.canonical, definition);
    for (const alias of definition.aliases || []) {
        UNIT_ALIAS_MAP.set(alias, definition);
    }
}

export function normalizeUnit(unit?: string | null): string {
    const value = String(unit || 'und').trim().toLowerCase();
    return UNIT_ALIAS_MAP.get(value)?.canonical || value || 'und';
}

export function getUnitDefinition(unit?: string | null): UnitDefinition | undefined {
    return UNIT_ALIAS_MAP.get(normalizeUnit(unit));
}

export function areUnitsCompatible(fromUnit?: string | null, toUnit?: string | null): boolean {
    const from = getUnitDefinition(fromUnit);
    const to = getUnitDefinition(toUnit);
    if (!from || !to) return normalizeUnit(fromUnit) === normalizeUnit(toUnit);
    return from.dimension === to.dimension;
}

export function convertQuantity(quantity: number, fromUnit?: string | null, toUnit?: string | null): number {
    const from = getUnitDefinition(fromUnit);
    const to = getUnitDefinition(toUnit);
    const numeric = Number(quantity) || 0;

    if (!from || !to) {
        if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) return numeric;
        throw new Error(`Incompatible unit conversion: ${fromUnit || 'unknown'} -> ${toUnit || 'unknown'}`);
    }

    if (from.dimension !== to.dimension) {
        throw new Error(`Incompatible unit conversion: ${from.canonical} -> ${to.canonical}`);
    }

    const baseQuantity = numeric * from.toBase;
    return baseQuantity / to.toBase;
}

export function deriveStockCorrectionFactor(stockUnit?: string | null, recipeUnit?: string | null): number {
    const normalizedStockUnit = normalizeUnit(stockUnit);
    const normalizedRecipeUnit = normalizeUnit(recipeUnit || stockUnit);

    if (normalizedStockUnit === normalizedRecipeUnit) return 1;

    try {
        return convertQuantity(1, normalizedStockUnit, normalizedRecipeUnit);
    } catch {
        return 1;
    }
}

export function getOperationalUnit(item?: {
    defaultUnit?: string | null;
    yieldUnit?: string | null;
} | null): string {
    const stockUnit = normalizeUnit(item?.defaultUnit);
    const yieldUnit = item?.yieldUnit ? normalizeUnit(item.yieldUnit) : null;

    if (stockUnit === 'und' && yieldUnit && yieldUnit !== 'und') {
        return yieldUnit;
    }

    return stockUnit;
}

export function getPreferredRecipeUnit(item?: {
    defaultUnit?: string | null;
    yieldUnit?: string | null;
    recipeUnit?: string | null;
} | null): string {
    const recipeUnit = item?.recipeUnit ? normalizeUnit(item.recipeUnit) : null;
    if (recipeUnit) return recipeUnit;
    return getOperationalUnit(item);
}

export function enrichSupplyItemUnits<T extends {
    defaultUnit?: string | null;
    yieldUnit?: string | null;
    recipeUnit?: string | null;
}>(item: T): T & {
    operationalUnit: string;
    preferredRecipeUnit: string;
} {
    return {
        ...item,
        operationalUnit: getOperationalUnit(item),
        preferredRecipeUnit: getPreferredRecipeUnit(item),
    };
}
