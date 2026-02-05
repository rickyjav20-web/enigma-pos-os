import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, ArrowLeft, Package, Calendar, DollarSign, TrendingUp, TrendingDown, ShoppingCart, Clock, BarChart3, Phone, Mail, MapPin, Edit2, X, Save } from 'lucide-react';
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

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [supplierRes, analyticsRes] = await Promise.all([
                api.get(`/suppliers/${id}`),
                api.get(`/suppliers/${id}/analytics`)
            ]);
            setSupplier(supplierRes.data);
            setAnalytics(analyticsRes.data);
            setEditForm(supplierRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
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
        </div>
    );
}
