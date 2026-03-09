/**
 * TableFlowSettings — HQ Back Office
 * Configure table flow rules: presets (casual/standard/fine dining) or custom.
 * Controls how Torre de Control behaves: thresholds, alerts, timings.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Settings2, Clock, AlertTriangle, Timer, ChefHat,
    RefreshCw, CheckCircle2, Coffee, UtensilsCrossed, Wine,
    Pencil, RotateCcw, Truck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FlowConfig {
    preset: string;
    reviewThresholdMin: number;
    urgencyWarningMin: number;
    autoRefreshSec: number;
    tableTurnTargetMin: number;
    staleTicketAlertMin: number;
    kdsPrepTimeWarningMin: number;
    sobremesaMin: number;
    deliveryBufferMin: number;
}

interface Preset {
    key: string;
    label: string;
    description: string;
    reviewThresholdMin: number;
    urgencyWarningMin: number;
    autoRefreshSec: number;
    tableTurnTargetMin: number;
    staleTicketAlertMin: number;
    kdsPrepTimeWarningMin: number;
    sobremesaMin: number;
    deliveryBufferMin: number;
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
    casual: <Coffee className="w-5 h-5" />,
    standard: <UtensilsCrossed className="w-5 h-5" />,
    fine_dining: <Wine className="w-5 h-5" />,
};

const PRESET_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    casual: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]' },
    standard: { bg: 'bg-[#93B59D]/10', border: 'border-[#93B59D]/30', text: 'text-[#93B59D]', glow: 'shadow-[0_0_15px_rgba(147,181,157,0.15)]' },
    fine_dining: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]' },
};

const FIELD_CONFIG = [
    {
        key: 'reviewThresholdMin' as const,
        label: 'Alerta de revisión',
        description: 'Minutos después de servir antes de alertar al manager',
        icon: <AlertTriangle className="w-4 h-4" />,
        unit: 'min',
        color: 'text-red-400',
    },
    {
        key: 'urgencyWarningMin' as const,
        label: 'Advertencia de urgencia',
        description: 'Minutos con ticket abierto sin progreso antes de marcar urgente',
        icon: <Clock className="w-4 h-4" />,
        unit: 'min',
        color: 'text-amber-400',
    },
    {
        key: 'tableTurnTargetMin' as const,
        label: 'Rotación de mesa',
        description: 'Tiempo objetivo ideal por mesa para planificar capacidad',
        icon: <Timer className="w-4 h-4" />,
        unit: 'min',
        color: 'text-blue-400',
    },
    {
        key: 'staleTicketAlertMin' as const,
        label: 'Ticket inactivo',
        description: 'Minutos sin actividad antes de señalar un ticket olvidado',
        icon: <Clock className="w-4 h-4" />,
        unit: 'min',
        color: 'text-orange-400',
    },
    {
        key: 'sobremesaMin' as const,
        label: 'Tiempo de sobremesa',
        description: 'Minutos post-revisión antes de volver a alertar (el cliente come tranquilo)',
        icon: <Coffee className="w-4 h-4" />,
        unit: 'min',
        color: 'text-violet-400',
    },
    {
        key: 'deliveryBufferMin' as const,
        label: 'Tiempo de entrega',
        description: 'Minutos desde que cocina marca listo hasta mostrar "servida" (tránsito de platos)',
        icon: <Truck className="w-4 h-4" />,
        unit: 'min',
        color: 'text-sky-400',
    },
    {
        key: 'kdsPrepTimeWarningMin' as const,
        label: 'Alerta de cocina',
        description: 'Minutos de preparación antes de marcar como lento',
        icon: <ChefHat className="w-4 h-4" />,
        unit: 'min',
        color: 'text-emerald-400',
    },
    {
        key: 'autoRefreshSec' as const,
        label: 'Actualización en vivo',
        description: 'Intervalo de refresco de la Torre de Control',
        icon: <RefreshCw className="w-4 h-4" />,
        unit: 'seg',
        color: 'text-cyan-400',
    },
];

type FieldKey = typeof FIELD_CONFIG[number]['key'];

// ─── Component ───────────────────────────────────────────────────────────────
export default function TableFlowSettings() {
    const queryClient = useQueryClient();
    const [isCustom, setIsCustom] = useState(false);
    const [customValues, setCustomValues] = useState<Record<FieldKey, number>>({
        reviewThresholdMin: 10,
        urgencyWarningMin: 30,
        tableTurnTargetMin: 60,
        staleTicketAlertMin: 20,
        sobremesaMin: 15,
        deliveryBufferMin: 1,
        kdsPrepTimeWarningMin: 15,
        autoRefreshSec: 15,
    });

    // ── Queries ──
    const { data: config, isLoading: configLoading } = useQuery<FlowConfig>({
        queryKey: ['table-flow-config'],
        queryFn: async () => {
            const res = await api.get('/table-flow-config');
            return res.data?.data;
        },
    });

    const { data: presets = [] } = useQuery<Preset[]>({
        queryKey: ['table-flow-presets'],
        queryFn: async () => {
            const res = await api.get('/table-flow-config/presets');
            return res.data?.data || [];
        },
    });

    // Sync custom values when config loads
    useEffect(() => {
        if (config) {
            setIsCustom(config.preset === 'custom');
            setCustomValues({
                reviewThresholdMin: config.reviewThresholdMin,
                urgencyWarningMin: config.urgencyWarningMin,
                tableTurnTargetMin: config.tableTurnTargetMin,
                staleTicketAlertMin: config.staleTicketAlertMin,
                sobremesaMin: config.sobremesaMin,
                deliveryBufferMin: config.deliveryBufferMin,
                kdsPrepTimeWarningMin: config.kdsPrepTimeWarningMin,
                autoRefreshSec: config.autoRefreshSec,
            });
        }
    }, [config]);

    // ── Mutation ──
    const saveMutation = useMutation({
        mutationFn: (data: object) => api.put('/table-flow-config', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['table-flow-config'] });
        },
        onError: (err: any) => {
            alert(`Error al guardar: ${err?.response?.data?.message || err.message}`);
        },
    });

    const applyPreset = (presetKey: string) => {
        setIsCustom(false);
        saveMutation.mutate({ preset: presetKey });
    };

    const saveCustom = () => {
        saveMutation.mutate({ preset: 'custom', ...customValues });
    };

    const activePreset = config?.preset || 'standard';

    // Get displayed values (from config or selected preset)
    const displayValues: Record<FieldKey, number> = isCustom
        ? customValues
        : {
            reviewThresholdMin: config?.reviewThresholdMin ?? 10,
            urgencyWarningMin: config?.urgencyWarningMin ?? 30,
            tableTurnTargetMin: config?.tableTurnTargetMin ?? 60,
            staleTicketAlertMin: config?.staleTicketAlertMin ?? 20,
            sobremesaMin: config?.sobremesaMin ?? 15,
            deliveryBufferMin: config?.deliveryBufferMin ?? 1,
            kdsPrepTimeWarningMin: config?.kdsPrepTimeWarningMin ?? 15,
            autoRefreshSec: config?.autoRefreshSec ?? 15,
        };

    if (configLoading) {
        return (
            <div className="p-6 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-[#93B59D]/20 border-t-[#93B59D] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">

            {/* ── Header ── */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-[#93B59D]" />
                    Flujo de Mesas
                </h1>
                <p className="text-zinc-400 mt-1 text-sm">
                    Configura los tiempos y alertas de la Torre de Control. Elige un preset o personaliza cada valor.
                </p>
            </div>

            {/* ── Presets ── */}
            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    Modo de operación
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {presets.map(preset => {
                        const colors = PRESET_COLORS[preset.key] || PRESET_COLORS.standard;
                        const isActive = !isCustom && activePreset === preset.key;

                        return (
                            <button
                                key={preset.key}
                                onClick={() => applyPreset(preset.key)}
                                disabled={saveMutation.isPending}
                                className={`
                                    relative p-5 rounded-2xl border text-left transition-all
                                    ${isActive
                                        ? `${colors.bg} ${colors.border} ${colors.glow} ring-1 ring-white/10`
                                        : 'bg-[#0a0a0c] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'
                                    }
                                `}
                            >
                                {isActive && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
                                    </div>
                                )}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                                    isActive ? colors.bg : 'bg-white/[0.04]'
                                }`}>
                                    <span className={isActive ? colors.text : 'text-zinc-500'}>
                                        {PRESET_ICONS[preset.key]}
                                    </span>
                                </div>
                                <h3 className={`font-bold text-sm mb-0.5 ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                                    {preset.label}
                                </h3>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    {preset.description}
                                </p>

                                {/* Quick stats */}
                                <div className="flex gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                                    <div className="text-center">
                                        <div className={`text-sm font-bold font-mono ${isActive ? colors.text : 'text-zinc-400'}`}>
                                            {preset.reviewThresholdMin}m
                                        </div>
                                        <div className="text-[9px] text-zinc-600">Revisión</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-bold font-mono ${isActive ? colors.text : 'text-zinc-400'}`}>
                                            {preset.tableTurnTargetMin}m
                                        </div>
                                        <div className="text-[9px] text-zinc-600">Rotación</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-bold font-mono ${isActive ? colors.text : 'text-zinc-400'}`}>
                                            {preset.sobremesaMin}m
                                        </div>
                                        <div className="text-[9px] text-zinc-600">Sobremesa</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-bold font-mono ${isActive ? colors.text : 'text-zinc-400'}`}>
                                            {preset.deliveryBufferMin}m
                                        </div>
                                        <div className="text-[9px] text-zinc-600">Entrega</div>
                                    </div>
                                    <div className="text-center">
                                        <div className={`text-sm font-bold font-mono ${isActive ? colors.text : 'text-zinc-400'}`}>
                                            {preset.kdsPrepTimeWarningMin}m
                                        </div>
                                        <div className="text-[9px] text-zinc-600">Cocina</div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Custom Toggle ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm font-semibold text-zinc-300">Personalizar valores</span>
                </div>
                <button
                    onClick={() => {
                        if (isCustom) {
                            // Revert to current preset
                            if (config && config.preset !== 'custom') {
                                applyPreset(config.preset);
                            }
                            setIsCustom(false);
                        } else {
                            setIsCustom(true);
                        }
                    }}
                    className={`
                        px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${isCustom
                            ? 'bg-[#93B59D]/15 text-[#93B59D] border border-[#93B59D]/30'
                            : 'bg-white/[0.04] text-zinc-500 border border-white/[0.06] hover:text-zinc-300'
                        }
                    `}
                >
                    {isCustom ? 'Modo personalizado activo' : 'Activar modo personalizado'}
                </button>
            </div>

            {/* ── Values Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {FIELD_CONFIG.map(field => (
                    <Card
                        key={field.key}
                        className={`p-4 transition-all ${
                            isCustom
                                ? 'bg-black/40 border-[#93B59D]/15'
                                : 'bg-[#0a0a0c] border-white/[0.05]'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={field.color}>{field.icon}</span>
                                <span className="text-xs font-semibold text-zinc-300">{field.label}</span>
                            </div>
                            {!isCustom && (
                                <span className={`text-lg font-bold font-mono ${field.color}`}>
                                    {displayValues[field.key]}<span className="text-[10px] text-zinc-500 ml-0.5">{field.unit}</span>
                                </span>
                            )}
                        </div>

                        <p className="text-[10px] text-zinc-600 leading-relaxed mb-2">
                            {field.description}
                        </p>

                        {isCustom && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min="1"
                                    value={customValues[field.key]}
                                    onChange={e => setCustomValues(prev => ({
                                        ...prev,
                                        [field.key]: Number(e.target.value) || 0,
                                    }))}
                                    className="bg-black/40 border-white/10 text-sm font-mono w-20"
                                />
                                <span className="text-xs text-zinc-500">{field.unit}</span>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* ── Save Custom ── */}
            {isCustom && (
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setIsCustom(false);
                            if (config) {
                                setCustomValues({
                                    reviewThresholdMin: config.reviewThresholdMin,
                                    urgencyWarningMin: config.urgencyWarningMin,
                                    tableTurnTargetMin: config.tableTurnTargetMin,
                                    staleTicketAlertMin: config.staleTicketAlertMin,
                                    sobremesaMin: config.sobremesaMin,
                                    deliveryBufferMin: config.deliveryBufferMin,
                                    kdsPrepTimeWarningMin: config.kdsPrepTimeWarningMin,
                                    autoRefreshSec: config.autoRefreshSec,
                                });
                            }
                        }}
                        className="text-zinc-400 gap-1.5"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Descartar
                    </Button>
                    <Button
                        size="sm"
                        onClick={saveCustom}
                        disabled={saveMutation.isPending}
                        className="bg-[#93B59D] hover:bg-[#93B59D]/80 text-[#121413] font-semibold"
                    >
                        {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                    </Button>
                </div>
            )}

            {/* ── Status ── */}
            {saveMutation.isSuccess && (
                <div className="flex items-center gap-2 text-[#93B59D] text-xs font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Configuración guardada. Los cambios aplican en tiempo real.
                </div>
            )}
        </div>
    );
}
