import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers3, Users, Receipt, DollarSign } from "lucide-react";

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

export default function DiningAnalyticsPage() {
    const initial = getPresetRange("last30");
    const [preset, setPreset] = useState<RangePreset>("last30");
    const [from, setFrom] = useState(initial.from);
    const [to, setTo] = useState(initial.to);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [tables, setTables] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [summaryRes, tablesRes] = await Promise.all([
                    api.get(`/analytics/summary/overview?from=${from}&to=${to}`),
                    api.get(`/analytics/tables/performance?from=${from}&to=${to}`),
                ]);

                setSummary(summaryRes.data || null);
                setTables(tablesRes.data || null);
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

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Salon Analytics</h1>
                    <p className="text-sm text-zinc-500">
                        Desempeno historico de mesas, zonas y personas capturadas en el salon.
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
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        title: "Mesas con Venta",
                        value: `${summary?.service?.tablesUsed || 0}`,
                        hint: `${tables?.tables?.length || 0} mesas activas con tickets`,
                        icon: Users,
                    },
                    {
                        title: "Ticket Promedio Mesa",
                        value: formatMoney(summary?.service?.avgTicketPerTable || 0),
                        hint: "Revenue dividido entre mesas con ticket cerrado",
                        icon: Receipt,
                    },
                    {
                        title: "Personas Capturadas",
                        value: `${summary?.guests?.totalCovers || 0}`,
                        hint: `${summary?.guests?.ordersWithGuests || 0} ticket(s) con guestCount`,
                        icon: Layers3,
                    },
                    {
                        title: "Promedio por Persona",
                        value: formatMoney(summary?.guests?.revenuePerGuest || 0),
                        hint: "Solo donde se capturo cantidad de personas",
                        icon: DollarSign,
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
                        <CardTitle>Top 5 Mesas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando mesas...</div>
                        ) : !tables?.tables?.length ? (
                            <div className="text-sm text-zinc-500">No hay ventas por mesa en este rango.</div>
                        ) : (
                            <div className="space-y-3">
                                {tables.tables.slice(0, 5).map((table: any) => (
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
                        <CardTitle>Rendimiento por Zona</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-sm text-zinc-500">Cargando zonas...</div>
                        ) : !tables?.byZone?.length ? (
                            <div className="text-sm text-zinc-500">Sin datos por zona.</div>
                        ) : (
                            <div className="space-y-3">
                                {tables.byZone.map((zone: any) => (
                                    <div key={zone.zone} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{zone.zone}</div>
                                                <div className="text-xs text-zinc-500">{zone.tables} mesa(s) · {zone.orders} ticket(s)</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-white">{formatMoney(zone.revenue)}</div>
                                                <div className="text-xs text-zinc-500">{formatMoney(zone.avgTicket)} ticket prom.</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-zinc-500">
                                            {zone.totalGuests > 0
                                                ? `${formatMoney(zone.revenuePerGuest)} por persona`
                                                : "Sin guestCount suficiente en esta zona"}
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
