/**
 * ReceiptSettings — HQ Back Office
 * Configure receipt printing: business name, header/footer, currency display, paper width.
 * Changes are applied to all POS devices on next print.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Printer, Save, RotateCcw, Type, AlignLeft,
    DollarSign, Ruler, Eye, CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReceiptConfig {
    businessName: string;
    headerLine1: string;
    headerLine2: string;
    footerLine1: string;
    footerLine2: string;
    showTable: boolean;
    showEmployee: boolean;
    showOrderType: boolean;
    showTicketName: boolean;
    showDateTime: boolean;
    showUSD: boolean;
    showVES: boolean;
    showCOP: boolean;
    paperWidth: number;
}

const DEFAULTS: ReceiptConfig = {
    businessName: 'Enigma Cafe',
    headerLine1: '',
    headerLine2: '',
    footerLine1: 'Gracias por tu visita!',
    footerLine2: 'Las propinas se agradecen',
    showTable: true,
    showEmployee: true,
    showOrderType: false,
    showTicketName: true,
    showDateTime: true,
    showUSD: true,
    showVES: false,
    showCOP: false,
    paperWidth: 32,
};

export default function ReceiptSettings() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<ReceiptConfig>(DEFAULTS);
    const [saved, setSaved] = useState(false);

    const { data: config, isLoading } = useQuery({
        queryKey: ['receipt-config'],
        queryFn: async () => {
            const res = await api.get('/receipt-config');
            return res.data?.data as ReceiptConfig;
        },
    });

    useEffect(() => {
        if (config) setForm(config);
    }, [config]);

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<ReceiptConfig>) => {
            const res = await api.put('/receipt-config', data);
            return res.data?.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['receipt-config'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        },
    });

    const handleSave = () => saveMutation.mutate(form);
    const handleReset = () => setForm(config || DEFAULTS);

    const updateField = <K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const Toggle = ({ label, checked, onChange, description }: {
        label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
    }) => (
        <div className="flex items-center justify-between py-2.5">
            <div>
                <p className="text-sm text-zinc-200">{label}</p>
                {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${checked ? 'bg-emerald-500/80' : 'bg-zinc-700'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
        );
    }

    // Receipt preview
    const previewLines: string[] = [];
    const cols = form.paperWidth;
    const pad = (s: string) => s.padStart(Math.floor((cols - s.length) / 2) + s.length);
    previewLines.push(pad(form.businessName.toUpperCase()));
    if (form.headerLine1) previewLines.push(pad(form.headerLine1));
    if (form.headerLine2) previewLines.push(pad(form.headerLine2));
    previewLines.push('─'.repeat(cols));
    if (form.showTable) previewLines.push('Pedido: Mesa 3');
    if (form.showEmployee) previewLines.push('Empleado: Karla');
    if (form.showTicketName) previewLines.push('Ticket: Mesa 3');
    previewLines.push('─'.repeat(cols));
    previewLines.push('CUENTA');
    previewLines.push('─'.repeat(cols));
    previewLines.push('Cappuccino Latte');
    previewLines.push('  2 x $3.50                $7.00');
    previewLines.push('Panini Capresa');
    previewLines.push('  1 x $5.50                $5.50');
    previewLines.push('─'.repeat(cols));
    previewLines.push(`${'TOTAL'.padEnd(cols - 7)}$12.50`);
    previewLines.push('');
    previewLines.push('─'.repeat(cols));
    if (form.footerLine1) previewLines.push(pad(form.footerLine1));
    if (form.footerLine2) previewLines.push(pad(form.footerLine2));
    if (form.showDateTime) previewLines.push(pad('11/03/2026 2:30 p.m.'));

    return (
        <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#93B59D]/10 flex items-center justify-center">
                        <Printer className="w-5 h-5 text-[#93B59D]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Configuracion de Recibos</h1>
                        <p className="text-sm text-zinc-500">Personaliza el formato de las cuentas impresas</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Deshacer
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="bg-[#93B59D] hover:bg-[#7fa38a] text-black font-semibold"
                    >
                        {saved ? (
                            <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Guardado</>
                        ) : saveMutation.isPending ? (
                            'Guardando...'
                        ) : (
                            <><Save className="w-3.5 h-3.5 mr-1.5" /> Guardar</>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ── Settings Column ── */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Business Identity */}
                    <Card className="bg-zinc-900/50 border-zinc-800 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Type className="w-4 h-4 text-[#93B59D]" />
                            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Identidad</h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Nombre del negocio</label>
                                <Input
                                    value={form.businessName}
                                    onChange={e => updateField('businessName', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                    placeholder="Enigma Cafe"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Linea 1 (subtitulo)</label>
                                <Input
                                    value={form.headerLine1}
                                    onChange={e => updateField('headerLine1', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                    placeholder="Cafe de especialidad"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Linea 2 (direccion, telefono, etc.)</label>
                                <Input
                                    value={form.headerLine2}
                                    onChange={e => updateField('headerLine2', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                    placeholder="Av. Principal #123"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Content Toggles */}
                    <Card className="bg-zinc-900/50 border-zinc-800 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlignLeft className="w-4 h-4 text-blue-400" />
                            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Contenido</h2>
                        </div>
                        <div className="divide-y divide-zinc-800">
                            <Toggle label="Mesa / Pedido" checked={form.showTable} onChange={v => updateField('showTable', v)} description="Mostrar nombre de la mesa" />
                            <Toggle label="Empleado" checked={form.showEmployee} onChange={v => updateField('showEmployee', v)} description="Nombre del mesero que atendio" />
                            <Toggle label="Nombre del ticket" checked={form.showTicketName} onChange={v => updateField('showTicketName', v)} />
                            <Toggle label="Tipo de pedido" checked={form.showOrderType} onChange={v => updateField('showOrderType', v)} description="Comer dentro, llevar, delivery" />
                            <Toggle label="Fecha y hora" checked={form.showDateTime} onChange={v => updateField('showDateTime', v)} />
                        </div>
                    </Card>

                    {/* Footer */}
                    <Card className="bg-zinc-900/50 border-zinc-800 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlignLeft className="w-4 h-4 text-amber-400" />
                            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Pie de recibo</h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Linea 1</label>
                                <Input
                                    value={form.footerLine1}
                                    onChange={e => updateField('footerLine1', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                    placeholder="Gracias por tu visita!"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Linea 2</label>
                                <Input
                                    value={form.footerLine2}
                                    onChange={e => updateField('footerLine2', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                    placeholder="Las propinas se agradecen"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Currency & Paper */}
                    <Card className="bg-zinc-900/50 border-zinc-800 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Monedas y Papel</h2>
                        </div>
                        <div className="divide-y divide-zinc-800">
                            <Toggle label="USD ($)" checked={form.showUSD} onChange={v => updateField('showUSD', v)} description="Dolares americanos" />
                            <Toggle label="VES (Bs)" checked={form.showVES} onChange={v => updateField('showVES', v)} description="Bolivares venezolanos" />
                            <Toggle label="COP ($)" checked={form.showCOP} onChange={v => updateField('showCOP', v)} description="Pesos colombianos" />
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Ruler className="w-3.5 h-3.5 text-zinc-500" />
                                <label className="text-xs text-zinc-500">Ancho de papel</label>
                            </div>
                            <div className="flex gap-2">
                                {[
                                    { value: 32, label: '58mm (32 col)' },
                                    { value: 48, label: '80mm (48 col)' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => updateField('paperWidth', opt.value)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            form.paperWidth === opt.value
                                                ? 'bg-[#93B59D]/15 text-[#93B59D] border border-[#93B59D]/30'
                                                : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ── Preview Column ── */}
                <div className="lg:col-span-2">
                    <div className="sticky top-8">
                        <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-4 h-4 text-zinc-500" />
                            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Vista previa</h2>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-lg mx-auto" style={{ maxWidth: form.paperWidth === 48 ? '320px' : '240px' }}>
                            <pre className="font-mono text-[10px] leading-relaxed text-black whitespace-pre-wrap break-all">
                                {previewLines.join('\n')}
                            </pre>
                        </div>
                        <p className="text-[10px] text-zinc-600 text-center mt-2">
                            Los cambios se aplican en la siguiente impresion
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
