import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Check, Search, Building2, Package, DollarSign, X, ChevronRight, Scale, Sparkles, RefreshCw, HelpCircle, Info } from 'lucide-react';
import {
    getPurchaseUnitsForBase,
    calculateCostPerBaseUnit,
    formatPriceChange,
    findPurchaseUnit
} from '../utils/unitConversion';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

const CATEGORIES = ['Lácteos', 'Panadería', 'Carnes', 'Vegetales', 'Bebidas', 'Otros'];
const UNITS = ['kg', 'g', 'L', 'ml', 'unidad', 'docena', 'caja'];

interface Supplier {
    id: string;
    name: string;
    category?: string;
    phone?: string;
    address?: string;
    email?: string;
}

interface SupplyItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentCost: number;
    averageCost?: number;
    defaultUnit: string;
}

interface CartItem extends SupplyItem {
    quantity: number;           // Quantity in purchase units
    purchaseUnit: string;       // Unit of purchase (e.g., '500g', 'kg', 'docena')
    priceType: 'total' | 'per_unit';  // How price is entered
    price: number;              // Price entered by user
    // Display state for inputs
    displayQuantity?: string;   // For handling "0." input state
    // Calculated values
    normalizedQuantity: number; // Quantity in base units
    costPerBaseUnit: number;    // Cost per base unit for tracking
}

export default function PurchasesPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedSupplierId = searchParams.get('supplierId');

    const [step, setStep] = useState<'suppliers' | 'items' | 'review'>('suppliers');

    // Supplier State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [showNewSupplier, setShowNewSupplier] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');

    // Items State
    const [allItems, setAllItems] = useState<SupplyItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);

    // New Item Modal
    const [showNewItemModal, setShowNewItemModal] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        sku: '',
        category: 'Otros',
        defaultUnit: 'kg',
        currentCost: 0,
        // New fields for first purchase
        purchaseQuantity: 1,
        purchaseUnit: 'kg',
        priceType: 'total' as 'total' | 'per_unit'
    });

    // Help Modal
    const [showHelpModal, setShowHelpModal] = useState(false);

    // Input State for New Item Modal (fixes decimal input issue)
    const [purchaseQtyInput, setPurchaseQtyInput] = useState('1');



    // UI State
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const location = useLocation(); // Need to import useLocation
    const smartShopperState = location.state as { smartShopperMode?: boolean, preselectedSupplier?: any, itemsToAdd?: any[] } | null;

    // Load data on mount
    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/suppliers`, { headers: TENANT_HEADER }).then(r => r.json()),
            fetch(`${API_URL}/supply-items?limit=200`, { headers: TENANT_HEADER }).then(r => r.json())
        ]).then(([suppliersData, itemsData]) => {
            setSuppliers(suppliersData || []);
            const loadedItems = itemsData?.data || [];
            setAllItems(loadedItems);

            // Handle Smart Shopper State
            if (smartShopperState?.smartShopperMode && smartShopperState.preselectedSupplier) {
                const s = suppliersData.find((s: Supplier) => s.id === smartShopperState.preselectedSupplier.id)
                    || smartShopperState.preselectedSupplier;
                setSelectedSupplier(s);

                // Add Items to Cart
                if (smartShopperState.itemsToAdd && loadedItems.length > 0) {
                    const newCart: CartItem[] = [];
                    smartShopperState.itemsToAdd.forEach((planItem: any) => {
                        const fullItem = loadedItems.find((i: SupplyItem) => i.id === planItem.id);
                        if (fullItem) {
                            // Calculate default cart item
                            const qty = planItem.quantity || 1;
                            const calc = calculateCostPerBaseUnit(qty, fullItem.defaultUnit, planItem.price, 'per_unit');
                            newCart.push({
                                ...fullItem,
                                quantity: qty,
                                displayQuantity: qty.toString(),
                                purchaseUnit: fullItem.defaultUnit,
                                priceType: 'per_unit',
                                price: planItem.price,
                                normalizedQuantity: calc.normalizedQuantity,
                                costPerBaseUnit: calc.costPerBaseUnit
                            });
                        }
                    });
                    setCart(newCart);
                    setStep('review'); // Go straight to review? or items?
                } else {
                    setStep('items');
                }
            }
            // Auto-select supplier if passed via URL (fallback)
            else if (preselectedSupplierId && suppliersData) {
                const supplier = suppliersData.find((s: Supplier) => s.id === preselectedSupplierId);
                if (supplier) {
                    setSelectedSupplier(supplier);
                    setStep('items');
                }
            }
        }).catch(console.error);
    }, [preselectedSupplierId, smartShopperState]);

    // Filter items based on search
    const filteredItems = searchQuery.length >= 2
        ? allItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const noResultsFound = searchQuery.length >= 2 && filteredItems.length === 0;

    // Actions
    const createSupplier = async () => {
        if (!newSupplierName.trim()) return;
        try {
            const res = await fetch(`${API_URL}/suppliers`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({ name: newSupplierName, category: 'General' })
            });
            const newSup = await res.json();
            setSuppliers([...suppliers, newSup]);
            setSelectedSupplier(newSup);
            setShowNewSupplier(false);
            setNewSupplierName('');
            setStep('items');
        } catch (e) {
            console.error(e);
        }
    };

    const createNewItem = async () => {
        if (!newItem.name.trim()) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/supply-items`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    ...newItem,
                    sku: newItem.sku || `SKU-${Date.now()}`,
                    currentCost: Number(newItem.currentCost),
                    // Map frontend 'defaultUnit' to backend 'unitOfMeasure'
                    unitOfMeasure: newItem.defaultUnit,
                    preferredSupplierId: selectedSupplier?.id || preselectedSupplierId
                })
            });

            if (res.ok) {
                const created = await res.json();
                setAllItems([created, ...allItems]);

                // Auto-add to cart with initial values
                addToCart(created, {
                    quantity: newItem.purchaseQuantity,
                    purchaseUnit: newItem.purchaseUnit,
                    price: newItem.currentCost,
                    priceType: newItem.priceType
                });

                setShowNewItemModal(false);
                setNewItem({
                    name: '',
                    sku: '',
                    category: 'Otros',
                    defaultUnit: 'kg',
                    currentCost: 0,
                    purchaseQuantity: 1,
                    purchaseUnit: 'kg',
                    priceType: 'total'
                });
                setPurchaseQtyInput('1');
                setSearchQuery('');
                setMessage({ type: 'success', text: 'Item creado exitosamente' });
                setTimeout(() => setMessage(null), 2000);
            } else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || 'Error al crear item' });
            }
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'Error de conexión al crear item' });
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: SupplyItem, initialValues?: { quantity: number, purchaseUnit: string, price: number, priceType: 'total' | 'per_unit' }) => {
        if (cart.find(c => c.id === item.id)) return;

        const defaultPurchaseUnit = initialValues?.purchaseUnit || item.defaultUnit;

        // Initial calculations
        const qty = initialValues?.quantity || 1;
        const price = initialValues?.price !== undefined ? initialValues.price : item.currentCost;
        const priceType = initialValues?.priceType || 'total';

        const calc = calculateCostPerBaseUnit(qty, defaultPurchaseUnit, price, priceType);

        const newCartItem: CartItem = {
            ...item,
            quantity: qty,
            displayQuantity: qty.toString(),
            purchaseUnit: defaultPurchaseUnit,
            priceType: priceType,
            price: price,
            normalizedQuantity: calc.normalizedQuantity,
            costPerBaseUnit: calc.costPerBaseUnit
        };

        setCart([...cart, newCartItem]);
        setSearchQuery('');
    };

    const updateCartItem = (id: string, updates: Partial<Pick<CartItem, 'quantity' | 'purchaseUnit' | 'priceType' | 'price' | 'displayQuantity'>>) => {
        setCart(prev => prev.map(c => {
            if (c.id !== id) return c;

            const newItem = { ...c, ...updates };

            // If quantity updated strictly numerically (e.g. via +/- buttons), sync display
            if (updates.quantity !== undefined && updates.displayQuantity === undefined) {
                newItem.displayQuantity = updates.quantity.toString();
            }

            // Recalculate normalized values
            const calc = calculateCostPerBaseUnit(
                newItem.quantity,
                newItem.purchaseUnit,
                newItem.price,
                newItem.priceType
            );

            return {
                ...newItem,
                normalizedQuantity: calc.normalizedQuantity,
                costPerBaseUnit: calc.costPerBaseUnit
            };
        }).filter(c => c.quantity > 0));
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(c => c.id !== id));
    };

    const submitPurchase = async () => {
        if (!selectedSupplier || cart.length === 0) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/purchases`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify({
                    supplierId: selectedSupplier.id,
                    status: 'confirmed',
                    items: cart.map(c => ({
                        supplyItemId: c.id,
                        quantity: c.normalizedQuantity,  // Send normalized quantity
                        unitCost: c.costPerBaseUnit,     // Send cost per base unit
                        // Additional info for records
                        purchaseUnit: c.purchaseUnit,
                        purchaseQuantity: c.quantity,
                        purchasePrice: c.price,
                        priceType: c.priceType
                    })),
                }),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: '¡Compra Registrada! Precios y promedios actualizados.' });
                setTimeout(() => {
                    setCart([]);
                    navigate('/');
                }, 2500);
            } else {
                setMessage({ type: 'error', text: 'Error al registrar' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setLoading(false);
        }
    };

    // Calculate total based on normalized quantities
    const total = cart.reduce((acc, c) => {
        // Total cost = normalized quantity * cost per base unit
        return acc + c.normalizedQuantity * c.costPerBaseUnit;
    }, 0);

    // Items with price change (comparing new cost per base unit vs current)
    const itemsWithChange = cart.filter(c => Math.abs(c.costPerBaseUnit - c.currentCost) > 0.01);

    return (
        <div className="min-h-screen bg-enigma-black text-white">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-enigma-black/95 backdrop-blur-xl border-b border-white/5 p-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => step === 'suppliers' ? navigate('/') : step === 'review' ? setStep('items') : setStep('suppliers')}
                        className="p-2 -ml-2 rounded-xl hover:bg-white/5"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">
                            {step === 'suppliers' ? 'Nueva Compra' : step === 'items' ? 'Agregar Items' : 'Revisar Compra'}
                        </h1>
                        {selectedSupplier && step !== 'suppliers' && (
                            <p className="text-sm text-enigma-purple">{selectedSupplier.name}</p>
                        )}
                    </div>
                </div>
            </header>

            <main className="p-4 pb-32 space-y-4">
                {/* Step 1: Suppliers */}
                {step === 'suppliers' && (
                    <div className="space-y-4 animate-fade-in">
                        <p className="text-white/50 text-sm">Selecciona o crea un proveedor</p>

                        <div className="space-y-2">
                            {suppliers.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setSelectedSupplier(s); setStep('items'); }}
                                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-enigma-gray to-enigma-gray/50 border border-white/5 
                                        flex items-center gap-4 hover:border-enigma-purple/50 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-white/50" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-medium">{s.name}</p>
                                        <p className="text-xs text-white/40">{s.category || 'General'}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-enigma-purple transition-colors" />
                                </button>
                            ))}
                        </div>

                        {!showNewSupplier ? (
                            <button
                                onClick={() => setShowNewSupplier(true)}
                                className="w-full p-4 rounded-2xl border-2 border-dashed border-white/10 text-white/50 
                                    hover:border-enigma-purple/50 hover:text-enigma-purple transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Agregar Nuevo Proveedor
                            </button>
                        ) : (
                            <div className="p-4 rounded-2xl bg-enigma-gray border border-enigma-purple/30 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Nombre del proveedor"
                                    value={newSupplierName}
                                    onChange={e => setNewSupplierName(e.target.value)}
                                    autoFocus
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white 
                                        placeholder:text-white/30 focus:outline-none focus:border-enigma-purple"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowNewSupplier(false)}
                                        className="flex-1 p-3 rounded-xl bg-white/5 text-white/70"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={createSupplier}
                                        className="flex-1 p-3 rounded-xl bg-enigma-purple text-white font-bold"
                                    >
                                        Crear
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Items */}
                {step === 'items' && (
                    <div className="space-y-4 animate-fade-in">

                        {/* SUGGESTED ITEMS (Quick Add) */}
                        <SuggestedItems
                            supplierId={selectedSupplier?.id || ''}
                            onAdd={addToCart}
                            cart={cart}
                            allItems={allItems}
                        />

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-white/30" />
                            <input
                                type="text"
                                placeholder="Buscar ingrediente..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full p-3 pl-12 rounded-2xl bg-enigma-gray border border-white/10 text-white 
                                    placeholder:text-white/30 focus:outline-none focus:border-enigma-purple"
                            />
                        </div>

                        {/* Search Results */}
                        {filteredItems.length > 0 && (
                            <div className="rounded-2xl bg-enigma-gray/80 border border-white/10 divide-y divide-white/5 overflow-hidden">
                                {filteredItems.slice(0, 8).map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        disabled={cart.some(c => c.id === item.id)}
                                        className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-all disabled:opacity-40"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                            <Package className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-xs text-white/40">{item.defaultUnit} • {item.category}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-enigma-green">${item.currentCost.toFixed(2)}</p>
                                            <p className="text-xs text-white/30">actual</p>
                                        </div>
                                        <Plus className="w-5 h-5 text-enigma-green" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* No Results - Create New Item */}
                        {noResultsFound && (
                            <div className="p-6 rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 text-center space-y-4">
                                <Package className="w-12 h-12 text-amber-400 mx-auto opacity-50" />
                                <div>
                                    <p className="font-medium text-amber-400">"{searchQuery}" no existe</p>
                                    <p className="text-sm text-white/50 mt-1">¿Deseas crearlo ahora?</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setNewItem({ ...newItem, name: searchQuery });
                                        setShowNewItemModal(true);
                                    }}
                                    className="px-6 py-3 bg-enigma-purple rounded-xl font-bold inline-flex items-center gap-2
                                        hover:bg-enigma-purple/80 transition-all"
                                >
                                    <Plus className="w-5 h-5" />
                                    Crear "{searchQuery}"
                                </button>
                            </div>
                        )}

                        {/* Empty State */}
                        {searchQuery.length < 2 && cart.length === 0 && (
                            <div className="text-center py-12 text-white/40">
                                <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p>Busca ingredientes para agregarlos</p>
                            </div>
                        )}

                        {/* Cart */}
                        {cart.length > 0 && (
                            <div className="space-y-3 pt-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-white/50 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Items en Factura ({cart.length})
                                    </h3>
                                    <button
                                        onClick={() => setShowHelpModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 
                                            text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                        ¿Cómo registro?
                                    </button>
                                </div>

                                {cart.map(item => {
                                    const availableUnits = getPurchaseUnitsForBase(item.defaultUnit);
                                    const priceChange = formatPriceChange(item.currentCost, item.costPerBaseUnit);

                                    return (
                                        <div key={item.id} className="rounded-2xl bg-enigma-gray p-4 border border-white/5 space-y-4">
                                            {/* Header with name and remove */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium text-lg">{item.name}</p>
                                                    <p className="text-xs text-white/40 flex items-center gap-1">
                                                        <Scale className="w-3 h-3" />
                                                        Unidad base: {item.defaultUnit}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                                                >
                                                    <X className="w-5 h-5 text-red-400" />
                                                </button>
                                            </div>

                                            {/* Quantity + Unit Selector Row */}
                                            <div className="flex items-center gap-3">
                                                <label className="text-xs text-white/50 w-16">Cantidad:</label>
                                                <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1">
                                                    <button
                                                        onClick={() => updateCartItem(item.id, { quantity: Math.max(0.5, item.quantity - 1) })}
                                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        pattern="[0-9]*\.?[0-9]*"
                                                        value={item.displayQuantity ?? item.quantity.toString()}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            // Allow empty or partial decimal input
                                                            if (val === '' || val === '.' || /^\d*\.?\d*$/.test(val)) {
                                                                const numVal = parseFloat(val);
                                                                updateCartItem(item.id, {
                                                                    displayQuantity: val,
                                                                    quantity: isNaN(numVal) ? 0 : numVal
                                                                });
                                                            }
                                                        }}
                                                        onBlur={e => {
                                                            // On blur, ensure minimum 0.1
                                                            let numVal = parseFloat(e.target.value);
                                                            if (isNaN(numVal) || numVal < 0.1) {
                                                                numVal = 1; // Default to 1 if invalid
                                                            }
                                                            updateCartItem(item.id, {
                                                                quantity: numVal,
                                                                displayQuantity: numVal.toString()
                                                            });
                                                        }}
                                                        className="w-20 text-center font-mono font-bold bg-transparent focus:outline-none focus:bg-white/5 rounded"
                                                    />
                                                    <button
                                                        onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Unit Selector */}
                                                <select
                                                    value={item.purchaseUnit}
                                                    onChange={e => updateCartItem(item.id, { purchaseUnit: e.target.value })}
                                                    className="flex-1 px-3 py-2 rounded-xl bg-enigma-purple/20 border border-enigma-purple/30 
                                                        text-white font-medium focus:outline-none focus:border-enigma-purple cursor-pointer"
                                                >
                                                    {availableUnits.map(u => (
                                                        <option key={u.value} value={u.value}>{u.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Price Input Row */}
                                            <div className="flex items-center gap-3">
                                                <label className="text-xs text-white/50 w-16">Precio:</label>
                                                <div className="flex-1 relative">
                                                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={item.price}
                                                        onChange={e => updateCartItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                                                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/30 border border-white/10 
                                                            text-right font-mono focus:outline-none focus:border-enigma-purple"
                                                    />
                                                </div>

                                                {/* Price Type Toggle */}
                                                <div className="flex bg-black/30 rounded-xl p-1">
                                                    <button
                                                        onClick={() => updateCartItem(item.id, { priceType: 'total' })}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${item.priceType === 'total'
                                                            ? 'bg-enigma-purple text-white'
                                                            : 'text-white/50 hover:text-white'
                                                            }`}
                                                        title="Ingresa el precio total que pagaste por toda la compra"
                                                    >
                                                        Pagué Total
                                                    </button>
                                                    <button
                                                        onClick={() => updateCartItem(item.id, { priceType: 'per_unit' })}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${item.priceType === 'per_unit'
                                                            ? 'bg-enigma-purple text-white'
                                                            : 'text-white/50 hover:text-white'
                                                            }`}
                                                        title="Ingresa el precio por cada unidad comprada"
                                                    >
                                                        Por Unidad
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Conversion Summary - The Magic Box */}
                                            <div className="bg-gradient-to-r from-enigma-purple/10 to-blue-500/10 border border-enigma-purple/20 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-enigma-purple font-medium">
                                                    <RefreshCw className="w-3 h-3" />
                                                    Conversión Automática
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-sm text-white/70">
                                                            {item.quantity} {findPurchaseUnit(item.purchaseUnit)?.labelShort || item.purchaseUnit} = <span className="font-bold text-white">{item.normalizedQuantity.toFixed(2)} {item.defaultUnit}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-mono font-bold text-enigma-green text-lg">
                                                            ${item.costPerBaseUnit.toFixed(2)}/{item.defaultUnit}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Price Change Indicator */}
                                                {priceChange.direction !== 'same' && (
                                                    <div className={`flex items-center gap-2 text-sm pt-1 border-t border-white/10 ${priceChange.direction === 'up' ? 'text-red-400' : 'text-enigma-green'
                                                        }`}>
                                                        <Sparkles className="w-4 h-4" />
                                                        <span>
                                                            {priceChange.direction === 'up' ? '↑ Subió' : '↓ Bajó'} {priceChange.formatted}
                                                            <span className="text-white/40 ml-2">
                                                                (antes: ${item.currentCost.toFixed(2)}/{item.defaultUnit})
                                                            </span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Review */}
                {step === 'review' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="rounded-2xl bg-enigma-gray p-4 border border-white/5">
                            <p className="text-sm text-white/50 mb-2">Proveedor</p>
                            <p className="font-bold text-lg">{selectedSupplier?.name}</p>
                            <div className="flex flex-col gap-1 mt-2">
                                {selectedSupplier?.phone ? (
                                    <p className="text-sm text-white/60 flex items-center gap-2">
                                        📞 <span className="underline decoration-white/30">{selectedSupplier.phone}</span>
                                    </p>
                                ) : <p className="text-xs text-white/30 italic">Sin teléfono registrado</p>}

                                {selectedSupplier?.address ? (
                                    <p className="text-sm text-white/60 flex items-center gap-2">
                                        📍 <span className="max-w-[80%] truncate">{selectedSupplier.address}</span>
                                    </p>
                                ) : <p className="text-xs text-white/30 italic">Sin dirección registrada</p>}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-enigma-gray p-4 border border-white/5 space-y-3">
                            <p className="text-sm text-white/50">Items ({cart.length})</p>
                            {cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        <p className="text-xs text-white/40">
                                            {item.quantity} {findPurchaseUnit(item.purchaseUnit)?.labelShort || item.purchaseUnit}
                                            {item.purchaseUnit !== item.defaultUnit && (
                                                <span className="text-enigma-purple"> → {item.normalizedQuantity.toFixed(2)} {item.defaultUnit}</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-enigma-green/70 mt-0.5">
                                            ${item.costPerBaseUnit.toFixed(2)}/{item.defaultUnit}
                                        </p>
                                    </div>
                                    <p className="font-mono text-enigma-green text-lg">${(item.normalizedQuantity * item.costPerBaseUnit).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>

                        {itemsWithChange.length > 0 && (
                            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
                                <p className="text-sm text-amber-400 font-medium mb-2">⚡ Cambios de Precio</p>
                                <p className="text-xs text-white/60">
                                    {itemsWithChange.length} item(s) tendrán precio actualizado al confirmar
                                </p>
                            </div>
                        )}

                        <div className="rounded-2xl bg-enigma-purple/20 border border-enigma-purple/30 p-4 flex justify-between items-center">
                            <span className="font-medium">Total</span>
                            <span className="text-2xl font-bold font-mono">${total.toFixed(2)}</span>
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Action Bar */}
            {cart.length > 0 && step !== 'suppliers' && (
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-enigma-black via-enigma-black to-transparent">
                    {step === 'items' ? (
                        <button
                            onClick={() => setStep('review')}
                            className="w-full py-4 rounded-2xl bg-enigma-purple font-bold text-lg 
                                flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                            Revisar ({cart.length} items) • ${total.toFixed(2)}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={submitPurchase}
                            disabled={loading}
                            className="w-full py-4 rounded-2xl bg-enigma-green font-bold text-lg 
                                flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    <Check className="w-6 h-6" />
                                    Confirmar Compra
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Success/Error Message */}
            {message && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in`}>
                    <div className={`p-8 rounded-3xl text-center space-y-4 ${message.type === 'success' ? 'bg-enigma-green/20 border border-enigma-green/50' : 'bg-red-500/20 border border-red-500/50'
                        }`}>
                        {message.type === 'success' ? (
                            <Check className="w-16 h-16 text-enigma-green mx-auto" />
                        ) : (
                            <X className="w-16 h-16 text-red-400 mx-auto" />
                        )}
                        <p className="text-xl font-bold">{message.text}</p>
                    </div>
                </div>
            )}

            {/* New Item Modal */}
            {showNewItemModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-fade-in">
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Nuevo Ingrediente</h2>
                            <button onClick={() => setShowNewItemModal(false)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Nombre *</label>
                                {selectedSupplier && (
                                    <div className="mb-2 px-3 py-1.5 bg-enigma-green/10 border border-enigma-green/20 rounded-lg inline-flex items-center gap-2">
                                        <Building2 className="w-3 h-3 text-enigma-green" />
                                        <span className="text-xs text-enigma-green">Vinculado a: {selectedSupplier.name}</span>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                    placeholder="Ej: Harina de Trigo"
                                    className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                        text-white placeholder-white/30 focus:border-enigma-purple focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm text-white/50 mb-1 block">Categoría</label>
                                    <select
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white focus:border-enigma-purple focus:outline-none"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-white/50 mb-1 block">Unidad</label>
                                    <select
                                        value={newItem.defaultUnit}
                                        onChange={e => setNewItem({ ...newItem, defaultUnit: e.target.value })}
                                        className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white focus:border-enigma-purple focus:outline-none"
                                    >
                                        {UNITS.map(unit => (
                                            <option key={unit} value={unit}>{unit}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* First Purchase Section */}
                            <div className="border-t border-white/10 pt-4 mt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Scale className="w-4 h-4 text-enigma-purple" />
                                    <p className="text-sm font-medium text-enigma-purple">Primera Compra (opcional)</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label className="text-xs text-white/50 mb-1 block">Cantidad</label>
                                        <label className="text-xs text-white/50 mb-1 block">Cantidad</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            pattern="[0-9]*\.?[0-9]*"
                                            value={purchaseQtyInput}
                                            onChange={e => {
                                                const val = e.target.value;
                                                // Allow empty, "0.", etc.
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setPurchaseQtyInput(val);
                                                    const numVal = parseFloat(val);
                                                    if (!isNaN(numVal)) {
                                                        setNewItem({ ...newItem, purchaseQuantity: numVal });
                                                    } else {
                                                        setNewItem({ ...newItem, purchaseQuantity: 0 });
                                                    }
                                                }
                                            }}
                                            onBlur={() => {
                                                let numVal = parseFloat(purchaseQtyInput);
                                                if (isNaN(numVal) || numVal < 0.1) {
                                                    numVal = 1;
                                                    setPurchaseQtyInput('1');
                                                } else {
                                                    // Optional: format? e.g. remove trailing dot
                                                    setPurchaseQtyInput(numVal.toString());
                                                }
                                                setNewItem({ ...newItem, purchaseQuantity: numVal });
                                            }}
                                            className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                                text-white text-center font-bold focus:border-enigma-purple focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50 mb-1 block">Unidad de Compra</label>
                                        <select
                                            value={newItem.purchaseUnit}
                                            onChange={e => setNewItem({ ...newItem, purchaseUnit: e.target.value })}
                                            className="w-full px-4 py-3 bg-enigma-purple/20 rounded-xl border border-enigma-purple/30 
                                                text-white font-medium focus:border-enigma-purple focus:outline-none"
                                        >
                                            {getPurchaseUnitsForBase(newItem.defaultUnit).map(u => (
                                                <option key={u.value} value={u.value}>{u.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs text-white/50">Precio de esta compra</label>
                                        <div className="flex bg-black/30 rounded-lg p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setNewItem({ ...newItem, priceType: 'total' })}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${newItem.priceType === 'total'
                                                    ? 'bg-enigma-purple text-white'
                                                    : 'text-white/50 hover:text-white'
                                                    }`}
                                            >
                                                Pagué Total
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewItem({ ...newItem, priceType: 'per_unit' })}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${newItem.priceType === 'per_unit'
                                                    ? 'bg-enigma-purple text-white'
                                                    : 'text-white/50 hover:text-white'
                                                    }`}
                                            >
                                                Por Unidad
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newItem.currentCost}
                                            onChange={e => setNewItem({ ...newItem, currentCost: parseFloat(e.target.value) || 0 })}
                                            placeholder={newItem.priceType === 'total' ? 'Precio total pagado' : 'Precio por cada unidad'}
                                            className="w-full pl-10 pr-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                                text-white placeholder:text-white/30 focus:border-enigma-purple focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Live Conversion Preview */}
                                {newItem.currentCost > 0 && (
                                    <div className="mt-3 bg-gradient-to-r from-enigma-purple/10 to-blue-500/10 border border-enigma-purple/20 rounded-xl p-3">
                                        <div className="flex items-center gap-2 text-xs text-enigma-purple font-medium mb-1">
                                            <RefreshCw className="w-3 h-3" />
                                            Vista Previa de Conversión
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-white/70">
                                                {newItem.purchaseQuantity} {newItem.purchaseUnit} = {' '}
                                                <span className="font-bold text-white">
                                                    {(newItem.purchaseQuantity * (getPurchaseUnitsForBase(newItem.defaultUnit).find(u => u.value === newItem.purchaseUnit)?.toBaseUnit || 1)).toFixed(2)} {newItem.defaultUnit}
                                                </span>
                                            </span>
                                            <span className="font-mono font-bold text-enigma-green">
                                                ${(() => {
                                                    const calc = calculateCostPerBaseUnit(
                                                        newItem.purchaseQuantity,
                                                        newItem.purchaseUnit,
                                                        newItem.currentCost,
                                                        newItem.priceType
                                                    );
                                                    return calc.costPerBaseUnit.toFixed(2);
                                                })()}/{newItem.defaultUnit}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={createNewItem}
                                disabled={!newItem.name.trim()}
                                className="w-full py-4 bg-enigma-purple rounded-xl font-bold text-lg
                                    hover:bg-enigma-purple/80 disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all active:scale-[0.98]"
                            >
                                Crear y Agregar a Factura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
                    <div className="w-full max-w-lg bg-enigma-gray rounded-2xl p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <HelpCircle className="w-6 h-6 text-blue-400" />
                                ¿Cómo registro mi compra?
                            </h2>
                            <button onClick={() => setShowHelpModal(false)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Example 1 */}
                            <div className="bg-enigma-black/50 rounded-xl p-4 border border-white/10">
                                <p className="text-enigma-green font-medium mb-2">✓ Compré 2 bolsas de 500g de Harina a $3 en total</p>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-white/40 text-xs">Cantidad</p>
                                        <p className="font-bold">2</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Unidad</p>
                                        <p className="font-bold text-enigma-purple">500g</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Precio</p>
                                        <p className="font-bold">$3 <span className="text-enigma-purple text-xs">Pagué Total</span></p>
                                    </div>
                                </div>
                                <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/10">
                                    → El sistema calcula: 1 kg @ $3.00/kg
                                </p>
                            </div>

                            {/* Example 2 */}
                            <div className="bg-enigma-black/50 rounded-xl p-4 border border-white/10">
                                <p className="text-enigma-green font-medium mb-2">✓ Compré 1 costal de 25kg de Azúcar a $45</p>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-white/40 text-xs">Cantidad</p>
                                        <p className="font-bold">1</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Unidad</p>
                                        <p className="font-bold text-enigma-purple">25kg (costal)</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Precio</p>
                                        <p className="font-bold">$45 <span className="text-enigma-purple text-xs">Pagué Total</span></p>
                                    </div>
                                </div>
                                <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/10">
                                    → El sistema calcula: 25 kg @ $1.80/kg
                                </p>
                            </div>

                            {/* Example 3 */}
                            <div className="bg-enigma-black/50 rounded-xl p-4 border border-white/10">
                                <p className="text-enigma-green font-medium mb-2">✓ Compré 3 litros de Leche a $2.50 cada uno</p>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-white/40 text-xs">Cantidad</p>
                                        <p className="font-bold">3</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Unidad</p>
                                        <p className="font-bold text-enigma-purple">L</p>
                                    </div>
                                    <div>
                                        <p className="text-white/40 text-xs">Precio</p>
                                        <p className="font-bold">$2.50 <span className="text-blue-400 text-xs">Por Unidad</span></p>
                                    </div>
                                </div>
                                <p className="text-xs text-white/40 mt-2 pt-2 border-t border-white/10">
                                    → El sistema calcula: 3 L @ $2.50/L
                                </p>
                            </div>

                            {/* Tip Box */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <p className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                                    <Info className="w-4 h-4" />
                                    ¿Cuál botón uso?
                                </p>
                                <ul className="text-sm text-white/70 space-y-1">
                                    <li><span className="text-enigma-purple font-medium">Pagué Total:</span> Cuando tienes el precio de TODA la compra</li>
                                    <li><span className="text-blue-400 font-medium">Por Unidad:</span> Cuando conoces el precio de CADA unidad</li>
                                </ul>
                            </div>

                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="w-full py-3 bg-enigma-purple rounded-xl font-bold hover:bg-enigma-purple/80 transition-all"
                            >
                                ¡Entendido!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SuggestedItems({ supplierId, onAdd, cart, allItems }: { supplierId: string, onAdd: any, cart: any[], allItems: SupplyItem[] }) {
    const [suggested, setSuggested] = useState<SupplyItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!supplierId || allItems.length === 0) return;
        setLoading(true);
        fetch(`${API_URL}/suppliers/${supplierId}/analytics`)
            .then(r => r.json())
            .then(data => {
                if (data.topItems && Array.isArray(data.topItems)) {
                    // Match IDs to full item objects
                    const matched = data.topItems
                        .map((top: any) => allItems.find((i: SupplyItem) => i.id === top.id))
                        .filter(Boolean);
                    setSuggested(matched);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [supplierId, allItems]);

    if (loading) return <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl" />;
    if (suggested.length === 0) return null;

    return (
        <div className="space-y-2">
            <p className="text-xs text-enigma-purple font-bold uppercase tracking-wider">Frecuentes con este proveedor</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {suggested.map(item => {
                    const isAdded = cart.some((c: any) => c.id === item.id);
                    return (
                        <button
                            key={item.id}
                            onClick={() => onAdd(item)}
                            disabled={isAdded}
                            className={`flex-shrink-0 px-4 py-3 rounded-xl border flex items-center gap-2 transition-all 
                                ${isAdded
                                    ? 'bg-enigma-green/10 border-enigma-green/30 opacity-50'
                                    : 'bg-enigma-gray border-white/10 hover:border-enigma-purple hover:bg-white/5'}`}
                        >
                            <Package className={`w-4 h-4 ${isAdded ? 'text-enigma-green' : 'text-white/50'}`} />
                            <div className="text-left">
                                <p className={`text-sm font-medium ${isAdded ? 'text-enigma-green' : 'text-white'}`}>
                                    {item.name}
                                </p>
                                <p className="text-[10px] text-white/30 truncate max-w-[100px]">
                                    {item.sku}
                                </p>
                            </div>
                            {!isAdded && <Plus className="w-4 h-4 text-enigma-purple ml-1" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
