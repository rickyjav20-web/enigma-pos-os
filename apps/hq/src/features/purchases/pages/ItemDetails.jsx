import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, ArrowLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ItemDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadItem();
    }, [id]);

    const loadItem = async () => {
        try {
            const data = await api.get(`/supply-items/${id}`);
            setItem(data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;
    if (!item) return <div className="p-8 text-white">Item not found</div>;

    // Format History for Chart
    const chartData = item.priceHistory?.map(h => ({
        date: new Date(h.changeDate).toLocaleDateString(),
        price: h.newCost
    })).reverse() || [];

    // Add current cost as latest point if history exists
    if (chartData.length > 0 && item.currentCost !== undefined) {
        chartData.push({ date: 'Now', price: item.currentCost });
    }

    return (
        <div className="space-y-8 animate-fade-in p-6">
            <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </button>

            <div className="glass-panel p-8 rounded-3xl flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2">{item.name}</h1>
                    <div className="flex items-center gap-3">
                        <span className="bg-white/10 px-3 py-1 rounded-lg text-sm text-gray-300 font-mono">
                            SKU: {item.sku || 'N/A'}
                        </span>
                        <span className="text-gray-500 text-sm">Category: {item.category}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">Current Cost</p>
                    <p className="text-4xl font-mono text-enigma-green font-bold">
                        ${(item.currentCost || 0).toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl min-h-[400px]">
                    <h3 className="text-lg font-bold text-white mb-6">Price History</h3>
                    {chartData.length > 1 ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                        labelStyle={{ color: '#888' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={{ fill: '#10b981', r: 4 }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                            <p>Not enough history to chart.</p>
                            <p className="text-xs">History is tracked when prices change on confirmed orders.</p>
                        </div>
                    )}
                </div>

                {/* Details / Supplier */}
                <div className="glass-panel p-6 rounded-3xl space-y-6">
                    <div>
                        <h3 className="text-sm text-gray-400 mb-2">Preferred Supplier</h3>
                        {item.preferredSupplier ? (
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/10 transition-all" onClick={() => navigate(`/purchases/suppliers/${item.preferredSupplier.id}`)}>
                                <span className="text-white font-medium">{item.preferredSupplier.name}</span>
                                <ArrowLeft className="w-4 h-4 rotate-180 text-gray-500 group-hover:translate-x-1 transition-transform" />
                            </div>
                        ) : (
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 border-dashed text-gray-500 italic">
                                No specific preference
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
