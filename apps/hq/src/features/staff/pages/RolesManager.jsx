import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Shield, Plus, Trash2, Edit2, Check, X, ArrowLeft, Monitor, LayoutDashboard, Clock, AlertCircle, Lock, ChefHat } from 'lucide-react';

const SYSTEM_ICONS = {
    ops: Monitor,
    hq: LayoutDashboard,
    kiosk: Clock,
    kitchen: ChefHat,
};

const SYSTEM_LABELS = {
    ops: 'Caja (OPS)',
    hq: 'Oficina (HQ)',
    kiosk: 'Kiosko',
    kitchen: 'Cocina',
};

export default function RolesManager() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [showCreate, setShowCreate] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', description: '', color: '#8b5cf6', canAccessOps: false, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: false });
    const [error, setError] = useState('');
    const [employeeCounts, setEmployeeCounts] = useState({});

    useEffect(() => { fetchRoles(); fetchEmployeeCounts(); }, []);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            setRoles(res.data.roles);
        } catch (e) {
            console.error('Failed to load roles', e);
            // If roles endpoint doesn't exist yet, seed first
            if (e.response?.status === 404) {
                await seedRoles();
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeCounts = async () => {
        try {
            const res = await api.get('/employees');
            const counts = {};
            (res.data.employees || []).forEach(emp => {
                counts[emp.role] = (counts[emp.role] || 0) + 1;
            });
            setEmployeeCounts(counts);
        } catch (e) { console.error(e); }
    };

    const seedRoles = async () => {
        try {
            await api.post('/roles/seed');
            await fetchRoles();
        } catch (e) { console.error('Seed failed', e); }
    };

    const handleCreate = async () => {
        if (!newRole.name.trim()) { setError('El nombre del rol es requerido'); return; }
        setError('');
        try {
            await api.post('/roles', newRole);
            setShowCreate(false);
            setNewRole({ name: '', description: '', color: '#8b5cf6', canAccessOps: false, canAccessHq: false, canAccessKiosk: true, canAccessKitchen: false });
            fetchRoles();
        } catch (e) {
            setError(e.response?.data?.error || 'Error al crear rol');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await api.patch(`/roles/${id}`, editData);
            setEditingId(null);
            fetchRoles();
        } catch (e) {
            setError(e.response?.data?.error || 'Error al actualizar');
        }
    };

    const handleDelete = async (role) => {
        if (role.isSystem) return;
        if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/roles/${role.id}`);
            fetchRoles();
        } catch (e) {
            setError(e.response?.data?.error || 'Error al eliminar');
        }
    };

    const handleToggle = async (role, field) => {
        try {
            await api.patch(`/roles/${role.id}`, { [field]: !role[field] });
            fetchRoles();
        } catch (e) {
            setError(e.response?.data?.error || 'Error al actualizar');
        }
    };

    const startEdit = (role) => {
        setEditingId(role.id);
        setEditData({ name: role.name, description: role.description || '', color: role.color });
    };

    const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <Link to="/staff" className="text-enigma-text-muted hover:text-white text-sm flex items-center gap-1 mb-3 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Staff
                    </Link>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-enigma-purple" />
                        Roles & Access Control
                    </h1>
                    <p className="text-enigma-text-secondary">Manage roles and their system-level permissions</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={seedRoles}
                        className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
                    >
                        Reset Defaults
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-6 py-2.5 rounded-xl bg-enigma-purple hover:bg-enigma-purple-glow text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-enigma-purple/20"
                    >
                        <Plus className="w-4 h-4" /> New Role
                    </button>
                </div>
            </header>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="w-4 h-4" /> {error}
                    <button onClick={() => setError('')} className="ml-auto hover:text-white"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="glass-panel rounded-3xl p-8 animate-fade-in border border-enigma-purple/20">
                    <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-enigma-purple" /> Create New Role
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Role Name *</label>
                            <input
                                type="text"
                                value={newRole.name}
                                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-enigma-purple transition-all"
                                placeholder="e.g. Delivery, Supervisor"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Description</label>
                            <input
                                type="text"
                                value={newRole.description}
                                onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                                className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-enigma-purple transition-all"
                                placeholder="Brief role description"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Badge Color</label>
                            <div className="flex gap-2 items-center">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setNewRole({ ...newRole, color: c })}
                                        className={`w-8 h-8 rounded-lg transition-all ${newRole.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Permission toggles */}
                    <div className="mb-6">
                        <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-3">System Access</label>
                        <div className="flex gap-4">
                            {Object.entries(SYSTEM_LABELS).map(([key, label]) => {
                                const Icon = SYSTEM_ICONS[key];
                                const field = `canAccess${key.charAt(0).toUpperCase() + key.slice(1)}`;
                                const isOn = newRole[field];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setNewRole({ ...newRole, [field]: !isOn })}
                                        className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${isOn
                                            ? 'bg-enigma-green/10 border-enigma-green/30 text-enigma-green'
                                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-sm font-medium">{label}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 transition-all ${isOn ? 'border-enigma-green bg-enigma-green' : 'border-white/20'}`}>
                                            {isOn && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowCreate(false)} className="px-6 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 text-sm font-medium transition-all">Cancel</button>
                        <button onClick={handleCreate} className="px-6 py-2.5 rounded-xl bg-enigma-purple hover:bg-enigma-purple-glow text-white font-bold text-sm transition-all">Create Role</button>
                    </div>
                </div>
            )}

            {/* Roles Table */}
            <div className="glass-panel rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="text-xs uppercase text-enigma-text-muted font-medium tracking-wider border-b border-white/5">
                        <tr>
                            <th className="p-6 pb-4">Role</th>
                            <th className="p-6 pb-4">Description</th>
                            <th className="p-6 pb-4 text-center">
                                <div className="flex items-center justify-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> OPS</div>
                            </th>
                            <th className="p-6 pb-4 text-center">
                                <div className="flex items-center justify-center gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> HQ</div>
                            </th>
                            <th className="p-6 pb-4 text-center">
                                <div className="flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Kiosk</div>
                            </th>
                            <th className="p-6 pb-4 text-center">
                                <div className="flex items-center justify-center gap-1.5"><ChefHat className="w-3.5 h-3.5" /> Kitchen</div>
                            </th>
                            <th className="p-6 pb-4 text-center">Staff</th>
                            <th className="p-6 pb-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="7" className="p-12 text-center text-enigma-text-muted">Loading roles...</td></tr>
                        ) : roles.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-16 text-center">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Shield className="w-8 h-8 text-white/20" />
                                    </div>
                                    <p className="text-enigma-text-secondary mb-4">No roles defined yet</p>
                                    <button onClick={seedRoles} className="px-6 py-2.5 rounded-xl bg-enigma-purple text-white font-bold text-sm">
                                        Initialize Default Roles
                                    </button>
                                </td>
                            </tr>
                        ) : roles.map(role => (
                            <tr key={role.id} className="group hover:bg-white/5 transition-colors">
                                <td className="p-6">
                                    {editingId === role.id ? (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={editData.name}
                                                onChange={e => setEditData({ ...editData, name: e.target.value })}
                                                className="glass-input rounded-lg px-3 py-1.5 text-white text-sm w-32 focus:outline-none focus:border-enigma-purple"
                                            />
                                            <div className="flex gap-1">
                                                {COLORS.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setEditData({ ...editData, color: c })}
                                                        className={`w-5 h-5 rounded-md transition-all ${editData.color === c ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                                                style={{ backgroundColor: `${role.color}20`, color: role.color, border: `1px solid ${role.color}40` }}
                                            >
                                                {role.name}
                                            </span>
                                            {role.isSystem && <Lock className="w-3 h-3 text-white/30" title="System role" />}
                                        </div>
                                    )}
                                </td>
                                <td className="p-6 text-enigma-text-secondary text-sm">
                                    {editingId === role.id ? (
                                        <input
                                            type="text"
                                            value={editData.description}
                                            onChange={e => setEditData({ ...editData, description: e.target.value })}
                                            className="glass-input rounded-lg px-3 py-1.5 text-white text-sm w-full focus:outline-none focus:border-enigma-purple"
                                        />
                                    ) : (
                                        role.description || '—'
                                    )}
                                </td>

                                {/* Permission toggles */}
                                {['canAccessOps', 'canAccessHq', 'canAccessKiosk', 'canAccessKitchen'].map(field => (
                                    <td key={field} className="p-6 text-center">
                                        <button
                                            onClick={() => handleToggle(role, field)}
                                            className={`w-10 h-6 rounded-full transition-all relative ${role[field]
                                                ? 'bg-enigma-green shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                                : 'bg-white/10'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${role[field] ? 'left-[18px]' : 'left-0.5'}`} />
                                        </button>
                                    </td>
                                ))}

                                <td className="p-6 text-center">
                                    <span className="text-white/40 font-mono text-sm">
                                        {employeeCounts[role.name] || 0}
                                    </span>
                                </td>

                                <td className="p-6 text-right">
                                    {editingId === role.id ? (
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleUpdate(role.id)} className="p-2 rounded-lg bg-enigma-green/10 text-enigma-green hover:bg-enigma-green/20 transition-all">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(role)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {!role.isSystem && (
                                                <button onClick={() => handleDelete(role)} className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-enigma-text-muted">
                <div className="flex items-center gap-2"><Monitor className="w-3.5 h-3.5" /> <strong>OPS</strong> = Caja registradora</div>
                <div className="flex items-center gap-2"><LayoutDashboard className="w-3.5 h-3.5" /> <strong>HQ</strong> = Back office</div>
                <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> <strong>Kiosk</strong> = Clock-in/out</div>
                <div className="flex items-center gap-2"><ChefHat className="w-3.5 h-3.5" /> <strong>Kitchen</strong> = Producción y Merma</div>
                <div className="flex items-center gap-2"><Lock className="w-3 h-3" /> = System role (cannot delete)</div>
            </div>
        </div>
    );
}
