
import React, { useState, useEffect } from 'react';
import { api, CURRENT_TENANT_ID } from '@/lib/api';
import {
    LayoutDashboard, TrendingUp, AlertTriangle,
    DollarSign, Search, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

export default function MenuIntelligencePage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalValue: 0,
        avgMargin: 0,
        lowMarginCount: 0,
        missingRecipeCount: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/products');
            const data = res.data.data || [];

            // Calculate Stats
            let totalVal = 0;
            let totalMargin = 0;
            let lowMargin = 0;
            let noRecipe = 0;
            let countWithPrice = 0;

            const enriched = data.map(p => {
                const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;

                if (p.price > 0) {
                    totalMargin += margin;
                    countWithPrice++;
                }

                if (margin < 30 && p.price > 0) lowMargin++;
                if (!p.recipes || p.recipes.length === 0) noRecipe++;

                // Assuming some sales volume (Mock for now, or fetch from Analytics API)
                const volume = Math.floor(Math.random() * 100) + 10;

                return { ...p, margin, volume };
            });

            setStats({
                totalValue: enriched.length, // Just count for now
                avgMargin: countWithPrice > 0 ? totalMargin / countWithPrice : 0,
                lowMarginCount: lowMargin,
                missingRecipeCount: noRecipe
            });

            setProducts(enriched);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="h-screen bg-black text-white p-6 overflow-hidden flex flex-col">

            {/* HEADER */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-emerald-500" /> Menu Intelligence
                </h1>
                <p className="text-zinc-500 text-sm">Profitability Analysis & Engineering.</p>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Average Margin</p>
                    <p className={`text-3xl font-bold ${stats.avgMargin >= 70 ? 'text-emerald-400' : stats.avgMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                        {stats.avgMargin.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Low Margin Items (&lt;30%)</p>
                    <p className="text-3xl font-bold text-red-400">{stats.lowMarginCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Missing Recipes</p>
                    <p className="text-3xl font-bold text-zinc-400">{stats.missingRecipeCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Active Menu Items</p>
                    <p className="text-3xl font-bold text-white">{products.length}</p>
                </div>
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">

                {/* LEFT: PROFIT MATRIX (Stars, Dogs, Puzzles, Cows) */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <LayoutDashboard size={18} className="text-purple-500" /> Profit Matrix
                    </h3>
                    <div className="flex-1 w-full h-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" dataKey="volume" name="Volume" unit=" sales" stroke="#666" />
                                <YAxis type="number" dataKey="margin" name="Margin" unit="%" stroke="#666" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#18181b', borderColor: '#333' }} />
                                <Scatter name="Menu Items" data={products} fill="#8884d8">
                                    {products.map((entry, index) => (
                                        <cell key={`cell-${index}`} fill={entry.margin > 50 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-2 px-4">
                        <span>Low Vol / Low Margin (Dogs)</span>
                        <span>High Vol / High Margin (Stars)</span>
                    </div>
                </div>

                {/* RIGHT: DETAILED LIST */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Search size={18} className="text-blue-500" /> Product Analysis
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900 text-zinc-500 sticky top-0">
                                <tr>
                                    <th className="p-3">Product</th>
                                    <th className="p-3 text-right">Cost</th>
                                    <th className="p-3 text-right">Price</th>
                                    <th className="p-3 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {products.map(p => (
                                    <tr key={p.id} className="hover:bg-zinc-800/50">
                                        <td className="p-3 text-white">
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-xs text-zinc-500">{p.recipes?.length || 0} ingredients</div>
                                        </td>
                                        <td className="p-3 text-right text-zinc-400">${p.cost.toFixed(2)}</td>
                                        <td className="p-3 text-right text-zinc-300">${p.price.toFixed(2)}</td>
                                        <td className={`p-3 text-right font-bold ${p.margin < 30 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {p.margin.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
