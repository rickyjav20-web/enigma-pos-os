
import React, { useState } from 'react';
import { Upload, FileText, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://enigma-pos-os-production.up.railway.app/api/v1';

export default function SalesImportPage() {
    const { tenant } = useAuth();
    const [rawText, setRawText] = useState('');
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const parseText = () => {
        // Simple parser: Name, Quantity (Tab or Comma separated)
        const lines = rawText.split('\n').filter(l => l.trim());
        const parsed = lines.map(line => {
            // Try comma first, then tab
            let parts = line.split(',');
            if (parts.length < 2) parts = line.split('\t');

            if (parts.length >= 2) {
                return {
                    productName: parts[0].trim(),
                    quantity: parseFloat(parts[1].trim()) || 0
                };
            }
            return null;
        }).filter(Boolean);

        setPreviewData(parsed);
        setResult(null);
    };

    const executeImport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/sales/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenant?.id || 'enigma_hq'
                },
                body: JSON.stringify({ sales: previewData })
            });

            const data = await res.json();
            setResult(data);
        } catch (e) {
            console.error(e);
            alert("Error importing sales");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 text-white min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Upload className="text-enigma-purple" />
                    Importar Ventas Diarias
                </h1>
                <p className="text-gray-400 mt-2">
                    Copia y pega tu reporte de ventas (Producto, Cantidad) para descontar inventario masivamente.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="bg-enigma-gray/50 p-6 rounded-2xl border border-white/10">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5" /> Datos de Venta
                    </h2>
                    <textarea
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        placeholder={`Ejemplo:\nBrownie, 20\nGalleta, 5\nLatte, 10`}
                        className="w-full h-64 bg-black/30 border border-white/10 rounded-xl p-4 font-mono text-sm text-white focus:outline-none focus:border-enigma-purple resize-none"
                    />
                    <button
                        onClick={parseText}
                        disabled={!rawText.trim()}
                        className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        Previsualizar
                    </button>
                </div>

                {/* Preview & Result Section */}
                <div className="bg-enigma-gray/50 p-6 rounded-2xl border border-white/10">
                    {result ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-2 text-green-400 text-lg font-bold">
                                <Check className="w-6 h-6" /> Importación Completada
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
                                    <p className="text-2xl font-bold text-green-400">{result.successCount}</p>
                                    <p className="text-sm text-green-200/50">Productos Procesados</p>
                                </div>
                                <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 text-center">
                                    <p className="text-2xl font-bold text-red-400">{result.failedCount}</p>
                                    <p className="text-sm text-red-200/50">Errores</p>
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 max-h-48 overflow-y-auto">
                                    <h4 className="text-xs font-bold text-red-400 mb-2 uppercase">Detalle de Errores</h4>
                                    <ul className="space-y-1">
                                        {result.errors.map((err: string, i: number) => (
                                            <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                                                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                                {err}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={() => { setResult(null); setRawText(''); setPreviewData([]); }}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> Nueva Importación
                            </button>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Vista Previa</h2>
                            {previewData.length > 0 ? (
                                <>
                                    <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
                                        {previewData.map((item, i) => (
                                            <div key={i} className="flex justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                                <span>{item.productName}</span>
                                                <span className="font-mono text-enigma-green">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={executeImport}
                                        disabled={loading}
                                        className="w-full py-4 bg-enigma-purple hover:bg-enigma-purple/80 rounded-xl font-bold transition-all shadow-lg shadow-enigma-purple/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                        EJECUTAR DESCUENTO DE INVENTARIO
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-12 text-white/20 italic">
                                    Pega los datos para visualizar la tabla...
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

