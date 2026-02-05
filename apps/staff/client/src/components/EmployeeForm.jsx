import React, { useState, useEffect } from 'react';
import { Save, X, User, Phone, MapPin, Calendar, Heart, Lock, Banknote, FileText, Upload, Calculator, ArrowRight } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';

import FinanceCalculator from './FinanceCalculator';

export default function EmployeeForm({ employee, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        fullName: '',
        role: 'Barista',
        pinCode: '',
        status: 'active',
        email: '',
        phone: '',
        address: '',
        birthDate: '',
        startDate: '',
        emergencyContact: '',
        emergencyPhone: '',
        notes: '',
        // Finance & HR
        govId: '',
        nationality: '',
        paymentMethod: 'transfer',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        salaryType: 'fixed', // fixed | hourly
        salaryAmount: '',
        currency: 'USD'
    });

    const [activeTab, setActiveTab] = useState('access'); // access | personal | emergency | schedule
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Recurring Schedule State
    const [recurring, setRecurring] = useState(
        Array.from({ length: 7 }, (_, i) => ({
            dayOfWeek: i,
            isActive: false,
            startTime: '09:00',
            endTime: '17:00'
        }))
    );

    const [showCalculator, setShowCalculator] = useState(false);
    const [documents, setDocuments] = useState([]);

    const fetchDocuments = async (empId) => {
        try {
            const res = await axios.get(`http://localhost:3005/employees/${empId}/documents`, {
                headers: { 'x-tenant-id': 'enigma-cafe' } // Hardcoded tenant for now
            });
            setDocuments(res.data);
        } catch (error) {
            console.error("Error loading docs", error);
        }
    };

    useEffect(() => {
        if (employee) {
            // Populate form for editing
            setFormData({
                ...employee,
                birthDate: employee.birthDate ? employee.birthDate.split('T')[0] : '',
                startDate: employee.startDate ? employee.startDate.split('T')[0] : '',
                pinCode: employee.pinCode || '',
                // Finance
                govId: employee.govId || '',
                nationality: employee.nationality || '',
                paymentMethod: employee.paymentMethod || 'transfer',
                bankName: employee.bankName || '',
                accountNumber: employee.accountNumber || '',
                accountHolder: employee.accountHolder || '',
                salaryType: employee.salaryType || 'fixed',
                salaryAmount: employee.salaryAmount || '',
                currency: employee.currency || 'USD'
            });

            // Fetch recurring schedule
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };
            axios.get(`/api/recurring/${employee.id}`, config)
                .then(res => {
                    const dbPatterns = res.data.recurring;
                    if (dbPatterns.length > 0) {
                        setRecurring(prev => prev.map(p => {
                            const found = dbPatterns.find(dp => dp.dayOfWeek === p.dayOfWeek);
                            return found ? { ...p, ...found } : p;
                        }));
                    }
                })
                .catch(console.error);

            fetchDocuments(employee.id);
        }
    }, [employee]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRecurringChange = (index, field, value) => {
        const newRecurring = [...recurring];
        newRecurring[index][field] = value;
        setRecurring(newRecurring);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const config = { headers: { 'x-tenant-id': 'enigma-cafe' } };

            let empId = employee?.id;

            if (employee) {
                // UPDATE
                await axios.patch(`/api/employees/${employee.id}`, formData, config);
            } else {
                // CREATE
                const res = await axios.post('/api/employees', formData, config);
                empId = res.data.employee.id;
            }

            // Save Recurring
            if (empId) {
                await axios.post('/api/recurring', {
                    employeeId: empId,
                    patterns: recurring
                }, config);
            }

            onSuccess();
        } catch (err) {
            console.error(err);
            setError('Error al guardar. Verifica los datos.');
        } finally {
            setLoading(false);
        }
    };

    const generatePin = () => {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        setFormData(prev => ({ ...prev, pinCode: pin }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !employee) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result;
            try {
                await axios.post(`http://localhost:3005/employees/${employee.id}/documents`, {
                    title: file.name,
                    type: 'FILE',
                    fileName: file.name,
                    fileData: base64
                }, {
                    headers: { 'x-tenant-id': 'enigma-cafe' }
                });
                fetchDocuments(employee.id); // Refresh list
            } catch (error) {
                console.error("Upload failed", error);
                alert("Error al subir documento");
            }
        };
        reader.readAsDataURL(file);
    };

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="w-full max-w-md bg-enigma-black border-l border-white/10 h-full shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-enigma-gray/20">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {employee ? 'Editar Empleado' : 'Nuevo Empleado'}
                        </h2>
                        <p className="text-xs text-white/50">Gestión de Talento</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/70" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('access')}
                        className={clsx("flex-1 py-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'access' ? "border-enigma-purple text-enigma-purple" : "border-transparent text-white/50 hover:text-white")}
                    >
                        Acceso
                    </button>
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={clsx("flex-1 py-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'personal' ? "border-enigma-purple text-enigma-purple" : "border-transparent text-white/50 hover:text-white")}
                    >
                        Personal
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={clsx("flex-1 py-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'schedule' ? "border-enigma-purple text-enigma-purple" : "border-transparent text-white/50 hover:text-white")}
                    >
                        Horario Fijo
                    </button>
                    <button
                        onClick={() => setActiveTab('emergency')}
                        className={clsx("flex-1 py-3 px-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'emergency' ? "border-enigma-purple text-enigma-purple" : "border-transparent text-white/50 hover:text-white")}
                    >
                        Emergencia
                    </button>
                </div>
                {/* Secondary Tabs Row */}
                <div className="flex border-b border-white/10 overflow-x-auto bg-enigma-gray/10">
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={clsx("flex-1 py-2 px-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'finance' ? "border-green-500 text-green-400" : "border-transparent text-white/50 hover:text-white")}
                    >
                        <div className="flex items-center justify-center gap-1">
                            <Banknote className="w-3 h-3" />
                            Finanzas
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={clsx("flex-1 py-2 px-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === 'documents' ? "border-blue-400 text-blue-400" : "border-transparent text-white/50 hover:text-white")}
                    >
                        <div className="flex items-center justify-center gap-1">
                            <FileText className="w-3 h-3" />
                            Documentos
                        </div>
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">{error}</div>}

                    {activeTab === 'access' && (
                        <div className="space-y-4 animate-fade-in">
                            <InputField label="Nombre Completo *" name="fullName" value={formData.fullName} onChange={handleChange} icon={User} required />

                            <div>
                                <label className="block text-xs uppercase text-white/40 mb-1">Rol</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple transition-colors"
                                >
                                    <option value="Barista">Barista</option>
                                    <option value="Cajero">Cajero</option>
                                    <option value="Gerente">Gerente</option>
                                    <option value="Cocina">Cocina</option>
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs uppercase text-white/40 mb-1">PIN de Acceso (4 dígitos) *</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30" />
                                        <input
                                            type="text"
                                            name="pinCode"
                                            value={formData.pinCode}
                                            onChange={handleChange}
                                            maxLength={4}
                                            className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 pl-10 text-white font-mono tracking-widest focus:outline-none focus:border-enigma-purple transition-colors"
                                            placeholder="0000"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generatePin}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-4 rounded-lg text-sm transition-colors"
                                    >
                                        Generar
                                    </button>
                                </div>
                                <p className="text-xs text-white/30 mt-1">Necesario para el Kiosk.</p>
                            </div>

                            <div>
                                <label className="block text-xs uppercase text-white/40 mb-1">Estado</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple transition-colors"
                                >
                                    <option value="active">Activo</option>
                                    <option value="inactive">Inactivo</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'personal' && (
                        <div className="space-y-4 animate-fade-in">
                            <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} />
                            <InputField label="Teléfono" name="phone" type="tel" value={formData.phone} onChange={handleChange} icon={Phone} />
                            <InputField label="Dirección" name="address" value={formData.address} onChange={handleChange} icon={MapPin} />

                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Fecha Nacimiento" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} icon={Calendar} />
                                <InputField label="Fecha Inicio" name="startDate" type="date" value={formData.startDate} onChange={handleChange} icon={Calendar} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg mb-4">
                                <p className="text-xs text-blue-300">
                                    Define el horario base. Estos datos se usan para "Autocargar Turnos" en el planificador.
                                </p>
                            </div>

                            <div className="space-y-2">
                                {recurring.map((day, idx) => (
                                    <div key={day.dayOfWeek} className={clsx("flex items-center gap-2 p-2 rounded-lg border", day.isActive ? "bg-white/5 border-white/10" : "opacity-50 border-transparent")}>
                                        <input
                                            type="checkbox"
                                            checked={day.isActive}
                                            onChange={(e) => handleRecurringChange(idx, 'isActive', e.target.checked)}
                                            className="w-4 h-4 rounded border-white/20 bg-transparent text-enigma-purple focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span className="w-20 text-xs font-medium uppercase text-white/70">{days[day.dayOfWeek]}</span>

                                        <div className="flex gap-2 flex-1">
                                            <input
                                                type="time"
                                                value={day.startTime}
                                                disabled={!day.isActive}
                                                onInput={(e) => handleRecurringChange(idx, 'startTime', e.target.value)}
                                                className="w-full bg-black/20 border border-white/5 rounded px-2 py-1 text-xs text-white disabled:opacity-30"
                                            />
                                            <span className="text-white/20">-</span>
                                            <input
                                                type="time"
                                                value={day.endTime}
                                                disabled={!day.isActive}
                                                onInput={(e) => handleRecurringChange(idx, 'endTime', e.target.value)}
                                                className="w-full bg-black/20 border border-white/5 rounded px-2 py-1 text-xs text-white disabled:opacity-30"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'emergency' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-lg mb-4">
                                <p className="text-xs text-red-300 flex items-center gap-2">
                                    <Heart className="w-3 h-3" />
                                    Información vital en caso de accidente.
                                </p>
                            </div>
                            <InputField label="Nombre Contacto" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} />
                            <InputField label="Teléfono Emergencia" name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} icon={Phone} />

                            <div>
                                <label className="block text-xs uppercase text-white/40 mb-1">Notas Médicas / Alergias</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple transition-colors placeholder:text-white/20"
                                    placeholder="Alergias, condiciones..."
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-lg mb-4">
                                <p className="text-xs text-green-300">
                                    Datos confidenciales de pago y compensación.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Cédula / DNI" name="govId" value={formData.govId} onChange={handleChange} />
                                <InputField label="Nacionalidad" name="nationality" value={formData.nationality} onChange={handleChange} />
                            </div>

                            <div className="border-t border-white/10 my-4 pt-4">
                                <label className="block text-xs uppercase text-white/40 mb-2">Esquema Salarial</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <select
                                            name="salaryType"
                                            value={formData.salaryType}
                                            onChange={handleChange}
                                            className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 transition-colors text-sm"
                                        >
                                            <option value="fixed">Sueldo Fijo (Mensual)</option>
                                            <option value="hourly">Por Hora</option>
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-3 top-3.5 text-white/50 text-xs font-bold">{formData.currency}</div>
                                        <input
                                            type="number"
                                            name="salaryAmount"
                                            value={formData.salaryAmount}
                                            onChange={handleChange}
                                            className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 pl-12 text-white focus:outline-none focus:border-green-500 transition-colors text-right font-mono"
                                            placeholder="0.00"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCalculator(true)}
                                            className="absolute right-2 top-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-green-400 transition-colors"
                                            title="Calculadora de Conversión"
                                        >
                                            <Calculator className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/10 my-4 pt-4">
                                <label className="block text-xs uppercase text-white/40 mb-2">Datos de Pago</label>

                                <div className="mb-3">
                                    <select
                                        name="paymentMethod"
                                        value={formData.paymentMethod}
                                        onChange={handleChange}
                                        className="w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="transfer">Transferencia Bancaria</option>
                                        <option value="mobile">Pago Móvil</option>
                                        <option value="zelle">Zelle</option>
                                        <option value="cash">Efectivo</option>
                                    </select>
                                </div>

                                {(formData.paymentMethod === 'transfer' || formData.paymentMethod === 'mobile') && (
                                    <div className="space-y-3 animate-fade-in">
                                        <InputField label="Banco" name="bankName" value={formData.bankName} onChange={handleChange} />
                                        <InputField label="Nro Cuenta / Teléfono" name="accountNumber" value={formData.accountNumber} onChange={handleChange} />
                                        <InputField label="Titular (si es diferente)" name="accountHolder" value={formData.accountHolder} onChange={handleChange} />
                                    </div>
                                )}
                                {formData.paymentMethod === 'zelle' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <InputField label="Email Zelle" name="accountNumber" value={formData.accountNumber} onChange={handleChange} />
                                        <InputField label="Titular Zelle" name="accountHolder" value={formData.accountHolder} onChange={handleChange} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-4 animate-fade-in">
                            {!employee ? (
                                <div className="text-center p-8 bg-white/5 rounded-lg border border-white/10">
                                    <Lock className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                    <p className="text-sm text-white/50">Guarda el empleado primero para subir documentos.</p>
                                </div>
                            ) : (
                                <>
                                    <label className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-lg mb-4 flex flex-col items-center justify-center border-dashed border-2 cursor-pointer hover:bg-blue-500/10 transition-colors">
                                        <Upload className="w-8 h-8 text-blue-400 mb-2" />
                                        <p className="text-xs text-blue-300 mb-2">
                                            Click para subir documento
                                        </p>
                                        <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                                        <p className="text-[10px] text-white/30 mt-2">Soporta PDF, JPG, PNG (Max 5MB)</p>
                                    </label>

                                    <div className="space-y-2">
                                        {documents.map((doc) => (
                                            <a
                                                key={doc.id}
                                                href={`http://localhost:3005${doc.url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group"
                                            >
                                                <FileText className="w-4 h-4 text-blue-400 mr-3" />
                                                <div className="flex-1">
                                                    <p className="text-sm text-white font-medium">{doc.title}</p>
                                                    <p className="text-[10px] text-white/40">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                                            </a>
                                        ))}
                                        {documents.length === 0 && (
                                            <div className="text-center text-white/20 text-xs py-4">
                                                No hay documentos cargados.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-white/10 bg-enigma-gray/20 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] py-3 px-4 rounded-xl bg-enigma-purple hover:bg-enigma-purple/90 text-white transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Guardando...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar Empleado
                            </>
                        )}
                    </button>
                </div>
            </div>
            {showCalculator && (
                <FinanceCalculator
                    baseAmount={formData.salaryAmount}
                    onClose={() => setShowCalculator(false)}
                />
            )}
        </div>
    );
}

function InputField({ label, name, value, onChange, type = "text", icon: Icon, required }) {
    return (
        <div>
            <label className="block text-xs uppercase text-white/40 mb-1">{label}</label>
            <div className="relative">
                {Icon && <Icon className="absolute left-3 top-3.5 w-4 h-4 text-white/30" />}
                <input
                    type={type}
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    required={required}
                    className={clsx(
                        "w-full bg-enigma-gray/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-enigma-purple transition-colors placeholder:text-white/20",
                        Icon && "pl-10"
                    )}
                />
            </div>
        </div>
    )
}
