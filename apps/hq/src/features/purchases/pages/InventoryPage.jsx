
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Package, ChefHat, ShoppingCart,
    ArrowUpRight, ArrowDownRight, Search, Filter, Plus, FileDown, Upload, X,
    TrendingUp, FileText, Info, Trash2, ArrowUpDown, AlertTriangle
} from 'lucide-react';
import { api, CURRENT_TENANT_ID } from '@/lib/api';
import { UnifiedItemModal } from '../components/UnifiedItemModal';

export default function InventoryPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    // --- STATE ---
    const [zone, setZone] = useState('MENU'); // MENU | KITCHEN | PANTRY
    const [products, setProducts] = useState([]);
    const [supplyItems, setSupplyItems] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('PRODUCT'); // PRODUCT | BATCH | SUPPLY
    const [editingItem, setEditingItem] = useState(null);

    // Production State
    const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
    const [productionItem, setProductionItem] = useState(null);
    const [productionQty, setProductionQty] = useState('');
    const [viewingItem, setViewingItem] = useState(null);

    const handleOpenProduce = (e, item) => {
        e.stopPropagation();
        setProductionItem(item);
        setProductionQty('');
        setIsProductionModalOpen(true);
    };

    const submitProduction = async () => {
        if (!productionItem || !productionQty) return;
        setLoading(true);
        try {
            await api.post('/production', {
                supplyItemId: productionItem.id,
                quantity: parseFloat(productionQty) * (productionItem.yieldQuantity || 1),
                unit: productionItem.yieldUnit || 'und'
            });
            setIsProductionModalOpen(false);
            fetchData();
        } catch (e) {
            console.error("Production failed", e);
            alert("Failed to record production");
        } finally {
            setLoading(false);
        }
    };

    // --- IMPORT CSV LOGIC ---
    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            setLoading(true);
            try {
                // Send CSV content to Backend
                const response = await api.post('/ingest/products', {
                    csv_content: content,
                    tenant_id: CURRENT_TENANT_ID,
                    actor_id: 'hq-user'
                });

                if (response.data.success) {
                    const inserted = response.data.nodes;
                    const total = response.data.totalParsed || inserted;
                    const errors = response.data.errors || [];

                    let msg = `Import finished. Successfully added ${inserted} of ${total} items.`;

                    if (errors.length > 0) {
                        msg += `\n\nFailures (First 5):\n${errors.join('\n')}`;
                    }

                    alert(msg);
                    await fetchData(); // Refresh data
                } else {
                    alert('Import completed but returned no success flag.');
                }
            } catch (err) {
                console.error("Import error:", err);
                const errMsg = err.response?.data?.error || err.response?.data?.message || err.message;
                alert("Failed to import CSV: " + errMsg);
            } finally {
                setLoading(false);
                // Reset input
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- DATA FETCHING ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const [prodRes, supplyRes] = await Promise.all([
                api.get('/products'),
                api.get('/supply-items')
            ]);
            setProducts(prodRes.data.data || []);
            setSupplyItems(supplyRes.data.data || []);

            // Fetch Logs if needed or lazily
            if (true) {
                const logRes = await api.get('/inventory/logs?limit=100');
                if (logRes.data.success) setLogs(logRes.data.data);
            }
        } catch (e) {
            console.error("Failed to fetch inventory", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- FILTER & ZONES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name');

    const filteredProducts = products.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSupplyItems = supplyItems.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Compute effective cost from live recipe data (same formula as API backend)
    // Falls back to stored cost if no recipes linked
    const getEffectiveCost = (item) => {
        if (item.recipes && item.recipes.length > 0) {
            return item.recipes.reduce((acc, r) => {
                const si = r.supplyItem;
                const factor = si?.stockCorrectionFactor || 1;
                const yld = si?.yieldPercentage || 1;
                const rawCost = si?.averageCost || si?.currentCost || 0;
                return acc + r.quantity * (rawCost / (factor * yld));
            }, 0);
        }
        return item.cost || 0;
    };

    const menuItems = [...filteredProducts].sort((a, b) => {
        const costA = getEffectiveCost(a);
        const costB = getEffectiveCost(b);
        const marginA = a.price > 0 && costA > 0 ? ((a.price - costA) / a.price) * 100 : -Infinity;
        const marginB = b.price > 0 && costB > 0 ? ((b.price - costB) / b.price) * 100 : -Infinity;
        switch (sortBy) {
            case 'price_desc': return b.price - a.price;
            case 'price_asc': return a.price - b.price;
            case 'cost_asc': return costA - costB;
            case 'cost_desc': return costB - costA;
            case 'margin_desc': return marginB - marginA;
            case 'margin_asc': return marginA - marginB;
            default: return a.name.localeCompare(b.name);
        }
    });
    const kitchenItems = filteredSupplyItems.filter(i => i.isProduction && !products.some(p => p.sku && i.sku && p.sku === i.sku));
    const pantryItems = filteredSupplyItems.filter(i => !i.isProduction && !products.some(p => p.sku && i.sku && p.sku === i.sku));

    // Combine for Search (Ingredients can come from Pantry OR Kitchen)
    const allIngredients = [...supplyItems];

    // --- ACTIONS ---
    const handleOpenCreate = () => {
        if (zone === 'LOGS') { fetchData(); return; } // Refresh action
        setEditingItem(null);
        if (zone === 'MENU') setModalType('PRODUCT');
        if (zone === 'KITCHEN') setModalType('BATCH');
        if (zone === 'PANTRY') setModalType('SUPPLY');
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        if (zone === 'MENU') setModalType('PRODUCT');
        if (zone === 'KITCHEN') setModalType('BATCH');
        if (zone === 'PANTRY') setModalType('SUPPLY');
        setIsModalOpen(true);
    };

    const handleDelete = async (e, item) => {
        e.stopPropagation();
        if (!window.confirm(`¿Dar de baja "${item.name}"? Esta acción la ocultará del sistema.`)) return;
        try {
            const endpoint = zone === 'MENU' ? `/products/${item.id}` : `/supply-items/${item.id}`;
            await api.delete(endpoint);
            fetchData();
        } catch (err) {
            alert('Error al dar de baja: ' + (err.message || 'Error desconocido'));
        }
    };


    // --- RENDER HELPERS ---
    const renderZoneHeader = () => {
        switch (zone) {
            case 'MENU': return {
                title: "Zone 1: Menu (Strategy)",
                desc: "Sales Items linked to recipes.",
                color: "text-emerald-400",
                btnText: "New Menu Product"
            };
            case 'KITCHEN': return {
                title: "Zone 2: Kitchen (Production)",
                desc: "Internal Preps & Batches.",
                color: "text-amber-400",
                btnText: "New Production Batch"
            };
            case 'PANTRY': return {
                title: "Zone 3: Pantry (Procurement)",
                desc: "Raw Ingredients from Suppliers.",
                color: "text-blue-400",
                btnText: "Register Supply Item"
            };
            case 'LOGS': return {
                title: "Zone 4: Activity Logs (Audit)",
                desc: "Recent inventory movements and deductions.",
                color: "text-purple-400",
                btnText: "Refresh Logs"
            };
            default: return {};
        }
    };

    const headerParams = renderZoneHeader();

    return (
        <div className="h-screen bg-black text-white p-6 overflow-hidden flex flex-col">
            {/* HIDDEN INPUT FOR CSV */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
            />

            {/* TOP BAR */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Package className="text-indigo-500" /> Unified Catalog
                    </h1>
                    <p className="text-zinc-500 text-sm">The Profit Engine: Manage Strategy, Production, and Procurement.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleImportClick}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm text-zinc-300 flex items-center gap-2"
                    >
                        <Upload size={16} /> {loading ? 'Importing...' : 'Import CSV'}
                    </button>
                    <button
                        onClick={() => {
                            const url = `${import.meta.env.VITE_API_URL || 'https://enigma-pos-os-production.up.railway.app/api/v1'}/data/export?tenantId=${CURRENT_TENANT_ID}`;
                            window.location.href = url;
                        }}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm text-zinc-300 flex items-center gap-2"
                    >
                        <FileDown size={16} /> Export
                    </button>
                </div>
            </div>

            {/* STATISTICS SUMMARY (Mocked for Visuals) */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Menu Items</p>
                    <p className="text-2xl font-bold text-white">{products.length}</p>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Batches (Preps)</p>
                    <p className="text-2xl font-bold text-amber-500">
                        {kitchenItems.length}
                    </p>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Raw Ingredients</p>
                    <p className="text-2xl font-bold text-blue-500">
                        {pantryItems.length}
                    </p>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase font-bold">Total Stock Value</p>
                    <p className="text-2xl font-bold text-emerald-500">
                        ${supplyItems.reduce((acc, item) => acc + ((item.currentCost || 0) * (item.stockQuantity || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* ZONE TABS */}
            <div className="flex border-b border-zinc-800 mb-6">
                <button
                    onClick={() => setZone('MENU')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${zone === 'MENU' ? 'border-emerald-500 text-emerald-400 bg-emerald-900/10' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <LayoutDashboard size={18} /> Zone 1: Menu (Strategy)
                </button>
                <button
                    onClick={() => setZone('KITCHEN')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${zone === 'KITCHEN' ? 'border-amber-500 text-amber-400 bg-amber-900/10' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <ChefHat size={18} /> Zone 2: Kitchen (Production)
                </button>
                <button
                    onClick={() => setZone('PANTRY')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${zone === 'PANTRY' ? 'border-blue-500 text-blue-400 bg-blue-900/10' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <ShoppingCart size={18} /> Zone 3: Pantry (Procurement)
                </button>
                <button
                    onClick={() => setZone('LOGS')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${zone === 'LOGS' ? 'border-purple-500 text-purple-400 bg-purple-900/10' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <TrendingUp size={18} /> Zone 4: Logs
                </button>
            </div>

            {/* ZONE CONTENT HEADER */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className={`text-lg font-bold ${headerParams.color}`}>{headerParams.title}</h2>
                    <p className="text-zinc-500 text-sm">{headerParams.desc}</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                        <input
                            className="bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white w-56 focus:ring-1 focus:ring-emerald-500"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {zone === 'MENU' && (
                        <div className="relative flex items-center">
                            <ArrowUpDown className="absolute left-3 text-zinc-500 pointer-events-none" size={14} />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-300 focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer"
                            >
                                <option value="name">Nombre A-Z</option>
                                <option value="price_desc">Precio: Mayor → Menor</option>
                                <option value="price_asc">Precio: Menor → Mayor</option>
                                <option value="cost_asc">Costo: Menor → Mayor</option>
                                <option value="cost_desc">Costo: Mayor → Menor</option>
                                <option value="margin_desc">Margen: Mayor → Menor</option>
                                <option value="margin_asc">Margen: Menor → Mayor (peores)</option>
                            </select>
                        </div>
                    )}
                    {/* SMART ACTION BUTTON */}
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-white/10"
                    >
                        <Plus size={16} /> {zone === 'LOGS' ? 'Refresh' : headerParams.btnText}
                    </button>
                </div>
            </div>

            {/* MENU ZONE SUMMARY BAR */}
            {zone === 'MENU' && (() => {
                const negMargin = menuItems.filter(i => { const c = getEffectiveCost(i); return i.price > 0 && c > 0 && c > i.price; });
                const noCost = menuItems.filter(i => getEffectiveCost(i) === 0);
                const withCost = menuItems.filter(i => getEffectiveCost(i) > 0 && i.price > 0);
                const avgMargin = withCost.length > 0
                    ? withCost.reduce((acc, i) => { const c = getEffectiveCost(i); return acc + ((i.price - c) / i.price) * 100; }, 0) / withCost.length
                    : 0;
                const placeholderPrice = menuItems.filter(i => i.price === 1);
                return (
                    <div className="flex gap-3 mb-3 text-xs">
                        {negMargin.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-medium">
                                <AlertTriangle size={12} />
                                {negMargin.length} margen negativo{negMargin.length > 1 ? 's' : ''}
                            </div>
                        )}
                        {noCost.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 font-medium">
                                {noCost.length} sin costo
                            </div>
                        )}
                        {placeholderPrice.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 font-medium">
                                {placeholderPrice.length} precio $1 (placeholder)
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-400 font-medium ml-auto">
                            Margen promedio: <span className={`font-bold ml-1 ${avgMargin >= 60 ? 'text-emerald-400' : avgMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{avgMargin.toFixed(1)}%</span>
                        </div>
                    </div>
                );
            })()}

            {/* TABLE AREA */}
            <div className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-medium border-b border-zinc-800">
                                    {zone === 'MENU' ? 'Menu Item' : zone === 'KITCHEN' ? 'Batch / Prep' : 'Supply Item'}
                                </th>
                                <th className="p-4 font-medium border-b border-zinc-800">
                                    {zone === 'MENU' ? 'Sales Price' : zone === 'KITCHEN' ? 'Yield' : 'Purchase Unit'}
                                </th>
                                <th className="p-4 font-medium border-b border-zinc-800">
                                    {zone === 'MENU' ? 'Calc Cost' : zone === 'KITCHEN' ? 'Unit Cost' : zone === 'LOGS' ? 'Reason' : 'Last Cost'}
                                </th>
                                {(zone === 'PANTRY' || zone === 'KITCHEN' || zone === 'LOGS') && (
                                    <>
                                        <th className="p-4 font-medium border-b border-zinc-800 text-right">{zone === 'LOGS' ? 'Previous' : 'Stock'}</th>
                                        <th className="p-4 font-medium border-b border-zinc-800 text-right">{zone === 'LOGS' ? 'New' : 'Total Value'}</th>
                                    </>
                                )}
                                <th className="p-4 font-medium border-b border-zinc-800 text-right">
                                    {zone === 'MENU' ? 'Margin %' : zone === 'KITCHEN' ? 'POS Link' : zone === 'LOGS' ? 'Change' : 'Trend'}
                                </th>
                                <th className="p-4 font-medium border-b border-zinc-800 text-right">
                                    {zone === 'LOGS' ? 'Notes' : 'Actions'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-zinc-800">
                            {zone === 'MENU' && menuItems.map(item => {
                                const effectiveCost = getEffectiveCost(item);
                                const hasRecipe = item.recipes && item.recipes.length > 0;
                                const noCost = effectiveCost === 0;
                                const margin = item.price > 0 && effectiveCost > 0 ? ((item.price - effectiveCost) / item.price) * 100 : 0;
                                const isNegative = !noCost && margin < 0;
                                const isPlaceholderPrice = item.price === 1;
                                const marginBadgeClass = noCost
                                    ? 'bg-zinc-700/50 text-zinc-500'
                                    : isNegative
                                    ? 'bg-red-600/30 text-red-400 ring-1 ring-red-500/30'
                                    : margin < 30
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : margin < 60
                                    ? 'bg-yellow-500/10 text-yellow-300'
                                    : 'bg-emerald-500/20 text-emerald-400';
                                return (
                                    <tr key={item.id} className={`hover:bg-zinc-800/50 group cursor-pointer ${isNegative ? 'bg-red-950/20' : ''}`} onClick={() => handleEdit(item)}>
                                        <td className="p-4">
                                            <div className="font-medium text-white flex items-center gap-2">
                                                {item.name}
                                                {isNegative && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                                            </div>
                                            <div className="text-xs text-zinc-500 bg-zinc-800/50 px-1 rounded inline-block">{item.sku || item.id.slice(0, 8)}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`font-medium ${isPlaceholderPrice ? 'text-amber-400' : 'text-zinc-300'}`}>${item.price.toFixed(2)}</span>
                                            {isPlaceholderPrice && <span className="text-[10px] text-amber-500/70 ml-1">placeholder</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-zinc-300">${effectiveCost.toFixed(2)}</span>
                                            {hasRecipe && item.cost !== effectiveCost && item.cost === 0 && (
                                                <span className="text-[10px] text-violet-400/70 ml-1">vivo</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${marginBadgeClass}`}>
                                                {noCost ? 'Sin costo' : `${margin.toFixed(1)}%`}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingItem({ ...item, type: 'PRODUCT' }); }}
                                                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-emerald-400 transition-colors"
                                                    title="Ver Ficha Técnica"
                                                >
                                                    <Search size={16} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-zinc-500 hover:text-white z-10 relative">Edit</button>
                                                <button onClick={(e) => handleDelete(e, item)} className="p-1.5 hover:bg-zinc-700 rounded text-red-400 hover:text-red-300 transition-colors" title="Dar de baja"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {zone === 'KITCHEN' && kitchenItems.map(item => (
                                <tr key={item.id} className={`hover:bg-zinc-800/50 group cursor-pointer ${!item.yieldQuantity ? 'opacity-70' : ''}`} onClick={() => handleEdit(item)}>
                                    <td className="p-4">
                                        <div className="font-medium text-amber-100">{item.name}</div>
                                        {!item.yieldQuantity && (
                                            <div className="text-[10px] text-orange-400 font-bold mt-0.5">⚠ Sin yield configurado</div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {item.yieldQuantity
                                            ? <span className="text-zinc-300 font-mono">{item.yieldQuantity} {item.yieldUnit}</span>
                                            : <span className="text-orange-400/60 text-xs italic">No definido</span>
                                        }
                                    </td>
                                    <td className="p-4 text-zinc-300">
                                        ${(item.currentCost || 0).toFixed(2)} <span className="text-xs text-zinc-500">/ batch</span>
                                    </td>
                                    <td className="p-4 text-zinc-200 font-bold">
                                        {(item.stockQuantity || 0).toFixed(2)} <span className="text-xs text-zinc-500 font-normal">{item.yieldUnit || 'und'}</span>
                                    </td>
                                    <td className="p-4 text-emerald-400 font-bold">
                                        ${((item.stockQuantity || 0) * (item.currentCost || 0)).toFixed(2)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="w-2 h-2 rounded-full bg-zinc-600 mx-auto" title="Not linked to POS"></div>
                                    </td>
                                    <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={(e) => handleOpenProduce(e, item)}
                                                className="px-3 py-1 bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-black rounded text-xs font-bold transition-colors"
                                            >
                                                PRODUCE
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setViewingItem({ ...item, type: 'BATCH' }); }}
                                                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-amber-400 transition-colors"
                                            >
                                                <Search size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-zinc-500 hover:text-white">Edit</button>
                                            <button onClick={(e) => handleDelete(e, item)} className="p-1.5 hover:bg-zinc-700 rounded text-red-400 hover:text-red-300 transition-colors" title="Dar de baja"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {zone === 'PANTRY' && pantryItems.map(item => {
                                const costChange = item.averageCost > 0 ? ((item.currentCost - item.averageCost) / item.averageCost) * 100 : 0;
                                const isUp = costChange > 0;
                                const isDown = costChange < 0;
                                return (
                                    <tr key={item.id} className="hover:bg-zinc-800/50 group cursor-pointer" onClick={() => setViewingItem({ ...item, type: 'SUPPLY' })}>
                                        <td className="p-4 font-medium text-blue-100">{item.name}</td>
                                        <td className="p-4 text-zinc-400">{item.defaultUnit}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-zinc-300 font-mono">
                                                    ${(item.currentCost || 0).toFixed(2)}
                                                    <span className="text-xs text-zinc-600 ml-1">last</span>
                                                </span>
                                                {item.lastThreePurchasesAvg != null && (
                                                    <span className="text-xs text-violet-400 font-mono">
                                                        avg3: ${item.lastThreePurchasesAvg.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-zinc-200 font-bold">
                                            {(item.stockQuantity || 0).toFixed(2)} <span className="text-xs text-zinc-500 font-normal">{item.defaultUnit}</span>
                                        </td>
                                        <td className="p-4 text-emerald-400 font-bold">
                                            ${((item.stockQuantity || 0) * (item.lastThreePurchasesAvg || item.averageCost || 0)).toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            {Math.abs(costChange) > 1 ? (
                                                <div className={`flex items-center gap-1 text-xs font-bold ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                    {Math.abs(costChange).toFixed(1)}%
                                                </div>
                                            ) : (
                                                <span className="text-zinc-500 text-xs">Stable</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingItem({ ...item, type: 'SUPPLY' }); }}
                                                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-blue-400 transition-colors"
                                                >
                                                    <Search size={16} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setViewingItem({ ...item, type: 'SUPPLY' }); }} className="text-blue-400 hover:text-white">History</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="text-zinc-500 hover:text-white">Edit</button>
                                                <button onClick={(e) => handleDelete(e, item)} className="p-1.5 hover:bg-zinc-700 rounded text-red-400 hover:text-red-300 transition-colors" title="Dar de baja"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {zone === 'LOGS' && logs.map(log => (
                                <tr key={log.id} className="hover:bg-zinc-800/50">
                                    <td className="p-4">
                                        <div className="font-medium text-white">{log.supplyItem?.name || 'Unknown Item'}</div>
                                        <div className="text-xs text-zinc-500">{new Date(log.createdAt).toLocaleString()}</div>
                                    </td>
                                    <td className="p-4 text-zinc-400">{log.supplyItem?.defaultUnit || '-'}</td>
                                    <td className="p-4 text-zinc-300 uppercase text-xs font-bold">{log.reason}</td>
                                    <td className="p-4 text-zinc-400 text-right">{log.previousStock}</td>
                                    <td className="p-4 text-white font-bold text-right">{log.newStock}</td>
                                    <td className={`p-4 text-right font-bold ${log.changeAmount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {log.changeAmount > 0 ? '+' : ''}{log.changeAmount.toFixed(4)}
                                    </td>
                                    <td className="p-4 text-right text-zinc-500 text-xs">
                                        {log.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* UNIFIED MODAL */}
            <UnifiedItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type={modalType}
                initialData={editingItem}
                onSuccess={fetchData}
                allItems={allIngredients}
            />

            {/* PRODUCTION MODAL */}
            {/* PRODUCTION MODAL */}
            {isProductionModalOpen && productionItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Execute Production</h3>
                            <button onClick={() => setIsProductionModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                            <p className="text-amber-400 font-bold">{productionItem.name}</p>
                            <p className="text-xs text-zinc-400">
                                1 Tandas (Batch) = {productionItem.yieldQuantity} {productionItem.yieldUnit}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Número de Tandas (Batches)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    autoFocus
                                    className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                    value={productionQty}
                                    onChange={e => setProductionQty(e.target.value)}
                                    placeholder="e.g. 1"
                                />
                                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 flex items-center">
                                    Tandas
                                </div>
                            </div>
                        </div>

                        {/* CALCULATION PREVIEW */}
                        {productionQty && !isNaN(productionQty) && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-zinc-800 p-2 rounded">
                                    <span className="block text-zinc-500">Total a Producir</span>
                                    <span className="block text-white font-bold text-lg">
                                        {(parseFloat(productionQty) * (productionItem.yieldQuantity || 1)).toFixed(0)} {productionItem.yieldUnit}
                                    </span>
                                </div>
                                <div className="bg-zinc-800 p-2 rounded">
                                    <span className="block text-zinc-500">Nuevo Stock Estimado</span>
                                    <span className="block text-emerald-400 font-bold text-lg">
                                        {(parseFloat(productionItem.stockQuantity || 0) + (parseFloat(productionQty) * (productionItem.yieldQuantity || 1))).toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setIsProductionModalOpen(false)}
                                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitProduction}
                                disabled={!productionQty}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                <ChefHat size={16} /> Confirmar Producción
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EXCLUSIVE: ITEM PASSPORT (VIEW) */}
            {viewingItem && (
                <ItemPassport
                    item={viewingItem}
                    onClose={() => setViewingItem(null)}
                    onEdit={() => { setViewingItem(null); handleEdit(viewingItem); }}
                />
            )}

        </div>
    );
}

// --- SUB-COMPONENTS --- //

function ItemPassport({ item, onClose, onEdit }) {
    const isProduct = item.type === 'PRODUCT';
    const [history, setHistory] = useState([]);
    const [logs, setLogs] = useState([]);

    // Fetch fully enriched data (History, Logs, etc)
    useEffect(() => {
        if (isProduct) {
            api.get(`/products/${item.id}`)
                .then(res => {
                    // API returns the object directly for /products/:id
                    const data = res.data || res;
                    if (data.costHistory) setHistory(data.costHistory);
                })
                .catch(console.error);
        } else {
            api.get(`/supply-items/${item.id}`)
                .then(res => {
                    const data = res.data;
                    if (data.priceHistory) setHistory(data.priceHistory);
                    if (data.inventoryLogs) setLogs(data.inventoryLogs);
                })
                .catch(console.error);
        }
    }, [item, isProduct]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-start bg-zinc-950/50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {isProduct ? <LayoutDashboard size={18} className="text-emerald-500" /> : <Package size={18} className="text-blue-500" />}
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{isProduct ? 'Menu Product' : 'Supply Item'}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">{item.name}</h2>
                        <p className="text-zinc-400 text-sm flex items-center gap-2 font-mono">
                            SKU: {item.sku || 'N/A'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onEdit}
                            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold border border-zinc-700"
                        >
                            Edit
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* 1. FINANCIAL HEALTH */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                            <p className="text-zinc-500 text-xs font-bold uppercase">{isProduct ? 'Precio Venta' : 'Último Costo'}</p>
                            <p className="text-xl font-bold text-white">
                                {isProduct ? `$${item.price?.toFixed(2)}` : `$${item.currentCost?.toFixed(2)}`}
                            </p>
                        </div>
                        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                            <p className="text-zinc-500 text-xs font-bold uppercase">{isProduct ? 'Costo Fijo (Manual)' : 'Costo Promedio'}</p>
                            <p className="text-xl font-bold text-zinc-300">
                                {isProduct ? `$${(item.cost || 0).toFixed(2)}` : `$${(item.averageCost || 0).toFixed(2)}`}
                            </p>
                        </div>
                        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                            <p className="text-zinc-500 text-xs font-bold uppercase">{isProduct ? 'Margen Fijo' : 'Valor en Stock'}</p>
                            {isProduct ? (
                                <p className={`text-xl font-bold ${((item.price - item.cost) / item.price) >= 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {item.price > 0 ? (((item.price - item.cost) / item.price) * 100).toFixed(0) : 0}%
                                </p>
                            ) : (
                                <p className="text-xl font-bold text-blue-400">
                                    ${((item.stockQuantity || 0) * (item.averageCost || 0)).toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 2. ANAYTICS / HISTORY */}
                    {isProduct ? (
                        <div className="space-y-4">
                            {/* RECIPE BREAKDOWN */}
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
                                    <ChefHat size={18} className="text-amber-500" /> Recipe Cost Breakdown
                                </h3>

                                {item.recipes && item.recipes.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="border border-zinc-700 rounded-xl overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-zinc-800 text-zinc-400">
                                                    <tr>
                                                        <th className="p-3 font-medium">Ingredient</th>
                                                        <th className="p-3 font-medium">Qty</th>
                                                        <th className="p-3 font-medium">Unit Cost</th>
                                                        <th className="p-3 font-medium text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800">
                                                    {item.recipes.map(r => {
                                                        const si = r.supplyItem;
                                                        const factor = si?.stockCorrectionFactor || 1;
                                                        const yld = si?.yieldPercentage || 1;
                                                        const wacCost = (si?.averageCost || si?.currentCost || 0) / (factor * yld);
                                                        const liveCost = (si?.currentCost || 0) / (factor * yld);
                                                        const lineWac = r.quantity * wacCost;
                                                        const lineLive = r.quantity * liveCost;
                                                        return (
                                                            <tr key={r.id} className="hover:bg-white/5">
                                                                <td className="p-3 text-white">{si?.name || 'Unknown'}</td>
                                                                <td className="p-3 text-zinc-400">{r.quantity} {r.unit}</td>
                                                                <td className="p-3">
                                                                    <div className="text-zinc-300 font-mono text-xs">${wacCost.toFixed(4)}<span className="text-zinc-600 ml-1">/{r.unit}</span></div>
                                                                    {si?.averageCost > 0 && Math.abs(wacCost - liveCost) > 0.0001 && (
                                                                        <div className="text-zinc-500 font-mono text-xs">live: ${liveCost.toFixed(4)}</div>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    <div className="font-medium text-zinc-200">${lineWac.toFixed(4)}</div>
                                                                    {si?.averageCost > 0 && Math.abs(lineWac - lineLive) > 0.0001 && (
                                                                        <div className="text-xs text-zinc-500">live: ${lineLive.toFixed(4)}</div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* TOTALS */}
                                                    <tr className="bg-zinc-800/50 font-bold border-t border-zinc-700">
                                                        <td colSpan={2} className="p-3 text-right text-zinc-400 uppercase text-xs tracking-wider">Costo WAC (Promedio)</td>
                                                        <td colSpan={2} className="p-3 text-right text-emerald-400 text-lg">
                                                            ${item.recipes.reduce((acc, r) => {
                                                                const si = r.supplyItem;
                                                                const factor = si?.stockCorrectionFactor || 1;
                                                                const yld = si?.yieldPercentage || 1;
                                                                return acc + r.quantity * ((si?.averageCost || si?.currentCost || 0) / (factor * yld));
                                                            }, 0).toFixed(4)}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-zinc-800/30 border-t border-zinc-700/50">
                                                        <td colSpan={2} className="p-2 text-right text-zinc-500 uppercase text-xs tracking-wider">Costo Vivo (Último Precio)</td>
                                                        <td colSpan={2} className="p-2 text-right text-blue-400 font-mono text-sm">
                                                            ${item.recipes.reduce((acc, r) => {
                                                                const si = r.supplyItem;
                                                                const factor = si?.stockCorrectionFactor || 1;
                                                                const yld = si?.yieldPercentage || 1;
                                                                return acc + r.quantity * ((si?.currentCost || 0) / (factor * yld));
                                                            }, 0).toFixed(4)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex gap-2 text-xs text-zinc-500 bg-zinc-800/30 p-2 rounded-lg">
                                            <Info size={14} />
                                            <p><span className="text-emerald-400 font-bold">Costo WAC</span> usa el costo promedio ponderado (precio real pagado en compras). <span className="text-blue-400 font-bold">Costo Vivo</span> usa el último precio registrado. Ambos aplican el factor de conversión por unidad.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 bg-zinc-800/30 border border-dashed border-zinc-700 rounded-xl text-center text-zinc-500">
                                        No recipe ingredients linked yet.
                                    </div>
                                )}
                            </div>

                            {/* SALES ANALYTICS PLACEHOLDER */}
                            <div className="opacity-50">
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                                    <TrendingUp size={18} className="text-emerald-500" /> Sales Analytics
                                </h3>
                                <div className="p-4 bg-zinc-800/30 border border-dashed border-zinc-700 rounded-xl flex items-center gap-3">
                                    <div className="h-8 w-8 bg-zinc-800 rounded-full flex items-center justify-center">
                                        <span className="animate-pulse w-2 h-2 bg-emerald-500 rounded-full"></span>
                                    </div>
                                    <div>
                                        <p className="text-zinc-400 text-sm font-medium">Waiting for POS Data...</p>
                                    </div>
                                </div>
                            </div>

                            {/* COST HISTORY (Shared View) */}
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
                                    <TrendingUp size={18} className="text-emerald-500" /> Cost History
                                </h3>
                                {history.length > 0 ? (
                                    <div className="border border-zinc-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
                                                <tr>
                                                    <th className="p-3 font-medium">Date</th>
                                                    <th className="p-3 font-medium text-right">Old</th>
                                                    <th className="p-3 font-medium text-right">New</th>
                                                    <th className="p-3 font-medium text-right">Change</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800">
                                                {history.map(h => (
                                                    <tr key={h.id} className="hover:bg-white/5">
                                                        <td className="p-3 text-zinc-300">{new Date(h.changeDate).toLocaleDateString()}</td>
                                                        <td className="p-3 text-right text-zinc-500">${h.oldCost.toFixed(2)}</td>
                                                        <td className="p-3 text-right text-white font-bold">${h.newCost.toFixed(2)}</td>
                                                        <td className={`p-3 text-right font-medium ${h.newCost > h.oldCost ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {h.newCost > h.oldCost ? '↑' : '↓'} {h.oldCost > 0 ? (((h.newCost - h.oldCost) / h.oldCost) * 100).toFixed(1) : 0}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-zinc-500 italic text-sm border-l-2 border-zinc-700 pl-4 py-2">
                                        No cost changes recorded since history tracking began.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FileText size={18} className="text-blue-500" /> Purchase History
                            </h3>
                            {history.length > 0 ? (
                                <div className="border border-zinc-700 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-zinc-800 text-zinc-400">
                                            <tr>
                                                <th className="p-3 font-medium">Date</th>
                                                <th className="p-3 font-medium">Old Cost</th>
                                                <th className="p-3 font-medium">New Cost</th>
                                                <th className="p-3 font-medium">Change</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800">
                                            {history.map(h => (
                                                <tr key={h.id} className="hover:bg-white/5">
                                                    <td className="p-3 text-zinc-300">{new Date(h.changeDate).toLocaleDateString()}</td>
                                                    <td className="p-3 text-zinc-500">${h.oldCost.toFixed(2)}</td>
                                                    <td className="p-3 text-white font-bold">${h.newCost.toFixed(2)}</td>
                                                    <td className={`p-3 font-medium ${h.newCost > h.oldCost ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {h.newCost > h.oldCost ? '↑' : '↓'} {(((h.newCost - h.oldCost) / h.oldCost) * 100).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic text-sm">No price changes recorded yet.</p>
                            )}
                        </div>
                    )}

                    {/* 3. STOCK AUDIT / SHRINKAGE LOG */}
                    {!isProduct && (
                        <div className="space-y-3 pt-4 border-t border-zinc-800">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <TrendingUp size={18} className="text-purple-500" /> Stock Audit & Shrinkage
                            </h3>
                            {logs.length > 0 ? (
                                <div className="border border-zinc-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
                                            <tr>
                                                <th className="p-3 font-medium">Date</th>
                                                <th className="p-3 font-medium">Reason</th>
                                                <th className="p-3 font-medium text-right">Old</th>
                                                <th className="p-3 font-medium text-right">New</th>
                                                <th className="p-3 font-medium text-right">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800">
                                            {logs.map(l => (
                                                <tr key={l.id} className="hover:bg-white/5">
                                                    <td className="p-3 text-zinc-300">{new Date(l.createdAt).toLocaleString()}</td>
                                                    <td className="p-3 text-zinc-400 uppercase text-xs font-bold">{l.reason}</td>
                                                    <td className="p-3 text-right text-zinc-500">{l.previousStock}</td>
                                                    <td className="p-3 text-right text-white font-bold">{l.newStock}</td>
                                                    <td className={`p-3 text-right font-bold ${l.changeAmount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        <div className="flex flex-col items-end">
                                                            <span>{l.changeAmount > 0 ? '+' : ''}{l.changeAmount.toFixed(4)}</span>
                                                            {l.previousStock !== 0 && (
                                                                <span className="text-[10px] opacity-80">
                                                                    {Math.abs(l.changeAmount / l.previousStock * 100).toFixed(1)}% {l.changeAmount < 0 ? 'Merma' : 'Gain'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-zinc-500 italic text-sm">No stock adjustments recorded.</p>
                            )}
                        </div>
                    )}

                    {/* 4. METADATA */}
                    <div className="pt-4 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
                        <span>ID: {item.id}</span>
                        <span>Tenant: {item.tenantId || 'Enigma HQ'}</span>
                    </div>

                </div>
            </div>
        </div >
    );
}
