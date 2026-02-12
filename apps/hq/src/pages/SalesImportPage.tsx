
import { useState, useRef } from 'react';
import { Upload, FileText, Check, AlertCircle, RefreshCw, FileSpreadsheet, Settings } from 'lucide-react';
import { api } from '../lib/api';

export default function SalesImportPage() {
    const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    // Preview Data
    const [stats, setStats] = useState({ validCount: 0, warningCount: 0, totalSales: 0 });
    const [rows, setRows] = useState<any[]>([]);
    const [unknownItems, setUnknownItems] = useState<string[]>([]);
    const [columns, setColumns] = useState<any>({});

    // Success Data
    const [batchId, setBatchId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            handlePreview(e.target.files[0]);
        }
    };

    const handlePreview = async (uploadedFile: File) => {
        setLoading(true);
        try {
            const text = await uploadedFile.text();

            const res = await api.post('/sales/preview', {
                csvContent: text
            });

            const data = res.data;
            setStats({
                validCount: data.validCount,
                warningCount: data.warningCount,
                totalSales: data.totalSales
            });
            setRows(data.rows);
            setUnknownItems(data.unknownItems || []);
            setColumns(data.detectedColumns || {});
            setStep('preview');
        } catch (e) {
            console.error(e);
            alert("Error parsing CSV. Please check the format.");
            setFile(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        setLoading(true);
        try {
            const res = await api.post('/sales/commit', {
                fileName: file?.name,
                source: 'Browser Upload',
                events: rows
            });

            if (res.data.success) {
                setBatchId(res.data.batchId);
                setStep('success');
            }
        } catch (e: any) {
            console.error(e);
            alert(`Failed to save batch: ${e.response?.data?.message || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessBatch = async () => {
        if (!batchId) return;
        setLoading(true);
        try {
            const res = await api.post('/sales/process-batch', { batchId });
            if (res.data.success) {
                alert(`¡Éxito! Inventario descontado correctly.\nItems procesados: ${res.data.stats.itemsDeducted}`);
                // Optional: Redirect or reset
                reset();
            }
        } catch (e: any) {
            console.error(e);
            alert(`Error procesando inventario: ${e.response?.data?.message || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('upload');
        setFile(null);
        setRows([]);
        setBatchId(null);
    };

    return (
        <div className="p-6 text-white min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <FileSpreadsheet className="text-enigma-purple w-8 h-8" />
                    Importar Ventas (V2)
                </h1>
                <p className="text-gray-400 mt-2">
                    Sube tu reporte de ventas (Loyverse CSV) para procesar el inventario.
                </p>
            </header>

            <div className="max-w-4xl mx-auto">
                {/* STEP 1: UPLOAD */}
                {step === 'upload' && (
                    <div
                        className="bg-enigma-gray/50 border-2 border-dashed border-white/10 rounded-3xl p-12 text-center hover:border-enigma-purple/50 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileChange}
                        />
                        <div className="w-20 h-20 bg-enigma-purple/20 rounded-full flex items-center justify-center mx-auto mb-6 text-enigma-purple">
                            {loading ? <RefreshCw className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Sube tu CSV de Ventas</h3>
                        <p className="text-gray-400">Arrastra el archivo aquí o haz clic para buscar</p>
                        <p className="text-xs text-gray-500 mt-4">Soporta exportaciones de Loyverse y CSV genéricos</p>
                    </div>
                )}

                {/* STEP 2: PREVIEW */}
                {step === 'preview' && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-enigma-gray/50 p-6 rounded-2xl border border-white/10">
                                <span className="text-gray-400 text-sm">Total Ventas Detectadas</span>
                                <div className="text-3xl font-bold text-white mt-2">
                                    ${stats.totalSales.toFixed(2)}
                                </div>
                            </div>
                            <div className="bg-green-500/10 p-6 rounded-2xl border border-green-500/20">
                                <span className="text-green-400 text-sm">Productos Reconocidos</span>
                                <div className="text-3xl font-bold text-green-400 mt-2">
                                    {stats.validCount}
                                </div>
                            </div>
                            <div className={`p-6 rounded-2xl border ${stats.warningCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-enigma-gray/50 border-white/10'}`}>
                                <span className={`${stats.warningCount > 0 ? 'text-amber-400' : 'text-gray-400'} text-sm`}>Productos Desconocidos</span>
                                <div className={`text-3xl font-bold mt-2 ${stats.warningCount > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                                    {stats.warningCount}
                                </div>
                            </div>
                        </div>

                        {/* Unknown Items Warning */}
                        {unknownItems.length > 0 && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Atención: {unknownItems.length} SKUs no encontrados en el catálogo</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {unknownItems.slice(0, 10).map((sku, i) => (
                                        <span key={i} className="px-2 py-1 bg-amber-500/20 rounded text-amber-300 text-xs font-mono">
                                            {sku || 'N/A'}
                                        </span>
                                    ))}
                                    {unknownItems.length > 10 && <span className="text-xs text-amber-400 pt-1">...y {unknownItems.length - 10} más</span>}
                                </div>
                                <p className="text-xs text-amber-400/70 mt-2">
                                    Estos productos se guardarán en el historial pero <strong>NO descontarán inventario</strong> hasta que se configuren.
                                </p>
                            </div>
                        )}

                        {/* Valid Rows Preview */}
                        <div className="bg-enigma-gray/50 rounded-2xl border border-white/10 overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" /> Vista Previa (Top 50)
                                </h3>
                                <div className="text-xs text-gray-500 font-mono">
                                    SKU Col: {columns.colSku} | Qty Col: {columns.colQty}
                                </div>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-400 uppercase bg-white/5 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">SKU</th>
                                            <th className="px-4 py-3">Producto</th>
                                            <th className="px-4 py-3 text-right">Cant.</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.sku || '-'}</td>
                                                <td className="px-4 py-3 font-medium text-white">{row.productName}</td>
                                                <td className="px-4 py-3 text-right">{row.quantity}</td>
                                                <td className="px-4 py-3 text-right">${row.total.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.status === 'VALID' ? (
                                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Válido"></span>
                                                    ) : (
                                                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title="Desconocido"></span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={reset}
                                className="px-6 py-4 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCommit}
                                disabled={loading}
                                className="flex-1 px-6 py-4 rounded-xl font-bold bg-enigma-purple hover:bg-enigma-purple/80 text-white shadow-lg shadow-enigma-purple/20 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                CONFIRMAR IMPORTACIÓN
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 'success' && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-12 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400">
                            <Check className="w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">¡Lote Guardado!</h3>
                        <p className="text-green-200/70 mb-8">
                            Se ha registrado el Batch ID: <span className="font-mono bg-black/20 px-2 rounded">{batchId?.split('-')[0]}...</span>
                        </p>

                        <div className="bg-enigma-gray/50 p-6 rounded-xl border border-white/5 mb-8 max-w-lg mx-auto">
                            <h4 className="font-bold text-white mb-2 flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 text-enigma-purple" /> Siguiente Paso: Consumo
                            </h4>
                            <p className="text-sm text-gray-400">
                                Los datos de ventas están seguros. Ahora debes procesar el consumo para descontar los ingredientes del inventario base.
                            </p>
                        </div>

                        <div className="flex justify-center gap-4 flex-wrap">
                            <button
                                onClick={reset}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-gray-300"
                            >
                                Subir Otro Archivo
                            </button>

                            <button
                                onClick={handleProcessBatch}
                                disabled={loading}
                                className="px-8 py-3 bg-enigma-purple hover:bg-enigma-purple/80 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-enigma-purple/20 text-white"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                                PROCESAR INVENTARIO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

