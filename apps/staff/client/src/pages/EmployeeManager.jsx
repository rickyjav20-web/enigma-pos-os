import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Search, Filter, MoreVertical, WifiOff, Edit, Trash2, ArrowLeft, UserPlus } from 'lucide-react'; // Added ArrowLeft, UserPlus
import { useNavigate } from 'react-router-dom'; // Added useNavigate
import EmployeeForm from '../components/EmployeeForm';

export default function EmployeeManager() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const navigate = useNavigate(); // Added hook

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };
            const res = await axios.get('/api/employees', config);
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
        if (!confirm('¿Estás seguro de desactivar a este empleado?')) return;
        try {
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };
            await axios.delete(`/api/employees/${id}`, config);
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
        <div className="min-h-screen bg-enigma-black text-white p-8 font-sans">
            <header className="flex justify-between items-center mb-10 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Gestión de <span className="text-enigma-purple">Talento</span></h1>
                        <p className="text-white/40 text-sm mt-1">Directorio de Empleados</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setEditingEmployee(null); setIsFormOpen(true); }} className="px-4 py-2 bg-enigma-purple hover:bg-enigma-purple/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Nuevo Empleado
                    </button>
                </div>
            </header>
            {/* Toolbar */}
            <div className="flex gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o rol..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-enigma-gray/30 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-white/20 transition-colors"
                    />
                </div>
                {/* <button className="px-4 py-2 bg-enigma-gray/30 border border-white/10 rounded-xl text-white/70 hover:text-white flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                </button> */}
            </div>

            {/* Table */}
            <div className="bg-enigma-gray/20 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs uppercase text-white/40 font-medium">
                        <tr>
                            <th className="p-5">Empleado</th>
                            <th className="p-5">Rol</th>
                            <th className="p-5">PIN</th>
                            <th className="p-5">Estado</th>
                            <th className="p-5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-white/30">Cargando talento...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-white/30">No se encontraron empleados.</td></tr>
                        ) : (
                            filteredEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-5 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-enigma-purple to-indigo-600 flex items-center justify-center text-white font-bold">
                                            {emp.fullName[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{emp.fullName}</div>
                                            <div className="text-xs text-white/40">{emp.email || 'Sin email'}</div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs border border-white/10">
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="p-5 font-mono text-white/70 tracking-widest text-sm">
                                        {emp.pinCode || '----'}
                                    </td>
                                    <td className="p-5">
                                        {emp.status === 'active' ? (
                                            <div className="flex items-center gap-2 text-green-400 text-xs font-mono uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_currentColor]" />
                                                Activo
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-white/30 text-xs font-mono uppercase">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                                Inactivo
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(emp)}
                                                className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors" title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp.id)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-colors" title="Eliminar"
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
