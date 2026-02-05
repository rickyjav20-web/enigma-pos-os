import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Clock, AlertCircle, Database } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
    const [activeShifts, setActiveShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    // Poll for updates
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // 10s poll
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            // Mock headers or real implementation
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };

            const [shiftsRes, empRes] = await Promise.all([
                axios.get('/api/shifts/active', config),
                axios.get('/api/employees', config)
            ]);

            setActiveShifts(shiftsRes.data.shifts);
            setEmployees(empRes.data.employees);
        } catch (e) {
            console.error("Fetch Error", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBackup = async () => {
        if (!confirm('¿Generar copia de seguridad completa del sistema?')) return;

        try {
            const res = await axios.get('http://localhost:3005/admin/backup-full', {
                headers: { 'x-admin-secret': 'ENIGMA_MASTER_2026' }
            });

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Enigma_Backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            alert('Copia de seguridad descargada exitosamente.');
        } catch (e) {
            console.error("Backup failed", e);
            alert('Error al generar respaldo.');
        }
    };

    return (
        <div className="min-h-screen bg-enigma-black text-white p-8 font-sans">
            <header className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Enigma Staff <span className="text-enigma-purple">Dashboard</span></h1>
                    <p className="text-white/40 text-sm mt-1">Status: Live Monitor</p>
                </div>
                <div className="px-4 py-2 bg-enigma-gray rounded-full border border-white/10 text-xs font-mono text-green-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    SYSTEM ONLINE
                </div>
                <button
                    onClick={handleBackup}
                    className="ml-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
                    title="Copia de Seguridad (Super Admin)"
                >
                    <Database className="w-4 h-4" />
                </button>
            </header >

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Active Floor */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-medium flex items-center gap-2">
                        <Clock className="w-5 h-5 text-enigma-purple" />
                        Live Floor
                    </h2>

                    <div className="bg-enigma-gray/30 rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-xs uppercase text-white/50">
                                <tr>
                                    <th className="p-4">Empleado</th>
                                    <th className="p-4">Entrada</th>
                                    <th className="p-4">Tiempo Activo</th>
                                    <th className="p-4">Mood</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-white/30">Cargando...</td></tr>
                                ) : activeShifts.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-white/30">No hay personal activo.</td></tr>
                                ) : (
                                    activeShifts.map((shift) => (
                                        <tr key={shift.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 font-medium flex items-center gap-3">
                                                {shift.photoUrl ? (
                                                    <img src={shift.photoUrl} className="w-8 h-8 rounded-full object-cover border border-white/10" alt="evidence" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                                        {shift.employee.fullName[0]}
                                                    </div>
                                                )}
                                                {shift.employee.fullName}
                                            </td>
                                            <td className="p-4 text-white/60 text-sm">
                                                {new Date(shift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 text-green-400 font-mono text-sm">
                                                {formatDistanceToNow(new Date(shift.clockIn), { locale: es })}
                                            </td>
                                            <td className="p-4 text-2xl">
                                                {shift.mood === 'HAPPY' && '😊'}
                                                {shift.mood === 'NEUTRAL' && '😐'}
                                                {shift.mood === 'TIRED' && '😫'}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                                                    Active
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Col: Stats / Quick Actions */}
                <div className="space-y-6">
                    <h2 className="text-xl font-medium flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        Acciones Rápidas
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <a href="/employees" className="p-4 bg-enigma-gray/30 border border-white/10 rounded-2xl hover:bg-white/5 transition-all text-center group">
                            <div className="w-10 h-10 bg-enigma-purple/20 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-enigma-purple/30">
                                <User className="w-5 h-5 text-enigma-purple" />
                            </div>
                            <span className="text-sm font-medium text-white/80">Empleados</span>
                        </a>
                        <a href="/history" className="p-4 bg-enigma-gray/30 border border-white/10 rounded-2xl hover:bg-white/5 transition-all text-center group">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-500/30">
                                <Clock className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-white/80">Historial</span>
                        </a>
                        <a href="/scheduler" className="p-4 bg-enigma-gray/30 border border-white/10 rounded-2xl hover:bg-white/5 transition-all text-center group col-span-2">
                            <div className="flex items-center justify-center gap-3 mb-1">
                                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30">
                                    <Clock className="w-4 h-4 text-purple-400" />
                                </div>
                                <span className="text-sm font-medium text-white/80">Planificador de Horarios</span>
                            </div>
                        </a>
                    </div>

                    <div className="bg-enigma-gray/30 rounded-2xl border border-white/5 p-6">
                        <h3 className="text-white/50 text-sm uppercase mb-4">Resumen</h3>
                        <div className="flex justify-between py-2 border-b border-white/5">
                            <span className="text-white/70">Total Empleados</span>
                            <span className="font-mono">{employees.length}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                            <span className="text-white/70">En Turno</span>
                            <span className="font-mono text-green-400">{activeShifts.length}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span className="text-white/70">Ausentes</span>
                            <span className="font-mono text-white/30">{employees.length - activeShifts.length}</span>
                        </div>
                    </div>
                </div>
            </main>
        </div >
    );
}
