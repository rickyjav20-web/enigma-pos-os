import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { User, Clock, AlertCircle, Database, Users, Calendar, Activity } from 'lucide-react';
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
            const [shiftsRes, empRes] = await Promise.all([
                api.get('/shifts/active'),
                api.get('/employees')
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
            const res = await api.get('/admin/backup-full', {
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
        <div className="space-y-8 animate-fade-in">
            {/* Ambient Glows */}
            <div className="fixed top-0 left-0 w-full h-96 bg-enigma-purple/10 blur-[120px] rounded-full pointer-events-none -z-10" />

            {/* Header Section */}
            <header className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Live Floor</h1>
                    <p className="text-enigma-text-secondary">Overview of active staff and real-time shifts</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-full border border-enigma-green-glow bg-enigma-green-glow/10 text-xs font-mono text-enigma-green flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-enigma-green animate-pulse shadow-[0_0_10px_#10b981]" />
                        SYSTEM ONLINE
                    </div>
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Col: Active Floor (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="glass-panel rounded-3xl overflow-hidden p-1">
                        <table className="w-full text-left">
                            <thead className="text-xs uppercase text-enigma-text-muted font-medium tracking-wider">
                                <tr>
                                    <th className="p-6 pb-4">Specialist</th>
                                    <th className="p-6 pb-4">Check In</th>
                                    <th className="p-6 pb-4">Duration</th>
                                    <th className="p-6 pb-4">Mood</th>
                                    <th className="p-6 pb-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="5" className="p-12 text-center text-enigma-text-muted">Syncing floor data...</td></tr>
                                ) : activeShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center">
                                            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Clock className="w-8 h-8 text-white/20" />
                                            </div>
                                            <p className="text-enigma-text-secondary">No active personnel on the floor.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    activeShifts.map((shift) => (
                                        <tr key={shift.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="p-6 font-medium flex items-center gap-4 text-white">
                                                <div className="relative">
                                                    {shift.photoUrl ? (
                                                        <img src={shift.photoUrl} className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" alt="evidence" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold ring-2 ring-white/10">
                                                            {shift.employee.fullName[0]}
                                                        </div>
                                                    )}
                                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-enigma-green border-2 border-black rounded-full" />
                                                </div>
                                                <span className="group-hover:text-glow transition-all duration-300">{shift.employee.fullName}</span>
                                            </td>
                                            <td className="p-6 text-enigma-text-secondary font-mono text-sm">
                                                {new Date(shift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-6 text-enigma-green font-mono text-sm font-medium">
                                                {formatDistanceToNow(new Date(shift.clockIn), { locale: es })}
                                            </td>
                                            <td className="p-6 text-2xl filter grayscale group-hover:grayscale-0 transition-all duration-300">
                                                {shift.mood === 'HAPPY' && '😊'}
                                                {shift.mood === 'NEUTRAL' && '😐'}
                                                {shift.mood === 'TIRED' && '😫'}
                                            </td>
                                            <td className="p-6">
                                                <span className="px-3 py-1 rounded-full bg-enigma-green/10 text-enigma-green text-xs font-medium border border-enigma-green/20">
                                                    On Duty
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Col: Operations (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Compact Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users className="w-16 h-16 text-white" />
                            </div>
                            <span className="text-enigma-text-muted text-sm font-medium uppercase tracking-wider">Total Staff</span>
                            <span className="text-4xl font-bold text-white tracking-tighter group-hover:text-glow transition-all">{employees.length}</span>
                        </div>
                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group border-enigma-green/20">
                            <div className="absolute inset-0 bg-enigma-green/5 group-hover:bg-enigma-green/10 transition-colors" />
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-enigma-green">
                                <Activity className="w-16 h-16" />
                            </div>
                            <span className="text-enigma-text-muted text-sm font-medium uppercase tracking-wider relative z-10">Active Flex</span>
                            <span className="text-4xl font-bold text-enigma-green tracking-tighter relative z-10">{activeShifts.length}</span>
                        </div>
                    </div>

                    {/* Quick Command Control */}
                    <div className="glass-panel p-6 rounded-3xl space-y-4">
                        <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-enigma-purple" />
                            Command Center
                        </h3>

                        <div className="grid grid-cols-1 gap-3">
                            <Link to="/staff/employees" className="group relative overflow-hidden rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-enigma-purple/30">
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-lg bg-enigma-purple/20 flex items-center justify-center text-enigma-purple group-hover:scale-110 transition-transform duration-300">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-medium group-hover:text-glow-purple transition-all">Manage Directory</h4>
                                        <p className="text-xs text-enigma-text-secondary">View and edit staff profiles</p>
                                    </div>
                                </div>
                            </Link>

                            <Link to="/staff/history" className="group relative overflow-hidden rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-blue-500/30">
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-300">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-medium group-hover:text-blue-200 transition-all">Shift Logs</h4>
                                        <p className="text-xs text-enigma-text-secondary">Audit clock-ins and outs</p>
                                    </div>
                                </div>
                            </Link>

                            <button
                                onClick={handleBackup}
                                className="w-full group relative overflow-hidden rounded-xl p-4 bg-red-500/5 hover:bg-red-500/10 transition-all border border-white/5 hover:border-red-500/30 text-left"
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform duration-300">
                                        <Database className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-medium group-hover:text-red-200 transition-all">System Backup</h4>
                                        <p className="text-xs text-enigma-text-secondary">Dump full SQL snapshot</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
