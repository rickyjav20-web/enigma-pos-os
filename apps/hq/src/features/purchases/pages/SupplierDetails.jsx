import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, ArrowLeft, Package, Calendar, DollarSign, TrendingUp, TrendingDown, ShoppingCart, Clock, BarChart3, Phone, Mail, MapPin, Edit2, X, Save, Plus, Search, Trash2, Loader2, List, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function SupplierDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [supplier, setSupplier] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);

    // Catalog state
    const [catalog, setCatalog] = useState([]);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [catalogSaving, setCatalogSaving] = useState(false);
    const [supplyItems, setSupplyItems] = useState([]);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [catalogPrice, setCatalogPrice] = useState('');
    const [catalogNotes, setCatalogNotes] = useState('');

    // Bulk Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState([]);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [supplierRes, analyticsRes, catalogRes] = await Promise.all([
                api.get(`/suppliers/${id}`),
                api.get(`/suppliers/${id}/analytics`),
                api.get(`/suppliers/${id}/catalog`)
            ]);
            setSupplier(supplierRes.data);
            setAnalytics(analyticsRes.data);
            setCatalog(catalogRes.data || []);
            setEditForm(supplierRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadCatalog = async () => {
        try {
            const res = await api.get(`/suppliers/${id}/catalog`);
            setCatalog(res.data || []);
        } catch (e) { console.error(e); }
    };

    const openCatalogModal = async () => {
        setSelectedItem(null);
        setCatalogPrice('');
        setCatalogNotes('');
        setCatalogSearch('');
        setShowCatalogModal(true);
        // Fetch supply items for search
        try {
            const res = await api.get('/supply-items?limit=500');
            setSupplyItems(res.data?.data || []);
        } catch (e) { console.error(e); }
    };

    const handleAddCatalogItem = async () => {
        if (!selectedItem || !catalogPrice) return;
        setCatalogSaving(true);
        try {
            await api.post(`/suppliers/${id}/catalog`, {
                supplyItemId: selectedItem.id,
                unitCost: parseFloat(catalogPrice),
                notes: catalogNotes || null
            });
            setShowCatalogModal(false);
            loadCatalog();
        } catch (e) { console.error(e); }
        finally { setCatalogSaving(false); }
    };

    const handleDeleteCatalogItem = async (priceId) => {
        if (!confirm('¿Eliminar este item del catálogo?')) return;
        try {
            await api.delete(`/suppliers/${id}/catalog/${priceId}`);
            loadCatalog();
        } catch (e) { console.error(e); }
    };

    // --- BULK IMPORT LOGIC ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            processCSV(text);
        };
        reader.readAsText(file);
    };

    const processCSV = async (text) => {
        // Fetch items if not already loaded
        let items = supplyItems;
        if (items.length === 0) {
            try {
                const res = await api.get('/supply-items?limit=1000');
                items = res.data?.data || [];
                setSupplyItems(items);
            } catch (e) { console.error(e); return; }
        }

        const lines = text.split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

        // Identify columns
        const colMap = {
            sku: headers.findIndex(h => h.includes('ref') || h.includes('sku') || h.includes('handle')),
            name: headers.findIndex(h => h.includes('nombre') || h.includes('name') || h.includes('item')),
            cost: headers.findIndex(h => h.includes('cost') || h.includes('precio') || h.includes('price'))
        };

        if (colMap.cost === -1) {
            alert('No se encontró columna de Costo/Precio en el CSV');
            return;
        }

        const preview = [];
        // Regex to split by comma but ignore commas inside quotes
        const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(splitRegex).map(c => c.trim().replace(/^"|"$/g, ''));

            const rawSku = colMap.sku > -1 ? cols[colMap.sku] : '';
            const rawName = colMap.name > -1 ? cols[colMap.name] : '';
            const rawCost = parseFloat(cols[colMap.cost]);

            if (isNaN(rawCost) || rawCost <= 0) continue;

            // Try to match Supply Item
            let match = null;
            let matchType = null;

            // 1. Exact SKU match
            if (rawSku) {
                match = items.find(item => item.sku === rawSku);
                if (match) matchType = 'SKU Exacto';
            }

            // 2. Name match (if no SKU match)
            if (!match && rawName) {
                match = items.find(item => item.name.toLowerCase() === rawName.toLowerCase());
                if (match) matchType = 'Nombre Exacto';
            }

            // 3. Fuzzy Name match
            if (!match && rawName) {
                match = items.find(item => item.name.toLowerCase().includes(rawName.toLowerCase()) || rawName.toLowerCase().includes(item.name.toLowerCase()));
                if (match) matchType = 'Nombre Similar';
            }

            if (match) {
                preview.push({
                    supplyItemId: match.id,
                    supplyItemName: match.name,
                    supplyItemSku: match.sku,
                    oldCost: match.currentCost,
                    newCost: rawCost,
                    matchType
                });
            }
        }

        setImportPreview(preview);
        setShowImportModal(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmImport = async () => {
        if (importPreview.length === 0) return;
        setImporting(true);
        try {
            const payload = importPreview.map(p => ({
                supplyItemId: p.supplyItemId,
                unitCost: p.newCost,
                notes: 'Importado via CSV'
            }));
            await api.post(`/suppliers/${id}/catalog/bulk`, { items: payload });
            setShowImportModal(false);
            loadCatalog();
            alert(`${payload.length} precios importados correctamente.`);
        } catch (e) {
            console.error(e);
            alert('Error al importar: ' + e.message);
        } finally {
            setImporting(false);
        }
    };


    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.patch(`/suppliers/${id}`, editForm);
            setSupplier(res.data);
            setShowEditModal(false);
        } catch (error) {
            console.error('Failed to update supplier:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-96">
                <div className="animate-pulse text-white/50">Cargando datos del proveedor...</div>
            </div>
        );
    }
    if (!supplier) return <div className="p-8 text-white">Supplier not found</div>;

    const metrics = analytics?.metrics || {};
    const daysAgo = metrics.lastPurchaseDate
        ? Math.floor((Date.now() - new Date(metrics.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="space-y-8 animate-fade-in p-6">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Proveedores
            </button>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center border border-emerald-500/30">
                    <Truck className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold text-white">{supplier.name}</h1>
                        <button
                            onClick={() => setShowEditModal(true)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <Edit2 className="w-4 h-4 text-white/50" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs text-emerald-400">
                            {supplier.category || 'General'}
                        </span>
                        {metrics.totalPurchases > 0 && (
                            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-xs text-purple-400">
                                {metrics.totalPurchases} órdenes
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm text-gray-400">
                        {supplier.phone && (
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{supplier.phone}</span>
                            </div>
                        )}
                        {supplier.email && (
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>{supplier.email}</span>
                            </div>
                        )}
                        {supplier.address && (
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{supplier.address}</span>
                            </div>
                        )}
                    </div>
                    {supplier.notes && (
                        <p className="mt-3 text-sm text-white/40 italic">{supplier.notes}</p>
                    )}
                </div>
                <button
                    onClick={() => navigate('/purchases/new')}
                    className="px-6 py-3 bg-enigma-purple rounded-xl font-medium flex items-center gap-2 hover:bg-enigma-purple/80 transition-all"
                >
                    <ShoppingCart className="w-5 h-5" />
                    Nueva Compra
                </button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-sm text-white/50">Total Compras</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{metrics.totalPurchases || 0}</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                        <span className="text-sm text-white/50">Gasto Total</span>
                    </div>
                    <p className="text-3xl font-bold text-enigma-green">${metrics.totalSpend?.toFixed(2) || '0.00'}</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-sm text-white/50">Valor Promedio</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">${metrics.avgOrderValue?.toFixed(2) || '0.00'}</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-sm text-white/50">Última Compra</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {daysAgo !== null ? (daysAgo === 0 ? 'Hoy' : `${daysAgo}d`) : 'N/A'}
                    </p>
                </div>
            </div>

            {/* === CATÁLOGO DE PRECIOS === */}
            <div className="glass-panel p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <List className="w-5 h-5 text-enigma-green" />
                        Catálogo de Precios
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".csv"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Importar CSV
                        </button>
                        <button
                            onClick={openCatalogModal}
                            className="px-4 py-2 bg-enigma-green/20 border border-enigma-green text-enigma-green rounded-xl hover:bg-enigma-green/30 transition-all flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar Item
                        </button>
                    </div>
                </div>

                {catalog.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-white/40 text-xs border-b border-white/5">
                                    <th className="pb-3">Item</th>
                                    <th className="pb-3">SKU</th>
                                    <th className="pb-3">Categoría</th>
                                    <th className="pb-3">Precio Catálogo</th>
                                    <th className="pb-3">Precio Actual</th>
                                    <th className="pb-3">Notas</th>
                                    <th className="pb-3 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {catalog.map((entry) => {
                                    const diff = entry.supplyItem?.currentCost > 0
                                        ? ((entry.unitCost - entry.supplyItem.currentCost) / entry.supplyItem.currentCost * 100).toFixed(1)
                                        : null;
                                    return (
                                        <tr key={entry.id} className="text-sm hover:bg-white/5 transition-colors">
                                            <td className="py-3 text-white font-medium">{entry.supplyItem?.name || 'Unknown'}</td>
                                            <td className="py-3 text-white/40 font-mono text-xs">{entry.supplyItem?.sku || '-'}</td>
                                            <td className="py-3 text-white/40">{entry.supplyItem?.category || '-'}</td>
                                            <td className="py-3 text-enigma-green font-mono font-bold">${entry.unitCost.toFixed(2)}</td>
                                            <td className="py-3 text-white/60 font-mono">
                                                ${entry.supplyItem?.currentCost?.toFixed(2) || '0.00'}
                                                {diff && (
                                                    <span className={`ml-2 text-xs ${parseFloat(diff) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {parseFloat(diff) > 0 ? '+' : ''}{diff}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-white/30 text-xs italic">{entry.notes || '-'}</td>
                                            <td className="py-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteCatalogItem(entry.id); }}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 border border-white/5 rounded-2xl text-center bg-black/20">
                        <DollarSign className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-gray-500">No hay items en el catálogo de este proveedor.</p>
                        <p className="text-gray-600 text-sm mt-1">Agrega los items que este proveedor ofrece con sus precios.</p>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Items */}
                <div className="glass-panel p-6 rounded-3xl">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-400" />
                        Top Items Comprados
                    </h3>
                    {analytics?.topItems?.length > 0 ? (
                        <div className="space-y-3">
                            {analytics.topItems.map((item, idx) => {
                                const maxSpent = analytics.topItems[0]?.totalSpent || 1;
                                const percent = (item.totalSpent / maxSpent) * 100;
                                return (
                                    <div key={item.id} className="relative">
                                        <div className="flex items-center justify-between relative z-10 p-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-bold text-white/20">#{idx + 1}</span>
                                                <span className="text-white font-medium">{item.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-enigma-green font-mono">${item.totalSpent.toFixed(2)}</p>
                                                <p className="text-xs text-white/40">{item.count}x comprado</p>
                                            </div>
                                        </div>
                                        <div
                                            className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent rounded-xl"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 border border-white/5 rounded-2xl text-center text-gray-500 bg-black/20">
                            No hay historial de compras aún.
                        </div>
                    )}
                </div>

                {/* Recent Orders */}
                <div className="glass-panel p-6 rounded-3xl">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-enigma-green" />
                        Órdenes Recientes
                    </h3>
                    {analytics?.recentOrders?.length > 0 ? (
                        <div className="space-y-3">
                            {analytics.recentOrders.map(order => (
                                <div key={order.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-enigma-purple/30 transition-all">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-white font-mono">{new Date(order.date).toLocaleDateString('es-ES')}</span>
                                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                            confirmado
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs text-gray-500">{order.itemCount} items</span>
                                        <span className="text-lg font-bold text-white">${order.totalAmount?.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic p-4">No hay órdenes registradas.</p>
                    )}
                </div>

                {/* Price History */}
                {analytics?.priceHistory?.length > 0 && (
                    <div className="glass-panel p-6 rounded-3xl lg:col-span-2">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-400" />
                            Historial de Precios
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-white/40 text-xs border-b border-white/5">
                                        <th className="pb-3">Item</th>
                                        <th className="pb-3">Anterior</th>
                                        <th className="pb-3">Nuevo</th>
                                        <th className="pb-3">Cambio</th>
                                        <th className="pb-3">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {analytics.priceHistory.slice(0, 10).map((h, idx) => (
                                        <tr key={idx} className="text-sm">
                                            <td className="py-3 text-white">{h.itemName}</td>
                                            <td className="py-3 text-white/60 font-mono">${h.oldCost.toFixed(2)}</td>
                                            <td className="py-3 text-white font-mono">${h.newCost.toFixed(2)}</td>
                                            <td className="py-3">
                                                <span className={`flex items-center gap-1 ${h.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {h.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {h.change > 0 ? '+' : ''}{h.changePercent}%
                                                </span>
                                            </td>
                                            <td className="py-3 text-white/40 font-mono text-xs">
                                                {new Date(h.date).toLocaleDateString('es-ES')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Category Breakdown */}
                {analytics?.categoryBreakdown?.length > 0 && (
                    <div className="glass-panel p-6 rounded-3xl lg:col-span-2">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-pink-400" />
                            Desglose por Categoría
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {analytics.categoryBreakdown.map(cat => {
                                const total = analytics.categoryBreakdown.reduce((s, c) => s + c.amount, 0);
                                const percent = total > 0 ? ((cat.amount / total) * 100).toFixed(0) : 0;
                                return (
                                    <div key={cat.category} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-sm text-white/50 mb-1">{cat.category}</p>
                                        <p className="text-2xl font-bold text-white">{percent}%</p>
                                        <p className="text-xs text-enigma-green font-mono">${cat.amount.toFixed(2)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-enigma-gray rounded-3xl w-full max-w-lg border border-white/10 animate-fade-in">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">Editar Proveedor</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Nombre</label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Categoría</label>
                                <input
                                    type="text"
                                    value={editForm.category || ''}
                                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple"
                                    placeholder="Ej: Alimentos, Bebidas, General"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-white/50 block mb-2">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editForm.phone || ''}
                                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple"
                                        placeholder="+58 412 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-white/50 block mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email || ''}
                                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple"
                                        placeholder="proveedor@ejemplo.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Dirección</label>
                                <input
                                    type="text"
                                    value={editForm.address || ''}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple"
                                    placeholder="Calle, Ciudad"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Notas</label>
                                <textarea
                                    value={editForm.notes || ''}
                                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                    rows={3}
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-purple resize-none"
                                    placeholder="Notas sobre este proveedor..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-white/5">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl bg-enigma-green font-medium flex items-center justify-center gap-2 hover:bg-enigma-green/80 transition-all disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Catalog Item Modal */}
            {showCatalogModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-enigma-gray rounded-3xl w-full max-w-lg border border-white/10 animate-fade-in">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">Agregar Item al Catálogo</h2>
                            <button onClick={() => setShowCatalogModal(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Item Search */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Buscar Item *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={catalogSearch}
                                        onChange={e => { setCatalogSearch(e.target.value); setSelectedItem(null); }}
                                        className="w-full p-3 pl-10 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-green"
                                        placeholder="Buscar por nombre..."
                                    />
                                </div>
                                {/* Search Results */}
                                {catalogSearch.length > 1 && !selectedItem && (
                                    <div className="mt-2 max-h-40 overflow-y-auto border border-white/10 rounded-xl bg-black/40">
                                        {supplyItems
                                            .filter(item => {
                                                const existingIds = catalog.map(c => c.supplyItemId || c.supplyItem?.id);
                                                return item.name.toLowerCase().includes(catalogSearch.toLowerCase()) && !existingIds.includes(item.id);
                                            })
                                            .slice(0, 10)
                                            .map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { setSelectedItem(item); setCatalogSearch(item.name); }}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 text-white text-sm flex justify-between items-center border-b border-white/5 last:border-0"
                                                >
                                                    <span>{item.name}</span>
                                                    <span className="text-white/30 text-xs font-mono">{item.sku || ''}</span>
                                                </button>
                                            ))
                                        }
                                        {supplyItems.filter(i => i.name.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0 && (
                                            <p className="p-3 text-gray-500 text-sm">No items encontrados</p>
                                        )}
                                    </div>
                                )}
                                {selectedItem && (
                                    <div className="mt-2 text-xs text-enigma-green flex items-center gap-1">
                                        ✅ {selectedItem.name} seleccionado
                                        <span className="text-white/30 ml-2">(Costo actual: ${selectedItem.currentCost?.toFixed(2) || '0.00'})</span>
                                    </div>
                                )}
                            </div>

                            {/* Price */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Precio de este Proveedor *</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={catalogPrice}
                                        onChange={e => setCatalogPrice(e.target.value)}
                                        className="w-full p-3 pl-10 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-green"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2">Notas (opcional)</label>
                                <input
                                    type="text"
                                    value={catalogNotes}
                                    onChange={e => setCatalogNotes(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-enigma-green"
                                    placeholder="Ej: Pedido mínimo 5kg"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-white/5">
                            <button
                                onClick={() => setShowCatalogModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddCatalogItem}
                                disabled={catalogSaving || !selectedItem || !catalogPrice}
                                className="flex-1 py-3 rounded-xl bg-enigma-green font-medium flex items-center justify-center gap-2 hover:bg-enigma-green/80 transition-all disabled:opacity-50"
                            >
                                {catalogSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {catalogSaving ? 'Guardando...' : 'Agregar al Catálogo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Preview Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-enigma-gray rounded-3xl w-full max-w-3xl border border-white/10 animate-fade-in flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5 text-enigma-green" />
                                    Confirmar Importación
                                </h2>
                                <p className="text-sm text-white/50 mt-1">Se encontraron {importPreview.length} items coincidentes.</p>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 rounded-lg hover:bg-white/5">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {importPreview.length > 0 ? (
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-white/30 text-xs border-b border-white/5">
                                            <th className="pb-3">Item (Sistema)</th>
                                            <th className="pb-3">SKU</th>
                                            <th className="pb-3">Match</th>
                                            <th className="pb-3 text-right">Costo Actual</th>
                                            <th className="pb-3 text-right">Nuevo Costo</th>
                                            <th className="pb-3 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {importPreview.map((item, idx) => (
                                            <tr key={idx} className="text-sm">
                                                <td className="py-3 text-white font-medium">{item.supplyItemName}</td>
                                                <td className="py-3 text-white/40 font-mono text-xs">{item.supplyItemSku || '-'}</td>
                                                <td className="py-3">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${item.matchType.includes('Exacto') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                                                        {item.matchType}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-white/50 text-right font-mono">${item.oldCost?.toFixed(2)}</td>
                                                <td className="py-3 text-enigma-green text-right font-mono font-bold">${item.newCost.toFixed(2)}</td>
                                                <td className="py-3 text-center">
                                                    <CheckCircle className="w-4 h-4 text-enigma-green mx-auto" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>No se encontraron coincidencias en el archivo CSV.</p>
                                    <p className="text-sm mt-2">Asegúrate de que las columnas tengan nombres como "SKU", "Nombre" y "Costo".</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 p-6 border-t border-white/5">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmImport}
                                disabled={importing || importPreview.length === 0}
                                className="flex-1 py-3 rounded-xl bg-enigma-green font-medium flex items-center justify-center gap-2 hover:bg-enigma-green/80 transition-all disabled:opacity-50"
                            >
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {importing ? 'Importando...' : `Importar ${importPreview.length} Items`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
