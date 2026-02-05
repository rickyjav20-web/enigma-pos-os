import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, Clock, Image, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ShiftHistory() {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };
            const res = await axios.get('/api/shifts/history', config);
            setShifts(res.data.shifts);
        } catch (e) {
            console.error("Error fetching history", e);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-VE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDuration = (start, end) => {
        if (!start || !end) return '-';
        const diff = new Date(end) - new Date(start);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="min-h-screen bg-enigma-black text-white p-8 font-sans">
            <header className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Historial de <span className="text-enigma-purple">Turnos</span></h1>
                        <p className="text-white/40 text-sm mt-1">Últimos movimientos registrados</p>
                    </div>
                </div>
                {/* Future: Date Range Picker */}
            </header>

            <div className="bg-enigma-gray/20 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs uppercase text-white/40 font-medium">
                        <tr>
                            <th className="p-5">Empleado</th>
                            <th className="p-5">Entrada</th>
                            <th className="p-5">Salida</th>
                            <th className="p-5">Duración</th>
                            <th className="p-5">Feel (In/Out)</th>
                            <th className="p-5">Evidencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-white/30">Cargando historial...</td></tr>
                        ) : shifts.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-white/30">No hay turnos cerrados aún.</td></tr>
                        ) : (
                            shifts.map((s) => (
                                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-5 font-medium text-white">
                                        {s.employee.fullName}
                                    </td>
                                    <td className="p-5 text-sm text-white/70">
                                        {formatDate(s.clockIn)}
                                    </td>
                                    <td className="p-5 text-sm text-white/70">
                                        {formatDate(s.clockOut)}
                                    </td>
                                    <td className="p-5 font-mono text-green-400 text-sm">
                                        {getDuration(s.clockIn, s.clockOut)}
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="opacity-70">{s.mood || '-'}</span>
                                            <span className="text-white/20">→</span>
                                            <span className="opacity-70">{s.exitMood || '-'}</span>
                                        </div>
                                        {s.comments && (
                                            <div className="text-[10px] text-white/40 max-w-[150px] truncate mt-1 italic">
                                                "{s.comments}"
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        {s.photoUrl ? (
                                            <div className="relative group w-12 h-12 rounded-lg overflow-hidden border border-white/10 cursor-pointer">
                                                <img src={s.photoUrl} className="w-full h-full object-cover" alt="Check-in" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Image className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-white/20 text-xs">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
