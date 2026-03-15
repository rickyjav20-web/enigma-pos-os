import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { CalendarDays, Clock3, DollarSign, Layers3, Receipt, Users } from "lucide-react";

type RangePreset = "last7" | "last30" | "custom";

function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function dateToInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getPresetRange(preset: RangePreset) {
    const end = new Date();
    const start = new Date(end);

    if (preset === "last7") {
        start.setDate(start.getDate() - 6);
    } else if (preset === "last30") {
        start.setDate(start.getDate() - 29);
    }

    return {
        from: dateToInput(start),
        to: dateToInput(end),
    };
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

export default function SalesAnalyticsPage() {
    const initial = getPresetRange("last30");
    const [preset, setPreset] = useState<RangePreset>("last30");
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [hourlyDate, setHourlyDate] = useState(initial.to);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
    const [hourlyRevenue, setHourlyRevenue] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [tableStats, setTableStats] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [summaryRes, dailyRes, hourlyRes, categoriesRes, topProductsRes, tablesRes] = await Promise.all([
                    api.get(`/analytics/summary/overview?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/daily?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/hourly?date=${hourlyDate}`),
                    api.get(`/analytics/categories/performance?from=${from}&to=${to}`),
                    api.get(`/analytics/products/velocity?from=${from}&to=${to}&limit=12`),
                    api.get(`/analytics/tables/performance?from=${from}&to=${to}`),
                ]);

                setSummary(summaryRes.data || null);
                setDailyRevenue(dailyRes.data?.data || []);
                setHourlyRevenue(hourlyRes.data || []);
                setCategories(categoriesRes.data?.data || []);
                setTopProducts(topProductsRes.data?.data || []);
                setTableStats(tablesRes.data || null);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [from, to, hourlyDate]);

    const applyPreset = (nextPreset: RangePreset) => {
        setPreset(nextPreset);
        if (nextPreset === "custom") return;
        const range = getPresetRange(nextPreset);
        setFrom(range.from);
        setTo(range.to);
        setHourlyDate(range.to);
    };

    const paymentMix = useMemo(() => {
        const byMethod = Object.entries(summary?.revenue?.byMethod || {}).map(([method, value]: [string, any]) => ({
            method,
            revenue: Number(value?.total || 0),
            orders: Number(value?.count || 0),
        }));
        return byMethod.sort((a, b) => b.revenue - a.revenue);
    }, [summary]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Sales Analytics</h1>
                    <p className="text-sm text-zinc-500">
                        Drill-down de ventas: tendencia, horas fuertes, categorias, productos y rendimiento del salon.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: "last7", label: "7 dias" },
                            { id: "last30", label: "30 dias" },
                            { id: "custom", label: "Custom" },
                        ].map((option) => (
                            <Button
                                key={option.id}
                                type="button"
                                variant={preset === option.id ? "default" : "outline"}
                                className={preset === option.id ? "bg-white text-black hover:bg-zinc-200" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"}
                                onClick={() => applyPreset(option.id as RangePreset)}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                        <input
                            type="date"
                            value={from}
                            onChange={(event) => {
                                setPreset("custom");
                                setFrom(event.target.value);
                            }}
                            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
                        />
                        <span className="text-sm text-zinc-500">hasta</span>
                        <input
                            type="date"
                            value={to}
                            onChange={(event) => {
                                setPreset("custom");
                                setTo(event.target.value);
                            }}
                            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
                        />
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Dia horario</span>
                            <input
                                type="date"
                                value={hourlyDate}
                                onChange={(event) => setHourlyDate(event.target.value)}
                                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {summary?.dataAvailability && !summary.dataAvailability.paymentMethodsComplete && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    El periodo incluye ventas importadas sin metodo de pago o servicio completo. Revenue y productos si son confiables; mesa, covers y mix de pago reflejan solo ventas POS nativas.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                    {
                        title: "Revenue",
                        value: formatMoney(summary?.revenue?.total || 0),
                        hint: `${summary?.period?.days || 0} dia(s)`,
                        icon: DollarSign,
                    },
                    {
                        title: "Tickets",
                        value: `${summary?.revenue?.orderCount || 0}`,
                        hint: `ticket promedio ${formatMoney(summary?.revenue?.avgTicket || 0)}`,
                        icon: Receipt,
                    },
                    {
                        title: "Covers",
                        value: `${summary?.guests?.totalCovers || 0}`,
                        hint: `${formatMoney(summary?.guests?.revenuePerGuest || 0)} por persona`,
                        icon: Users,
                    },
                    {
                        title: "Hora Fuerte",
                        value: summary?.timing?.busiestHour?.label || "--:--",
                        hint: `${summary?.timing?.busiestHour?.orders || 0} ticket(s)`,
                        icon: Clock3,
                    },
                    {
                        title: "Promedio Diario",
                        value: formatMoney(summary?.revenue?.dailyAverage || 0),
                        hint: `${summary?.service?.tablesUsed || 0} mesas con venta`,
                        icon: CalendarDays,
                    },
                ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <Card key={metric.title} className="bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-zinc-400">{metric.title}</CardTitle>
                                <Icon className="h-4 w-4 text-zinc-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{loading ? "..." : metric.value}</div>
                                <p className="text-xs text-zinc-500">{loading ? "Cargando..." : metric.hint}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Tendencia de Ventas</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Cargando tendencia...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyRevenue}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 12 }}
                                        formatter={(value, name) => {
                                            if (name === "revenue") return [formatMoney(Number(value)), "Ventas"];
                                            return [value, "Tickets"];
                                        }}
                                    />
                                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="orders" stroke="#60a5fa" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Mix por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Cargando categorias...</div>
                        ) : categories.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Sin categorias con ventas.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categories.slice(0, 6)}
                                        dataKey="revenue"
                                        nameKey="name"
                                        innerRadius={65}
                                        outerRadius={100}
                                        paddingAngle={3}
                                    >
                                        {categories.slice(0, 6).map((entry, index) => (
                                            <Cell key={entry.categoryId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 12 }}
                                        formatter={(value) => [formatMoney(Number(value)), "Ventas"]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Ventas por Hora ({hourlyDate})</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-zinc-500">Cargando horas...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyRevenue}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                    <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 11 }} interval={2} />
                                    <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: 12 }}
                                        formatter={(value, name) => {
                                            if (name === "revenue") return [formatMoney(Number(value)), "Ventas"];
                                            return [value, "Tickets"];
                                        }}
                                    />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Metodo de Pago</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando mix...</div>
                        ) : paymentMix.length === 0 ? (
                            <div className="text-sm text-zinc-500">Sin datos suficientes de metodos.</div>
                        ) : (
                            <div className="space-y-4">
                                {paymentMix.map((method, index) => (
                                    <div key={method.method} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="capitalize text-zinc-200">{method.method}</span>
                                            <span className="text-zinc-400">{formatMoney(method.revenue)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${summary?.revenue?.total > 0 ? (method.revenue / summary.revenue.total) * 100 : 0}%`,
                                                    backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                                                }}
                                            />
                                        </div>
                                        <div className="text-xs text-zinc-500">{method.orders} ticket(s)</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-violet-400" />
                            Top Productos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando productos...</div>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.slice(0, 8).map((product) => (
                                    <div key={product.productId || product.name} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-white">{product.name}</div>
                                            <div className="text-xs text-zinc-500">{product.unitsSold} uds</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-white">{formatMoney(product.revenue)}</div>
                                            <div className="text-xs text-zinc-500">{(Number(product.revenueShare || 0) * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Mesas con Mejor Desempeno</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando mesas...</div>
                        ) : !tableStats?.tables?.length ? (
                            <div className="text-sm text-zinc-500">No hay ventas por mesa en este rango.</div>
                        ) : (
                            <div className="space-y-3">
                                {tableStats.tables.slice(0, 6).map((table: any) => (
                                    <div key={table.tableId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{table.name}</div>
                                                <div className="text-xs text-zinc-500">{table.zone || "General"} · {table.orders} ticket(s)</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-white">{formatMoney(table.revenue)}</div>
                                                <div className="text-xs text-zinc-500">{formatMoney(table.avgTicket)} promedio</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-zinc-500">
                                            {table.totalGuests > 0
                                                ? `${table.totalGuests} personas · ${formatMoney(table.revenuePerGuest)} por persona · party size ${table.avgPartySize}`
                                                : "Sin guestCount suficiente para analitica por persona en esta mesa"}
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
