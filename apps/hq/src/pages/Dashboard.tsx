import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, CalendarRange, DollarSign, Package, Users, UserCheck } from "lucide-react";
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
    const [from, setFrom] = useState(initialRange.from);
    const [to, setTo] = useState(initialRange.to);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
    const [hourlyRevenue, setHourlyRevenue] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [tableStats, setTableStats] = useState<any>(null);
    const [inventory, setInventory] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [summaryRes, revenueRes, hourlyRes, topProductsRes, tablesRes, inventoryRes] = await Promise.all([
                    api.get(`/analytics/summary/overview?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/daily?from=${from}&to=${to}`),
                    api.get(`/analytics/revenue/hourly?date=${to}`),
                    api.get(`/analytics/products/velocity?from=${from}&to=${to}&limit=5`),
                    api.get(`/analytics/tables/performance?from=${from}&to=${to}`),
                    api.get("/analytics/inventory/health"),
                ]);

                setSummary(summaryRes.data || null);
                setDailyRevenue(revenueRes.data?.data || []);
                setHourlyRevenue(hourlyRes.data || []);
                setTopProducts(topProductsRes.data?.data || []);
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

    const applyPreset = (nextPreset: RangePreset) => {
        setPreset(nextPreset);
        if (nextPreset === "custom") return;
        const range = getPresetRange(nextPreset);
        setFrom(range.from);
        setTo(range.to);
    };

    const cards = [
        {
            title: "Ventas del Periodo",
            value: formatMoney(summary?.revenue?.total || 0),
            hint: `${summary?.revenue?.orderCount || 0} ticket(s) · promedio ${formatMoney(summary?.revenue?.avgTicket || 0)}`,
            icon: DollarSign,
            tone: "text-emerald-400",
        },
        {
            title: "Promedio Diario",
            value: formatMoney(summary?.revenue?.dailyAverage || 0),
            hint: `${summary?.period?.days || 0} dia(s) analizados`,
            icon: CalendarRange,
            tone: "text-sky-400",
        },
        {
            title: "Mesas con Venta",
            value: `${summary?.service?.tablesUsed || 0} / ${summary?.service?.totalTables || 0}`,
            hint: `ticket por mesa ${formatMoney(summary?.service?.avgTicketPerTable || 0)}`,
            icon: Users,
            tone: "text-amber-400",
        },
        {
            title: "Covers",
            value: `${summary?.guests?.totalCovers || 0}`,
            hint: summary?.guests?.totalCovers > 0
                ? `${formatMoney(summary?.guests?.revenuePerGuest || 0)}/persona · ${summary?.guests?.avgPartySize || 0} por mesa`
                : "Sin datos completos de personas",
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
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard HQ</h2>
                    <p className="text-sm text-zinc-500">Resumen centralizado del periodo: ventas, servicio, productos y salud operativa.</p>
                </div>

                <div className="flex flex-col gap-3">
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
                            <div className="text-sm font-medium text-zinc-200">{summary?.period?.from || from} - {summary?.period?.to || to}</div>
                        </div>
                    </div>
                </div>
            </div>

            {summary?.dataAvailability && !summary.dataAvailability.guestMetricsComplete && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Parte del periodo viene de ventas importadas sin mesa, covers o metodo de pago. Las metricas de servicio se calculan solo con ventas capturadas en POS nativo.
                </div>
            )}

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

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Resumen del Periodo</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Comparado con periodo anterior</div>
                            <div className="mt-4 text-3xl font-bold text-white">
                                {loading ? "..." : formatPercent(summary?.comparison?.revenueDeltaPct)}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                                {loading ? "Cargando comparativo..." : `${formatMoney(summary?.comparison?.revenueDelta || 0)} de diferencia en ventas`}
                            </div>
                            <div className="mt-4 text-xs text-zinc-500">
                                Tickets: {summary?.comparison?.ordersDelta || 0} · ticket promedio: {formatMoney(summary?.comparison?.avgTicketDelta || 0)}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Hora mas fuerte</div>
                            <div className="mt-4 text-3xl font-bold text-white">
                                {loading ? "..." : summary?.timing?.busiestHour?.label || "--:--"}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                                {loading ? "Cargando timing..." : `${summary?.timing?.busiestHour?.orders || 0} ticket(s) · ${formatMoney(summary?.timing?.busiestHour?.revenue || 0)}`}
                            </div>
                            <div className="mt-4 text-xs text-zinc-500">
                                Live days: {summary?.dataAvailability?.liveOrderDays || 0} · importados: {summary?.dataAvailability?.importedOnlyDays || 0}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Cobertura de personas</div>
                            <div className="mt-4 text-3xl font-bold text-white">
                                {loading ? "..." : `${summary?.guests?.coverageRate || 0}%`}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                                {summary?.guests?.ordersWithGuests || 0} ticket(s) con invitados capturados
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Objetivos</div>
                            <div className="mt-4 text-3xl font-bold text-white">
                                {loading ? "..." : `${summary?.goals?.completed || 0}/${summary?.goals?.total || 0}`}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                                {summary?.goals?.completionRate || 0}% completado en el periodo
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
                        <CardTitle>Ventas por Dia</CardTitle>
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
                                            formatter={(value) => [formatMoney(Number(value)), "Ventas"]}
                                        />
                                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Horas de Venta ({to})</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[260px]">
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

            <div className="grid gap-4 lg:grid-cols-7">
                <Card className="lg:col-span-4 bg-zinc-950 border-zinc-800 text-white">
                    <CardHeader>
                        <CardTitle>Servicio por Mesa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando mesas...</div>
                        ) : !tableStats?.tables?.length ? (
                            <div className="text-sm text-zinc-500">No hay ventas por mesa en el periodo.</div>
                        ) : (
                            <div className="space-y-3">
                                {tableStats.tables.slice(0, 5).map((table: any) => (
                                    <div key={table.tableId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{table.name}</div>
                                                <div className="text-xs text-zinc-500">{table.zone || "General"} · {table.orders} ticket(s)</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-white">{formatMoney(table.revenue)}</div>
                                                <div className="text-xs text-zinc-500">{formatMoney(table.avgTicket)} ticket prom.</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-zinc-500">
                                            {table.totalGuests > 0
                                                ? `${table.totalGuests} personas · ${formatMoney(table.revenuePerGuest)} por persona · party size ${table.avgPartySize}`
                                                : "Sin guestCount suficiente para calcular covers por mesa"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 bg-zinc-950 border-zinc-800 text-white">
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

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                <div className="flex items-center gap-2 text-zinc-200">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Live service sigue existiendo en tiempo real; este dashboard ahora esta enfocado en el periodo seleccionado.
                </div>
            </div>
        </div>
    );
}
