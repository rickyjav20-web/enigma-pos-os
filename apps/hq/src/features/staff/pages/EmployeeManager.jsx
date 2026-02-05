import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Search, Filter, MoreVertical, WifiOff, Edit, Trash2, ArrowLeft, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmployeeForm from '../components/EmployeeForm';

export default function EmployeeManager() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const res = await api.get('/employees');
            setEmployees(res.data.employees);
        } catch (e) {
            console.error("Error fetching employees", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    };

    const handleEdit = (emp) => {
        setEditingEmployee(emp);
        setIsFormOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/employees/${id}`);
            fetchEmployees();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        fetchEmployees();
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
        emp.role.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in text-white font-sans h-full">
            {/* Header */}
            <header className="flex justify-between items-end pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/staff')} className="p-3 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all group">
                        <ArrowLeft className="w-5 h-5 text-white/50 group-hover:text-white" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Talent Directory</h1>
                        <p className="text-enigma-text-secondary">Manage staff profiles and access credentials</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingEmployee(null); setIsFormOpen(true); }}
                    className="px-5 py-3 bg-enigma-purple hover:bg-enigma-purple-glow text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-enigma-purple/20 hover:shadow-enigma-purple/40 flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" />
                    New Specialist
                </button>
            </header>

            {/* Toolbar */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-white/30" />
                    <input
                        type="text"
                        placeholder="Search by name, role or PIN..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="glass-input w-full rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-panel rounded-3xl overflow-hidden p-1">
                <table className="w-full text-left">
                    <thead className="text-xs uppercase text-enigma-text-muted font-medium tracking-wider">
                        <tr>
                            <th className="p-6 pb-4">Employee</th>
                            <th className="p-6 pb-4">Role</th>
                            <th className="p-6 pb-4">Access PIN</th>
                            <th className="p-6 pb-4">Status</th>
                            <th className="p-6 pb-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="5" className="p-12 text-center text-enigma-text-muted">Loading directory...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan="5" className="p-16 text-center text-enigma-text-muted">No specialists found.</td></tr>
                        ) : (
                            filteredEmployees.map((emp) => (
                                <tr key={emp.id} className="group hover:bg-white/5 transition-colors">
                                    <td className="p-6 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white font-bold ring-1 ring-white/10 text-sm">
                                            {emp.fullName[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white group-hover:text-glow transition-all duration-300">{emp.fullName}</div>
                                            <div className="text-xs text-enigma-text-secondary">{emp.email || 'No email linked'}</div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-medium border border-white/10 text-white/70">
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="p-6 font-mono text-white/50 tracking-[0.2em] text-sm group-hover:text-white transition-colors">
                                        {emp.pinCode || '----'}
                                    </td>
                                    <td className="p-6">
                                        {emp.status === 'active' ? (
                                            <div className="flex items-center gap-2 text-enigma-text-secondary text-xs uppercase font-medium">
                                                <span className="w-2 h-2 rounded-full bg-enigma-green shadow-[0_0_8px_#10b981]" />
                                                Active
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-white/20 text-xs uppercase font-medium">
                                                <span className="w-2 h-2 rounded-full bg-white/20" />
                                                Inactive
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={() => handleEdit(emp)}
                                                className="p-2 hover:bg-white/10 rounded-lg text-white hover:text-enigma-purple transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id)}
                                                className="p-2 hover:bg-red-500/10 rounded-lg text-white hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <EmployeeForm
                    employee={editingEmployee}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
}
