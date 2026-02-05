import React, { useEffect, useState } from 'react';
import { Plus, Search, Truck, Phone, Mail, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export default function SupplierDirectory() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            const res = await api.get('/suppliers');
            // API returns array directly, not wrapped in {data: [...]}
            setSuppliers(res.data || []);
        } catch (error) {
            console.error("Failed to load suppliers:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in p-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Suppliers</h1>
                    <p className="text-enigma-text-secondary">Manage your external partners and supply chain.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/purchases/new')}
                        className="px-4 py-2 bg-enigma-purple/20 border border-enigma-purple text-enigma-purple rounded-xl hover:bg-enigma-purple/30 transition-all flex items-center gap-2"
                    >
                        <Box className="w-4 h-4" />
                        Record Purchase
                    </button>
                    <button className="px-4 py-2 bg-enigma-green/20 border border-enigma-green text-enigma-green rounded-xl hover:bg-enigma-green/30 transition-all flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Supplier
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search suppliers..."
                        className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-enigma-purple/50 transition-all"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.map((supplier) => (
                    <div
                        key={supplier.id}
                        onClick={() => navigate(`/purchases/suppliers/${supplier.id}`)}
                        className="glass-card p-6 rounded-3xl group hover:border-enigma-purple/30 transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 rounded-full bg-enigma-purple/10 flex items-center justify-center border border-enigma-purple/20 group-hover:scale-110 transition-transform">
                                <Truck className="w-6 h-6 text-enigma-purple" />
                            </div>
                            <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-enigma-text-secondary border border-white/5">
                                {supplier.category || 'General'}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-glow-purple transition-all">
                            {supplier.name}
                        </h3>
                        <p className="text-sm text-enigma-text-muted mb-6 line-clamp-2">
                            {supplier.notes || "No notes available for this supplier."}
                        </p>

                        <div className="space-y-3 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Phone className="w-4 h-4 text-enigma-text-muted" />
                                <span>{supplier.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Mail className="w-4 h-4 text-enigma-text-muted" />
                                <span>{supplier.email || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State / Add New Card */}
                <div className="glass-panel p-6 rounded-3xl border-dashed border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-all cursor-pointer group h-full min-h-[250px]">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-enigma-green/10 transition-colors">
                        <Plus className="w-8 h-8 text-gray-500 group-hover:text-enigma-green" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Register New Supplier</h3>
                    <p className="text-sm text-enigma-text-secondary">Add a new partner to your supply chain</p>
                </div>
            </div>
        </div>
    );
}
