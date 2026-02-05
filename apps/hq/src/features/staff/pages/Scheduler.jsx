import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export default function Scheduler() {
    const [employees, setEmployees] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [viewDate, setViewDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null); // For week view click
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Time slots: 6:00 AM to 12:00 AM (18 hours)
    const START_HOUR = 6;
    const END_HOUR = 24;
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

    useEffect(() => {
        fetchData();
    }, [viewDate, viewMode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let start, end;

            if (viewMode === 'day') {
                start = new Date(viewDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(viewDate);
                end.setHours(23, 59, 59, 999);
            } else {
                // Get start of week (Sunday)
                start = new Date(viewDate);
                start.setDate(viewDate.getDate() - viewDate.getDay());
                start.setHours(0, 0, 0, 0);

                // Get end of week (Saturday)
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
            }

            const [empRes, schRes] = await Promise.all([
                api.get('/employees'),
                api.get(`/schedules?start=${start.toISOString()}&end=${end.toISOString()}`)
            ]);

            setEmployees(empRes.data.employees.filter(e => e.status === 'active'));
            setSchedules(schRes.data.schedules);
        } catch (e) {
            console.error("Fetch scheduler error", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrev = () => {
        const d = new Date(viewDate);
        if (viewMode === 'day') d.setDate(d.getDate() - 1);
        else d.setDate(d.getDate() - 7);
        setViewDate(d);
    };

    const handleNext = () => {
        const d = new Date(viewDate);
        if (viewMode === 'day') d.setDate(d.getDate() + 1);
        else d.setDate(d.getDate() + 7);
        setViewDate(d);
    };

    const handleAutoFill = async () => {
        if (!confirm(viewMode === 'day' ? "¿Importar horarios fijos para este día?" : "¿Importar horarios fijos para TODA la semana?")) return;

        try {
            setLoading(true);
            let start, end;

            if (viewMode === 'day') {
                start = new Date(viewDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(viewDate);
                end.setHours(23, 59, 59, 999);
            } else {
                start = new Date(viewDate);
                start.setDate(viewDate.getDate() - viewDate.getDay());
                start.setHours(0, 0, 0, 0);

                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
            }

            await api.post('/schedules/autofill', {
                start: start.toISOString(),
                end: end.toISOString()
            });

            fetchData();
        } catch (e) {
            console.error(e);
            alert("Error al importar horarios");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, e) => {
        e?.stopPropagation();
        if (!confirm("¿Eliminar turno?")) return;
        try {
            await api.delete(`/schedules/${id}`);
            fetchData();
        } catch (err) { console.error(err); }
    }

    // Helper to get days of current week
    const getWeekDays = () => {
        const days = [];
        const start = new Date(viewDate);
        start.setDate(viewDate.getDate() - viewDate.getDay()); // Sunday
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const weekDays = getWeekDays();

    return (
        <div className="min-h-screen bg-enigma-black text-white p-4 lg:p-8 font-sans overflow-x-hidden">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/staff')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Planificador de <span className="text-enigma-purple">Horarios</span></h1>
                        <p className="text-white/40 text-sm mt-1 flex items-center gap-2">
                            <span className={clsx("cursor-pointer hover:text-white transition-colors", viewMode === 'day' && "text-enigma-purple font-bold")} onClick={() => setViewMode('day')}>Diario</span>
                            /
                            <span className={clsx("cursor-pointer hover:text-white transition-colors", viewMode === 'week' && "text-enigma-purple font-bold")} onClick={() => setViewMode('week')}>Semanal</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-enigma-gray/30 p-2 rounded-xl border border-white/10">
                    <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="flex items-center gap-2 px-2 min-w-[150px] justify-center">
                        <CalendarIcon className="w-4 h-4 text-enigma-purple" />
                        <span className="font-mono pt-1 text-sm">
                            {viewMode === 'day'
                                ? viewDate.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'long' })
                                : `Semana del ${weekDays[0].getDate()}`
                            }
                        </span>
                    </div>
                    <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleAutoFill}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full font-medium transition-all text-sm flex items-center gap-2"
                        title="Generar turnos basados en Horario Fijo"
                    >
                        <CalendarIcon className="w-4 h-4 text-white/50" />
                        Importar Base
                    </button>
                    <button
                        onClick={() => { setSelectedEmployee(null); setSelectedSlot(null); setIsModalOpen(true); }}
                        className="px-6 py-2 bg-enigma-purple hover:bg-enigma-purple/90 text-white rounded-full font-medium transition-all flex items-center gap-2 shadow-lg shadow-enigma-purple/20"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar
                    </button>
                </div>
            </header>

            {/* VIEWS */}
            {viewMode === 'day' ? (
                /* --- DAY VIEW (TIMELINE) --- */
                <div className="bg-enigma-gray/20 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar">
                    <div className="min-w-[1000px]">
                        <div className="grid grid-cols-[200px_1fr] border-b border-white/10 sticky top-0 bg-enigma-black/90 z-10 backdrop-blur-sm">
                            <div className="p-4 text-xs uppercase text-white/30 font-bold tracking-wider border-r border-white/10 flex items-center">Empleado</div>
                            <div className="grid" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                                {hours.map(h => <div key={h} className="text-xs text-white/30 border-l border-white/5 p-2 text-center">{h}:00</div>)}
                            </div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {loading ? <div className="p-10 text-center text-white/30">Cargando...</div> : employees.map(emp => (
                                <div key={emp.id} className="grid grid-cols-[200px_1fr] hover:bg-white/5 transition-colors group h-20">
                                    <div className="p-4 flex items-center gap-3 border-r border-white/10">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 text-xs">{emp.fullName[0]}</div>
                                        <div className="truncate"><div className="text-sm font-medium text-white">{emp.fullName}</div><div className="text-[10px] text-white/40">{emp.role}</div></div>
                                    </div>
                                    <div className="relative border-l border-white/5 bg-white/[0.01]">
                                        <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                                            {hours.map(h => <div key={h} className="border-l border-white/5 h-full" />)}
                                        </div>
                                        {schedules.filter(s => s.employeeId === emp.id).map(sched => {
                                            const start = new Date(sched.startTime);
                                            const end = new Date(sched.endTime);
                                            const startH = start.getHours() + (start.getMinutes() / 60);
                                            const endH = end.getHours() + (end.getMinutes() / 60);
                                            if (endH < START_HOUR || startH > END_HOUR) return null;
                                            const visibleStart = Math.max(startH, START_HOUR);
                                            const visibleEnd = Math.min(endH, END_HOUR);
                                            const left = ((visibleStart - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
                                            const width = ((visibleEnd - visibleStart) / (END_HOUR - START_HOUR)) * 100;
                                            return (
                                                <div key={sched.id} className="absolute top-2 bottom-2 rounded-lg bg-gradient-to-r from-enigma-purple to-indigo-600 border border-white/20 shadow-lg flex items-center px-2 overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer group/block" style={{ left: `${left}%`, width: `${width}%` }}>
                                                    <div className="text-[10px] font-bold text-white whitespace-nowrap">{start.getHours()}:{start.getMinutes().toString().padStart(2, '0')} - {end.getHours()}:{end.getMinutes().toString().padStart(2, '0')}</div>
                                                    <button onClick={(e) => handleDelete(sched.id, e)} className="ml-auto opacity-0 group-hover/block:opacity-100 p-1 hover:bg-black/20 rounded"><Trash2 className="w-3 h-3 text-white" /></button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- WEEK VIEW (GRID) --- */
                <div className="bg-enigma-gray/20 rounded-2xl border border-white/5 overflow-x-auto custom-scrollbar">
                    <div className="min-w-[1200px]">
                        <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-white/10 bg-enigma-black/90 z-10 sticky top-0 backdrop-blur-sm">
                            <div className="p-4 text-xs uppercase text-white/30 font-bold tracking-wider border-r border-white/10 flex items-center">Empleado</div>
                            {weekDays.map(d => (
                                <div key={d.toISOString()} className={clsx("p-4 text-center border-l border-white/5", d.toDateString() === new Date().toDateString() && "bg-enigma-purple/10")}>
                                    <div className="text-xs uppercase text-white/30 font-bold">{d.toLocaleDateString('es-VE', { weekday: 'short' })}</div>
                                    <div className="text-lg font-mono text-white/80">{d.getDate()}</div>
                                </div>
                            ))}
                        </div>
                        <div className="divide-y divide-white/5">
                            {loading ? <div className="p-10 text-center text-white/30">Cargando semana...</div> : employees.map(emp => (
                                <div key={emp.id} className="grid grid-cols-[200px_repeat(7,1fr)] hover:bg-white/5 transition-colors">
                                    <div className="p-4 flex items-center gap-3 border-r border-white/10 min-h-[100px]">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 text-xs">{emp.fullName[0]}</div>
                                        <div className="truncate"><div className="text-sm font-medium text-white">{emp.fullName}</div><div className="text-[10px] text-white/40">{emp.role}</div></div>
                                    </div>
                                    {weekDays.map(day => {
                                        // Find shifts for this employee on this day
                                        const dayShifts = schedules.filter(s => {
                                            if (s.employeeId !== emp.id) return false;
                                            const sDate = new Date(s.startTime);
                                            return sDate.getDate() === day.getDate() && sDate.getMonth() === day.getMonth();
                                        });

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className="border-l border-white/5 p-2 relative group-cell cursor-pointer hover:bg-white/5 transition-colors"
                                                onClick={() => { setSelectedEmployee(emp.id); setSelectedSlot({ date: day }); setIsModalOpen(true); }}
                                            >
                                                <div className="space-y-2">
                                                    {dayShifts.map(s => (
                                                        <div key={s.id} onClick={(e) => { e.stopPropagation(); }} className="bg-enigma-purple/20 border border-enigma-purple/30 rounded p-2 text-xs hover:bg-enigma-purple/30 transition-colors group relative">
                                                            <div className="font-mono text-enigma-purple font-bold">
                                                                {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <button onClick={(e) => handleDelete(s.id, e)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                    {dayShifts.length === 0 && <div className="h-full flex items-center justify-center opacity-0 group-cell-hover:opacity-100 text-white/20 text-xl font-thin">+</div>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <ScheduleModal
                    employees={employees}
                    preSelectedEmp={selectedEmployee}
                    date={selectedSlot?.date || viewDate}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => { setIsModalOpen(false); fetchData(); }}
                />
            )}
        </div>
    );
}

function ScheduleModal({ employees, preSelectedEmp, date, onClose, onSuccess }) {
    const [empId, setEmpId] = useState(preSelectedEmp || (employees[0]?.id || ''));
    const [start, setStart] = useState('09:00');
    const [end, setEnd] = useState('17:00');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Build Date objects
        const sDate = new Date(date);
        const [sh, sm] = start.split(':');
        sDate.setHours(sh, sm, 0);

        const eDate = new Date(date);
        const [eh, em] = end.split(':');
        eDate.setHours(eh, em, 0);

        try {
            await api.post('/schedules', {
                employeeId: empId,
                startTime: sDate,
                endTime: eDate,
                note: ''
            });
            onSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-enigma-black border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">Asignar Turno</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase text-white/40 mb-1">Empleado</label>
                        <select
                            value={empId}
                            onChange={e => setEmpId(e.target.value)}
                            className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple"
                        >
                            {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs uppercase text-white/40 mb-1">Entrada</label>
                            <input
                                type="time"
                                value={start}
                                onChange={e => setStart(e.target.value)}
                                className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-white/40 mb-1">Salida</label>
                            <input
                                type="time"
                                value={end}
                                onChange={e => setEnd(e.target.value)}
                                className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-enigma-purple hover:bg-enigma-purple/90 rounded-xl text-white font-bold transition-colors">
                            {loading ? '...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
