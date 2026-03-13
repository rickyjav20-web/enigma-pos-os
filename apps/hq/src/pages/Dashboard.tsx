import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, DollarSign, Package, Users, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    Tooltip,
    XAxis,
    YAxis,
    BarChart,
    Bar,
} from "recharts";

function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function getDateRange(days = 7) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    return {
        from: start.toISOString().split("T")[0],
        to: end.toISOString().split("T")[0],
    };
}

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { from, to } = getDateRange(7);
                const [summaryRes, revenueRes, topProductsRes, inventoryRes] = await Promise.all([
                    api.get("/analytics/summary/today"),
                    api.get(`/analytics/revenue/daily?from=${from}&to=${to}`),
                    api.get(`/analytics/products/velocity?from=${from}&to=${to}&limit=5`),
                    api.get("/analytics/inventory/health"),
                ]);

                setSummary(summaryRes.data || null);
                setDailyRevenue(revenueRes.data?.data || []);
                setTopProducts(topProductsRes.data?.data || []);
                setInventory(inventoryRes.data || null);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const cards = [
        {
            title: "Revenue Hoy",
            value: formatMoney(summary?.revenue?.total || 0),
            hint: `${summary?.revenue?.orderCount || 0} orden(es) · ticket promedio ${formatMoney(summary?.revenue?.avgTicket || 0)}`,
            icon: DollarSign,
            tone: "text-emerald-400",
        },
        {
            title: "Mesas Ocupadas",
            value: `${summary?.tables?.occupied || 0} / ${summary?.tables?.total || 0}`,
            hint: `${(((summary?.tables?.occupancyRate || 0) * 100) / 100).toFixed(2)}% ocupacion`,
            icon: Users,
            tone: "text-sky-400",
        },
        {
            title: "Caja Abierta",
            value: `${summary?.register?.openSessions || 0}`,
            hint: `${summary?.tables?.openOrders || 0} ticket(s) abiertos`,
            icon: Activity,
            tone: "text-amber-400",
        },
        {
            title: "Covers Hoy",
            value: `${summary?.guests?.totalCovers || 0}`,
            hint: summary?.guests?.totalCovers > 0
                ? `${formatMoney(summary?.guests?.revenuePerGuest || 0)}/persona · ~${summary?.guests?.avgPartySize || 0} por mesa`
                : 'Sin datos de personas aún',
            icon: UserCheck,
            tone: "text-violet-400",
        },
        {
            title: "Alertas de Stock",
            value: `${inventory?.summary?.critical || 0}`,
            hint: `${inventory?.summary?.belowPar || 0} debajo de par`,
            icon: AlertTriangle,
            tone: "text-red-400",
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
                    <p className="text-sm text-zinc-500">Operacion viva de caja, mesas, ventas y salud de inventario.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm font-medium text-emerald-400">Live Service</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.title} className="bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-400">{card.title}</CardTitle>
                                <Icon className={`h-4 w-4 ${card.tone}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{loading ? "..." : card.value}</div>
                                <p className="text-xs text-zinc-500">{loading ? "Cargando..." : card.hint}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Revenue Ultimos 7 Dias</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[260px]">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-zinc-500">Cargando revenue...</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dailyRevenue}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 12 }} />
                                        <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 12 }}
                                            formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                                        />
                                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Top Productos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando productos...</div>
                        ) : topProducts.length === 0 ? (
                            <div className="text-sm text-zinc-500">Sin ventas recientes.</div>
                        ) : (
                            <div className="space-y-4">
                                {topProducts.map((product) => (
                                    <div key={product.productId || product.name} className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <Package className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium leading-none truncate">{product.name}</p>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                {product.unitsSold} uds · {formatMoney(product.revenue)}
                                            </p>
                                        </div>
                                        <div className="ml-auto text-xs font-medium text-zinc-400">
                                            {(Number(product.revenueShare || 0) * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Revenue por Metodo</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[220px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Cargando metodos...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={Object.entries(summary?.revenue?.byMethod || {}).map(([method, value]: [string, any]) => ({
                                        method,
                                        revenue: value.total || 0,
                                    }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis dataKey="method" stroke="#71717a" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 12 }}
                                        formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                                    />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Inventario Critico</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando alertas...</div>
                        ) : !inventory?.critical || inventory.critical.length === 0 ? (
                            <div className="text-sm text-emerald-400">No hay items criticos ahora mismo.</div>
                        ) : (
                            <div className="space-y-3">
                                {inventory.critical.slice(0, 5).map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">{item.name}</div>
                                            <div className="text-xs text-zinc-500">
                                                {item.stock} {item.unit} · min {item.minStock}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
