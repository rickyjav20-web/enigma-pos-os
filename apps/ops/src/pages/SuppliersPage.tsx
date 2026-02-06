import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, Phone, Mail, ChevronRight, MapPin, X, ShoppingCart } from 'lucide-react';

const API_URL = 'https://enigma-pos-os-production.up.railway.app/api/v1';
const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

interface Supplier {
    id: string;
    name: string;
    category?: string;
    phone?: string;
    email?: string;
    address?: string;
}

const SUPPLIER_CATEGORIES = ['Alimentos', 'Bebidas', 'Limpieza', 'Empaques', 'Servicios', 'Otros'];

export default function SuppliersPage() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);

    const [newSupplier, setNewSupplier] = useState({
        name: '',
        category: 'Alimentos',
        phone: '',
        email: '',
        address: ''
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            const res = await fetch(`${API_URL}/suppliers`, {
                headers: TENANT_HEADER
            });
            const data = await res.json();
            setSuppliers(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const createSupplier = async () => {
        if (!newSupplier.name.trim()) return;

        try {
            const res = await fetch(`${API_URL}/suppliers`, {
                method: 'POST',
                headers: TENANT_HEADER,
                body: JSON.stringify(newSupplier)
            });

            if (res.ok) {
                const created = await res.json();
                setSuppliers([created, ...suppliers]);
                setShowModal(false);
                setNewSupplier({ name: '', category: 'Alimentos', phone: '', email: '', address: '' });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startPurchaseWithSupplier = (supplier: Supplier) => {
        setSelectedSupplier(null);
        navigate(`/purchases?supplierId=${supplier.id}`);
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-enigma-black p-4 pb-24">
            <header className="mb-6">
                <h1 className="text-2xl font-bold">Proveedores</h1>
                <p className="text-sm text-white/40">Directorio de proveedores</p>
            </header>

            <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar proveedor..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-enigma-gray/50 rounded-xl border border-white/10 
                            text-white placeholder-white/30 focus:border-enigma-purple focus:outline-none"
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-12 h-12 bg-enigma-green rounded-xl flex items-center justify-center
                        hover:bg-enigma-green/80 transition-all active:scale-95"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
                <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 
                    border border-emerald-500/20 rounded-xl">
                    <p className="text-lg font-bold text-emerald-400">{suppliers.length}</p>
                    <p className="text-[10px] text-white/50">Proveedores</p>
                </div>
            </div>

            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-8 text-white/40">Cargando...</div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                        {searchQuery ? 'Sin resultados' : 'No hay proveedores'}
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => (
                        <div
                            key={supplier.id}
                            onClick={() => setSelectedSupplier(supplier)}
                            className="flex items-center gap-4 p-4 bg-enigma-gray/30 rounded-xl 
                                border border-white/5 hover:border-enigma-green/30 transition-all cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-xl bg-enigma-green/10 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-enigma-green" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{supplier.name}</p>
                                <p className="text-sm text-white/40">{supplier.category || 'Sin categoría'}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20" />
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-fade-in">
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Nuevo Proveedor</h2>
                            <button onClick={() => setShowModal(false)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Nombre *</label>
                                <input
                                    type="text"
                                    value={newSupplier.name}
                                    onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                    placeholder="Ej: Distribuidora Central"
                                    className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                        text-white placeholder-white/30 focus:border-enigma-green focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Categoría</label>
                                <select
                                    value={newSupplier.category}
                                    onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })}
                                    className="w-full px-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                        text-white focus:border-enigma-green focus:outline-none"
                                >
                                    {SUPPLIER_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Teléfono</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="tel"
                                        value={newSupplier.phone}
                                        onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                        placeholder="+58 412 123 4567"
                                        className="w-full pl-10 pr-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white placeholder-white/30 focus:border-enigma-green focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="email"
                                        value={newSupplier.email}
                                        onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                        placeholder="contacto@empresa.com"
                                        className="w-full pl-10 pr-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white placeholder-white/30 focus:border-enigma-green focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-white/50 mb-1 block">Dirección</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                                    <textarea
                                        value={newSupplier.address}
                                        onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                                        placeholder="Calle, Ciudad..."
                                        rows={2}
                                        className="w-full pl-10 pr-4 py-3 bg-enigma-black/50 rounded-xl border border-white/10 
                                            text-white placeholder-white/30 focus:border-enigma-green focus:outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={createSupplier}
                                disabled={!newSupplier.name.trim()}
                                className="w-full py-4 bg-enigma-green rounded-xl font-bold text-lg
                                    hover:bg-enigma-green/80 disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-all active:scale-[0.98]"
                            >
                                Crear Proveedor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedSupplier && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end animate-fade-in"
                    onClick={() => setSelectedSupplier(null)}>
                    <div className="w-full bg-enigma-gray rounded-t-3xl p-6 animate-slide-up"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">{selectedSupplier.name}</h2>
                                <p className="text-sm text-white/40">{selectedSupplier.category}</p>
                            </div>
                            <button onClick={() => setSelectedSupplier(null)} className="p-2">
                                <X className="w-6 h-6 text-white/50" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {selectedSupplier.phone && (
                                <a href={`tel:${selectedSupplier.phone}`}
                                    className="flex items-center gap-3 p-4 bg-enigma-black/50 rounded-xl">
                                    <Phone className="w-5 h-5 text-enigma-green" />
                                    <span>{selectedSupplier.phone}</span>
                                </a>
                            )}
                            {selectedSupplier.email && (
                                <a href={`mailto:${selectedSupplier.email}`}
                                    className="flex items-center gap-3 p-4 bg-enigma-black/50 rounded-xl">
                                    <Mail className="w-5 h-5 text-blue-400" />
                                    <span>{selectedSupplier.email}</span>
                                </a>
                            )}
                            {selectedSupplier.address && (
                                <div className="flex items-start gap-3 p-4 bg-enigma-black/50 rounded-xl">
                                    <MapPin className="w-5 h-5 text-amber-400 mt-0.5" />
                                    <span>{selectedSupplier.address}</span>
                                </div>
                            )}

                            <button
                                onClick={() => startPurchaseWithSupplier(selectedSupplier)}
                                className="w-full py-4 bg-enigma-purple rounded-xl font-bold
                                    flex items-center justify-center gap-2 hover:bg-enigma-purple/80 transition-all active:scale-[0.98]">
                                <ShoppingCart className="w-5 h-5" />
                                Nueva Compra con este Proveedor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
