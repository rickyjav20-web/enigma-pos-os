
import { useState, useEffect } from 'react';
import { FileSpreadsheet, Check, AlertCircle, Clock, RefreshCw, Calendar, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function SalesHistoryPage() {
    const [batches, setBatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/sales/batches');
            setBatches(res.data.batches);
        } catch (e) {
            console.error(e);
            alert("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (batchId: string) => {
        if (!confirm("¿Procesar consumo de inventario para este lote?")) return;

        try {
            const res = await api.post('/sales/process-batch', { batchId });
            if (res.data.success) {
                alert(`Procesado correctamente.\nItems descontados: ${res.data.stats.itemsDeducted}`);
                fetchBatches(); // Refresh
            }
        } catch (e: any) {
            alert(`Error: ${e.response?.data?.message || e.message}`);
        }
    };

    return (
        <div className="p-6 text-white min-h-screen">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Clock className="text-enigma-purple w-8 h-8" />
                        Historial de Importaciones
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Gestiona los lotes de ventas importados y su estado de consumo.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/purchases/import-sales')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2"
                >
                    <FileSpreadsheet className="w-4 h-4" /> Importar Nuevo
                </button>
            </header>

            {loading ? (
                <div className="flex justify-center p-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-enigma-purple" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {batches.map((batch) => (
                        <div key={batch.id} className="bg-enigma-gray/50 border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${batch.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                    {batch.status === 'COMPLETED' ? <Check className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{batch.fileName || 'Sin Nombre'}</h3>
                                    <div className="flex gap-4 text-sm text-gray-400 mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(batch.importedAt).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {batch._count?.events || 0} ventas</span>
                                        <span className="font-mono text-white/50">{batch.id.split('-')[0]}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 text-right">
                                <div>
                                    <div className="text-2xl font-bold">${batch.totalSales.toFixed(2)}</div>
                                    <div className={`text-xs font-bold px-2 py-0.5 rounded uppercase inline-block ${batch.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                                        }`}>
                                        {batch.status}
                                    </div>
                                </div>

                                {batch.status === 'PENDING' && (
                                    <button
                                        onClick={() => handleProcess(batch.id)}
                                        className="px-4 py-2 bg-enigma-purple hover:bg-enigma-purple/80 rounded-lg font-bold text-sm shadow animate-pulse"
                                    >
                                        PROCESAR
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {batches.length === 0 && (
                        <div className="text-center p-12 text-gray-500">
                            No hay historial de importaciones.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
