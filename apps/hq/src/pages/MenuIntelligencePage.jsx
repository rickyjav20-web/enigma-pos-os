import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
    TrendingUp, AlertTriangle, Search, Target, Layers3,
} from 'lucide-react';
import {
    ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function getDateRange(days = 30) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
    };
}

export default function MenuIntelligencePage() {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [categoryMix, setCategoryMix] = useState([]);
    const [stats, setStats] = useState({
        avgMargin: 0,
        lowMarginCount: 0,
        missingRecipeCount: 0,
        activeMenuItems: 0,
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { from, to } = getDateRange(30);
                const [productRes, profitabilityRes, categoriesRes] = await Promise.all([
                    api.get('/products?limit=500'),
                    api.get(`/analytics/products/profitability?from=${from}&to=${to}&limit=100`),
                    api.get(`/analytics/categories/performance?from=${from}&to=${to}`),
                ]);

                const productList = productRes.data?.data || [];
                const profitability = profitabilityRes.data?.data || [];
                const categoryPerformance = categoriesRes.data?.data || [];
                const productMap = new Map(productList.map((product) => [product.id, product]));

                const enriched = profitability.map((item) => {
                    const product = productMap.get(item.productId);
                    const recipesCount = product?.recipes?.length || 0;
                    const marginPct = Number(item.marginPct || 0) * 100;
                    const contribution = Number(item.contribution || 0);
                    const unitsSold = Number(item.unitsSold || 0);

                    let quadrant = 'Dormido';
                    if (marginPct >= 60 && unitsSold >= 15) quadrant = 'Estrella';
                    else if (marginPct < 30 && unitsSold >= 15) quadrant = 'Volumen sin margen';
                    else if (marginPct >= 60 && unitsSold < 15) quadrant = 'Oportunidad';

                    return {
                        ...item,
                        categoryId: product?.categoryId || 'Sin categoria',
                        recipesCount,
                        marginPctDisplay: marginPct,
                        contributionDisplay: contribution,
                        unitsSoldDisplay: unitsSold,
                        fill: marginPct >= 60 ? '#10b981' : marginPct >= 30 ? '#f59e0b' : '#ef4444',
                        quadrant,
                    };
                });

                const avgMargin = enriched.length > 0
                    ? enriched.reduce((acc, item) => acc + item.marginPctDisplay, 0) / enriched.length
                    : 0;

                setStats({
                    avgMargin,
                    lowMarginCount: enriched.filter((item) => item.marginPctDisplay < 30).length,
                    missingRecipeCount: productList.filter((item) => !item.recipes || item.recipes.length === 0).length,
                    activeMenuItems: productList.length,
                });
                setProducts(enriched.sort((a, b) => b.contributionDisplay - a.contributionDisplay));
                setCategoryMix(categoryPerformance.slice(0, 6));
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const topWinners = useMemo(() => products.slice(0, 12), [products]);

    return (
        <div className="h-screen bg-black text-white p-6 overflow-hidden flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-emerald-500" /> Menu Intelligence
                </h1>
                <p className="text-zinc-500 text-sm">
                    Cruza margen, volumen y contribution real de los productos vendidos en los ultimos 30 dias.
                </p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Margen promedio</p>
                    <p className={`text-3xl font-bold ${stats.avgMargin >= 60 ? 'text-emerald-400' : stats.avgMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                        {stats.avgMargin.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Items con margen bajo</p>
                    <p className="text-3xl font-bold text-red-400">{stats.lowMarginCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Sin receta</p>
                    <p className="text-3xl font-bold text-zinc-200">{stats.missingRecipeCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase">Menu activo</p>
                    <p className="text-3xl font-bold text-white">{stats.activeMenuItems}</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                <Target size={18} className="text-emerald-400" /> Profit Matrix
                            </h3>
                            <p className="text-xs text-zinc-500">
                                Eje X = unidades vendidas. Eje Y = margen porcentual.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Estrella</span>
                            <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">Oportunidad</span>
                            <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">Bajo margen</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[320px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Cargando matrix...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis type="number" dataKey="unitsSoldDisplay" name="Unidades" stroke="#71717a" />
                                    <YAxis type="number" dataKey="marginPctDisplay" name="Margen" unit="%" stroke="#71717a" />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 12 }}
                                        formatter={(value, name) => {
                                            if (name === 'marginPctDisplay') return [`${Number(value).toFixed(1)}%`, 'Margen'];
                                            if (name === 'unitsSoldDisplay') return [Number(value).toFixed(0), 'Unidades'];
                                            return [value, name];
                                        }}
                                    />
                                    <Scatter name="Menu" data={products}>
                                        {products.map((entry) => (
                                            <Cell key={entry.productId} fill={entry.fill} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Search size={18} className="text-blue-500" /> Top Contribution
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
                        {loading ? (
                            <div className="p-4 text-sm text-zinc-500">Cargando productos...</div>
                        ) : topWinners.length === 0 ? (
                            <div className="p-4 text-sm text-zinc-500">No hay ventas suficientes para analizar.</div>
                        ) : topWinners.map((product) => (
                            <div key={product.productId} className="p-4 hover:bg-zinc-800/30 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-medium text-white truncate">{product.name}</div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                            {product.categoryId || 'Sin categoria'} · {product.unitsSoldDisplay} uds · {product.recipesCount} ingrediente(s)
                                        </div>
                                        <div className="text-[11px] text-zinc-600 mt-1">{product.quadrant}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className={`text-sm font-bold ${product.marginPctDisplay >= 60 ? 'text-emerald-400' : product.marginPctDisplay >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {product.marginPctDisplay.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-zinc-500">{formatMoney(product.contributionDisplay)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Layers3 size={16} className="text-violet-400" />
                    <h3 className="font-semibold">Mix por categoria</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                    {loading ? (
                        <span className="text-sm text-zinc-500">Cargando categorias...</span>
                    ) : categoryMix.length === 0 ? (
                        <span className="text-sm text-zinc-500">Sin categorias con ventas en el periodo.</span>
                    ) : categoryMix.map((category) => (
                        <div key={category.categoryId} className="px-3 py-2 rounded-xl bg-black/30 border border-zinc-800 min-w-[170px]">
                            <div className="text-sm font-medium text-white">{category.name}</div>
                            <div className="text-xs text-zinc-500 mt-1">{category.units} uds · {formatMoney(category.revenue)}</div>
                            <div className="text-[11px] mt-1 text-emerald-400">
                                {(Number(category.revenueShare || 0) * 100).toFixed(1)}% del revenue
                            </div>
                        </div>
                    ))}
                </div>
                {!loading && stats.missingRecipeCount > 0 && (
                    <div className="mt-4 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>
                            Hay {stats.missingRecipeCount} productos sin receta. Se venden en POS, pero no aportan COGS ni analytics completos hasta que les configures receta.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
