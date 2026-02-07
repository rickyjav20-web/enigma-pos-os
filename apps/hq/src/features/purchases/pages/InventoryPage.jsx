
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Package, ChefHat, ShoppingCart,
    ArrowUpRight, ArrowDownRight, Search, Filter, Plus, FileDown, Upload, X,
    TrendingUp, FileText, Info
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
                quantity: parseFloat(productionQty),
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

    const filteredProducts = products.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSupplyItems = supplyItems.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const menuItems = filteredProducts;
    const kitchenItems = filteredSupplyItems.filter(i => i.isProduction && !products.some(p => p.sku && i.sku && p.sku === i.sku));
    const pantryItems = filteredSupplyItems.filter(i => !i.isProduction && !products.some(p => p.sku && i.sku && p.sku === i.sku));

    // Combine for Search (Ingredients can come from Pantry OR Kitchen)
    const allIngredients = [...supplyItems];

    // --- ACTIONS ---
    const handleOpenCreate = () => {
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
                            className="bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white w-64 focus:ring-1 focus:ring-emerald-500"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* SMART ACTION BUTTON */}
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-white/10"
                    >
                        <Plus size={16} /> {headerParams.btnText}
                    </button>
                </div>
            </div>

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
                                    {zone === 'MENU' ? 'Calc Cost' : zone === 'KITCHEN' ? 'Unit Cost' : 'Last Cost'}
                                </th>
                                {zone === 'PANTRY' && (
                                    <>
                                        <th className="p-4 font-medium border-b border-zinc-800">Stock</th>
                                        <th className="p-4 font-medium border-b border-zinc-800">Avg Cost</th>
                                    </>
                                )}
                                <th className="p-4 font-medium border-b border-zinc-800">
                                    {zone === 'MENU' ? 'Margin %' : zone === 'KITCHEN' ? 'POS Link' : 'Trend'}
                                </th>
                                <th className="p-4 font-medium border-b border-zinc-800 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-zinc-800">
                            {zone === 'MENU' && menuItems.map(item => {
                                const margin = item.price > 0 ? ((item.price - item.cost) / item.price) * 100 : 0;
                                const isLowMargin = margin < 30;
                                return (
                                    <tr key={item.id} className="hover:bg-zinc-800/50 group cursor-pointer" onClick={() => handleEdit(item)}>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{item.name}</div>
                                            <div className="text-xs text-zinc-500 bg-zinc-800/50 px-1 rounded inline-block">SKU: {item.id.slice(0, 6)}</div>
                                        </td>
                                        <td className="p-4 text-zinc-300">${item.price.toFixed(2)}</td>
                                        <td className="p-4 text-zinc-400">${item.cost.toFixed(2)}</td>
                                        <td className="p-4">
                                            <div className={`text-xs font-bold px-2 py-1 rounded w-fit ${isLowMargin ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                {margin.toFixed(1)}%
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
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {zone === 'KITCHEN' && kitchenItems.map(item => (
                                <tr key={item.id} className="hover:bg-zinc-800/50 group cursor-pointer" onClick={() => handleEdit(item)}>
                                    <td className="p-4 font-medium text-amber-100">{item.name}</td>
                                    <td className="p-4 text-zinc-400">{item.yieldQuantity} {item.yieldUnit}</td>
                                    <td className="p-4 text-zinc-300">
                                        ${item.currentCost.toFixed(2)} <span className="text-xs text-zinc-500">/ batch</span>
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
                                        <td className="p-4 text-zinc-200 font-bold">{item.stockQuantity || 0}</td>
                                        <td className="p-4 text-zinc-300">
                                            ${(item.currentCost || 0).toFixed(2)} <span className="text-xs text-zinc-500">last</span>
                                        </td>
                                        <td className="p-4 text-zinc-400">
                                            ${(item.averageCost || 0).toFixed(2)} <span className="text-xs text-zinc-500">avg</span>
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
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
                                One Batch = {productionItem.yieldQuantity} {productionItem.yieldUnit}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Quantity to Produce</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    autoFocus
                                    className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                    value={productionQty}
                                    onChange={e => setProductionQty(e.target.value)}
                                    placeholder="e.g. 10"
                                />
                                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-400 flex items-center">
                                    {productionItem.yieldUnit || 'und'}
                                </div>
                            </div>
                        </div>

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
                                <ChefHat size={16} /> Confirm
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

    // Fetch history if it's a supply item
    useEffect(() => {
        if (!isProduct) {
            api.get(`/supply-items/${item.id}`)
                .then(res => {
                    const data = res.data;
                    if (data.priceHistory) setHistory(data.priceHistory);
                    if (data.inventoryLogs) setLogs(data.inventoryLogs);
                })
                .catch(console.error);
        }
    }, [item]);

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
                                                        const currentUnitCost = r.supplyItem?.currentCost || 0;
                                                        const lineCost = r.quantity * currentUnitCost;
                                                        return (
                                                            <tr key={r.id} className="hover:bg-white/5">
                                                                <td className="p-3 text-white">{r.supplyItem?.name || 'Unknown'}</td>
                                                                <td className="p-3 text-zinc-400">{r.quantity} {r.unit}</td>
                                                                <td className="p-3 text-zinc-500">${currentUnitCost.toFixed(2)}</td>
                                                                <td className="p-3 text-right font-medium text-zinc-300">
                                                                    ${lineCost.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* LIVE COST TOTAL */}
                                                    <tr className="bg-zinc-800/50 font-bold border-t border-zinc-700">
                                                        <td colSpan={3} className="p-3 text-right text-zinc-400 uppercase text-xs tracking-wider pt-4">Live Cost Calculation</td>
                                                        <td className="p-3 text-right text-emerald-400 text-lg">
                                                            ${item.recipes.reduce((acc, r) => acc + (r.quantity * (r.supplyItem?.currentCost || 0)), 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex gap-2 text-xs text-zinc-500 bg-zinc-800/30 p-2 rounded-lg">
                                            <Info size={14} />
                                            <p>This "Live Cost" is calculated instantly from current ingredient prices.</p>
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
                                                        {l.changeAmount > 0 ? '+' : ''}{l.changeAmount.toFixed(4)}
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
