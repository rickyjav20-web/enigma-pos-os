import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Activity,
    AlertTriangle,
    DollarSign,
    Package,
    Receipt,
    TrendingUp,
    UserCheck,
    Users,
} from "lucide-react";
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

type RangePreset = "today" | "yesterday" | "last7" | "last30" | "custom";
type ViewMode = "live" | "history";

function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined) return "N/A";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function dateToInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getPresetRange(preset: RangePreset) {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);

    if (preset === "yesterday") {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    } else if (preset === "last7") {
        start.setDate(start.getDate() - 6);
    } else if (preset === "last30") {
        start.setDate(start.getDate() - 29);
    }

    return {
        from: dateToInput(start),
        to: dateToInput(end),
    };
}

export default function DashboardPage() {
    const initialRange = getPresetRange("today");
    const [preset, setPreset] = useState<RangePreset>("today");
    const [viewMode, setViewMode] = useState<ViewMode>("live");
    const [from, setFrom] = useState(initialRange.from);
    const [to, setTo] = useState(initialRange.to);
    const [loading, setLoading] = useState(true);
    const [liveSummary, setLiveSummary] = useState<any>(null);
    const [historySummary, setHistorySummary] = useState<any>(null);
    const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
    const [hourlyRevenue, setHourlyRevenue] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [tableStats, setTableStats] = useState<any>(null);
    const [inventory, setInventory] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [liveRes, historyRes, dailyRes, hourlyRes, productsRes, tablesRes, inventoryRes] = await Promise.all([
                    api.get("/analytics/summary/today"),
                    api.get(`/analytics/summary/overview?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/daily?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/hourly?date=${to}`),
                    api.get(`/analytics/products/velocity?from=${from}&to=${to}&limit=5`),
                    api.get(`/analytics/tables/performance?from=${from}&to=${to}`),
                    api.get("/analytics/inventory/health"),
                ]);

                setLiveSummary(liveRes.data || null);
                setHistorySummary(historyRes.data || null);
                setDailyRevenue(dailyRes.data?.data || []);
                setHourlyRevenue(hourlyRes.data || []);
                setTopProducts(productsRes.data?.data || []);
                setTableStats(tablesRes.data || null);
                setInventory(inventoryRes.data || null);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [from, to]);

    const isSingleDay = from === to;

    const applyPreset = (nextPreset: RangePreset) => {
        setPreset(nextPreset);
        if (nextPreset === "custom") return;
        const range = getPresetRange(nextPreset);
        setFrom(range.from);
        setTo(range.to);
        setViewMode(nextPreset === "today" ? "live" : "history");
    };

    const historicalCards = useMemo(() => [
        {
            title: isSingleDay ? "Ventas del Dia" : "Ventas del Periodo",
            value: formatMoney(historySummary?.revenue?.total || 0),
            hint: `${historySummary?.revenue?.orderCount || 0} ticket(s) cerrados`,
            icon: DollarSign,
            tone: "text-emerald-400",
        },
        {
            title: "Ticket Promedio",
            value: formatMoney(historySummary?.revenue?.avgTicket || 0),
            hint: `${historySummary?.period?.days || 0} dia(s) analizados`,
            icon: Receipt,
            tone: "text-sky-400",
        },
        {
            title: "Personas Capturadas",
            value: `${historySummary?.guests?.totalCovers || 0}`,
            hint: `${historySummary?.guests?.ordersWithGuests || 0} ticket(s) con guestCount`,
            icon: UserCheck,
            tone: "text-violet-400",
        },
        {
            title: "Hora Mas Fuerte",
            value: historySummary?.timing?.busiestHour?.label || "--:--",
            hint: `${historySummary?.timing?.busiestHour?.orders || 0} ticket(s) · ${formatMoney(historySummary?.timing?.busiestHour?.revenue || 0)}`,
            icon: TrendingUp,
            tone: "text-amber-400",
        },
        {
            title: "Alertas de Stock",
            value: `${inventory?.summary?.critical || 0}`,
            hint: `${inventory?.summary?.belowPar || 0} debajo de par`,
            icon: AlertTriangle,
            tone: "text-red-400",
        },
    ], [historySummary, inventory, isSingleDay]);

    const liveCards = useMemo(() => [
        {
            title: "Revenue Hoy",
            value: formatMoney(liveSummary?.revenue?.total || 0),
            hint: `${liveSummary?.revenue?.orderCount || 0} ticket(s) hoy · promedio ${formatMoney(liveSummary?.revenue?.avgTicket || 0)}`,
            icon: DollarSign,
            tone: "text-emerald-400",
        },
        {
            title: "Mesas Ocupadas Ahora",
            value: `${liveSummary?.tables?.occupied || 0} / ${liveSummary?.tables?.total || 0}`,
            hint: `${liveSummary?.tables?.openOrders || 0} ticket(s) abiertos`,
            icon: Users,
            tone: "text-sky-400",
        },
        {
            title: "Caja Abierta",
            value: `${liveSummary?.register?.openSessions || 0}`,
            hint: `${formatMoney(liveSummary?.revenue?.runRatePerHour || 0)}/hora estimado`,
            icon: Activity,
            tone: "text-amber-400",
        },
        {
            title: "Covers Capturados Hoy",
            value: `${liveSummary?.guests?.totalCovers || 0}`,
            hint: `${liveSummary?.guests?.ordersWithGuests || 0} ticket(s) con personas registradas`,
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
    ], [inventory, liveSummary]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard HQ</h2>
                    <p className="text-sm text-zinc-500">
                        Separamos la operacion viva del analisis historico para evitar mezclar caja abierta con reportes del periodo.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant={viewMode === "live" ? "default" : "outline"}
                            className={viewMode === "live" ? "bg-white text-black hover:bg-zinc-200" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"}
                            onClick={() => setViewMode("live")}
                        >
                            Operacion Viva
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === "history" ? "default" : "outline"}
                            className={viewMode === "history" ? "bg-white text-black hover:bg-zinc-200" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"}
                            onClick={() => setViewMode("history")}
                        >
                            Historico
                        </Button>
                    </div>

                    {viewMode === "history" && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: "today", label: "Hoy" },
                                    { id: "yesterday", label: "Ayer" },
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
                                <div className="ml-auto text-right">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Periodo</div>
                                    <div className="text-sm font-medium text-zinc-200">{historySummary?.period?.from || from} - {historySummary?.period?.to || to}</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {viewMode === "history" && historySummary?.dataAvailability && !historySummary.dataAvailability.guestMetricsComplete && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Este periodo mezcla ventas importadas con ventas del POS. Revenue y productos son validos; personas, mesas y metodos solo cuentan donde el dispositivo capturo esos campos.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {(viewMode === "live" ? liveCards : historicalCards).map((card) => {
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

            {viewMode === "live" ? (
                <div className="grid gap-4 lg:grid-cols-7">
                    <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                        <CardHeader>
                            <CardTitle>Operacion Viva</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Mesas ocupadas</div>
                                <div className="mt-4 text-3xl font-bold text-white">
                                    {loading ? "..." : `${liveSummary?.tables?.occupied || 0}/${liveSummary?.tables?.total || 0}`}
                                </div>
                                <div className="mt-2 text-sm text-zinc-400">
                                    {loading ? "Cargando..." : `${liveSummary?.tables?.openOrders || 0} ticket(s) abiertos ahora`}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Ritmo actual</div>
                                <div className="mt-4 text-3xl font-bold text-white">
                                    {loading ? "..." : formatMoney(liveSummary?.revenue?.runRatePerHour || 0)}
                                </div>
                                <div className="mt-2 text-sm text-zinc-400">
                                    Estimado por hora con la caja abierta de hoy
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Covers</div>
                                <div className="mt-4 text-3xl font-bold text-white">
                                    {loading ? "..." : `${liveSummary?.guests?.totalCovers || 0}`}
                                </div>
                                <div className="mt-2 text-sm text-zinc-400">
                                    Personas capturadas manualmente en tickets con guestCount
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Objetivos</div>
                                <div className="mt-4 text-3xl font-bold text-white">
                                    {loading ? "..." : `${liveSummary?.goals?.completed || 0}/${liveSummary?.goals?.total || 0}`}
                                </div>
                                <div className="mt-2 text-sm text-zinc-400">
                                    {liveSummary?.goals?.completionRate || 0}% completado hoy
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                        <CardHeader>
                            <CardTitle>Top Productos de Hoy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-sm text-zinc-500">Cargando productos...</div>
                            ) : topProducts.length === 0 ? (
                                <div className="text-sm text-zinc-500">Sin ventas hoy.</div>
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
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 lg:grid-cols-7">
                        <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader>
                                <CardTitle>Historico del Periodo</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Comparado con periodo anterior</div>
                                    <div className="mt-4 text-3xl font-bold text-white">
                                        {loading ? "..." : formatPercent(historySummary?.comparison?.revenueDeltaPct)}
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-400">
                                        {loading ? "Cargando..." : `${formatMoney(historySummary?.comparison?.revenueDelta || 0)} de diferencia en ventas`}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Captura de personas</div>
                                    <div className="mt-4 text-3xl font-bold text-white">
                                        {loading ? "..." : `${historySummary?.guests?.coverageRate || 0}%`}
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-400">
                                        {historySummary?.guests?.ordersWithGuests || 0} ticket(s) con guestCount capturado
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Promedio por persona</div>
                                    <div className="mt-4 text-3xl font-bold text-white">
                                        {loading ? "..." : formatMoney(historySummary?.guests?.revenuePerGuest || 0)}
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-400">
                                        Solo en tickets donde se capturo cantidad de personas
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Objetivos</div>
                                    <div className="mt-4 text-3xl font-bold text-white">
                                        {loading ? "..." : `${historySummary?.goals?.completed || 0}/${historySummary?.goals?.total || 0}`}
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-400">
                                        {historySummary?.goals?.completionRate || 0}% completado en el periodo
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader>
                                <CardTitle>Top Productos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="text-sm text-zinc-500">Cargando productos...</div>
                                ) : topProducts.length === 0 ? (
                                    <div className="text-sm text-zinc-500">Sin ventas en el periodo.</div>
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

                    <div className="grid gap-4 lg:grid-cols-7">
                        <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader>
                                <CardTitle>Top 5 Mesas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="text-sm text-zinc-500">Cargando mesas...</div>
                                ) : !tableStats?.tables?.length ? (
                                    <div className="text-sm text-zinc-500">No hay tickets con mesa en el periodo.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {tableStats.tables.slice(0, 5).map((table: any) => (
                                            <div key={table.tableId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-sm font-semibold text-white">{table.name}</div>
                                                        <div className="text-xs text-zinc-500">
                                                            {table.zone || "General"} · {table.orders} ticket(s) cerrados
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-semibold text-white">{formatMoney(table.revenue)}</div>
                                                        <div className="text-xs text-zinc-500">{formatMoney(table.avgTicket)} ticket promedio</div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-zinc-500">
                                                    {table.totalGuests > 0
                                                        ? `${table.totalGuests} personas capturadas · ${formatMoney(table.revenuePerGuest)} por persona`
                                                        : "Sin guestCount suficiente para promedio por persona"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader>
                                <CardTitle>Ventas por Dia</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[280px]">
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
                                                formatter={(value) => [formatMoney(Number(value)), "Ventas"]}
                                            />
                                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                            <CardHeader>
                                <CardTitle>{isSingleDay ? `Horas de ${to}` : `Horas del dia final ${to}`}</CardTitle>
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
                                                formatter={(value) => [formatMoney(Number(value)), "Ventas"]}
                                            />
                                            <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-400">
                <div className="text-zinc-200 font-medium">Definiciones rapidas</div>
                <div className="mt-2">`Ticket`: una venta cerrada.</div>
                <div>`Covers`: numero de personas capturadas manualmente en `guestCount` dentro del ticket.</div>
                <div>`Personas capturadas`: no es estimado, solo cuenta donde el staff registro cantidad de comensales.</div>
                <div>`Operacion viva`: caja, mesas abiertas y ritmo del momento.</div>
                <div>`Historico`: ventas cerradas por dia, semana, mes o rango custom.</div>
            </div>
        </div>
    );
}
