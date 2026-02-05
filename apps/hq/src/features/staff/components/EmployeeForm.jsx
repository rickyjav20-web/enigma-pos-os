import React, { useState, useEffect } from 'react';
import { Save, X, User, Phone, MapPin, Calendar, Heart, Lock, Banknote, FileText, Upload, Calculator, ArrowRight, Edit, UserPlus, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
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
            const res = await api.get(`/employees/${empId}/documents`);
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
            api.get(`/recurring/${employee.id}`)
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
            let empId;

            if (employee) {
                // UPDATE
                await api.patch(`/employees/${employee.id}`, formData);
                empId = employee.id;
            } else {
                // CREATE
                const res = await api.post('/employees', formData);
                empId = res.data.employee.id;
            }

            // Save Recurring
            if (empId) {
                await api.post('/recurring', {
                    employeeId: empId,
                    patterns: recurring
                });
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
                await api.post(`/employees/${employee.id}/documents`, {
                    title: file.name,
                    type: 'FILE',
                    fileName: file.name,
                    fileData: base64
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-end z-[100] animate-fade-in">
            <div className="w-full max-w-2xl bg-enigma-void/80 backdrop-blur-xl border-l border-white/10 h-full shadow-2xl flex flex-col transform transition-transform duration-300">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            {employee ? <Edit className="w-5 h-5 text-enigma-purple" /> : <UserPlus className="w-5 h-5 text-enigma-green" />}
                            {employee ? 'Edit Profile' : 'New Specialist'}
                        </h2>
                        <p className="text-sm text-enigma-text-secondary mt-1">
                            {employee ? `Updating details for ${employee.fullName}` : 'Onboard a new team member'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors group">
                        <X className="w-5 h-5 text-white/50 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 pt-4 border-b border-white/5 space-x-6 overflow-x-auto">
                    {['access', 'personal', 'schedule', 'emergency'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "pb-4 text-sm font-medium transition-all border-b-2 capitalize tracking-wide",
                                activeTab === tab
                                    ? "border-enigma-purple text-white hover:text-glow-purple"
                                    : "border-transparent text-enigma-text-muted hover:text-white"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                {/* Secondary Tabs Row */}
                <div className="flex px-6 py-2 border-b border-white/5 bg-white/5 items-center gap-2">
                    <span className="text-[10px] uppercase text-enigma-text-muted font-bold tracking-widest mr-2">Admin Only</span>
                    <button
                        onClick={() => setActiveTab('finance')}
                        className={clsx("py-1 px-3 rounded-full text-xs font-medium transition-all border border-transparent", activeTab === 'finance' ? "bg-enigma-green/10 text-enigma-green border-enigma-green/20" : "text-white/50 hover:text-white hover:bg-white/5")}
                    >
                        <div className="flex items-center justify-center gap-1.5">
                            <Banknote className="w-3 h-3" />
                            Finance
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={clsx("py-1 px-3 rounded-full text-xs font-medium transition-all border border-transparent", activeTab === 'documents' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "text-white/50 hover:text-white hover:bg-white/5")}
                    >
                        <div className="flex items-center justify-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            Docs
                        </div>
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

                    {activeTab === 'access' && (
                        <div className="space-y-6 animate-fade-in">
                            <InputField label="Full Name *" name="fullName" value={formData.fullName} onChange={handleChange} icon={User} required />

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Role</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-enigma-purple transition-all appearance-none"
                                    >
                                        <option value="Barista">Barista</option>
                                        <option value="Cajero">Cajero</option>
                                        <option value="Gerente">Gerente</option>
                                        <option value="Cocina">Cocina</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Status</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-enigma-purple transition-all appearance-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Access PIN (4 Digits) *</label>
                                <div className="flex gap-4">
                                    <div className="relative flex-1">
                                        <Lock className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />
                                        <input
                                            type="text"
                                            name="pinCode"
                                            value={formData.pinCode}
                                            onChange={handleChange}
                                            maxLength={4}
                                            className="glass-input w-full rounded-xl p-3 pl-12 text-white font-mono tracking-[0.5em] text-lg focus:outline-none focus:border-enigma-purple transition-colors text-center"
                                            placeholder="0000"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={generatePin}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Generate
                                    </button>
                                </div>
                                <p className="text-xs text-white/30 mt-2 flex items-center gap-1"><Lock className="w-3 h-3" /> Required for Kiosk login.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'personal' && (
                        <div className="space-y-6 animate-fade-in">
                            <InputField label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} />
                            <InputField label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleChange} icon={Phone} />
                            <InputField label="Home Address" name="address" value={formData.address} onChange={handleChange} icon={MapPin} />

                            <div className="grid grid-cols-2 gap-6">
                                <InputField label="Date of Birth" name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} icon={Calendar} />
                                <InputField label="Start Date" name="startDate" type="date" value={formData.startDate} onChange={handleChange} icon={Calendar} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-blue-400 mt-0.5" />
                                <div>
                                    <h4 className="text-white font-medium text-sm">Recurring Pattern</h4>
                                    <p className="text-xs text-blue-200/70 mt-1">
                                        Define the standard availability. This is used to auto-populate the weekly planner.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {recurring.map((day, idx) => (
                                    <div key={day.dayOfWeek} className={clsx("flex items-center gap-4 p-3 rounded-xl border transition-all", day.isActive ? "bg-white/5 border-white/10" : "opacity-40 border-transparent hover:opacity-60")}>
                                        <div className="flex items-center gap-3 w-32">
                                            <input
                                                type="checkbox"
                                                checked={day.isActive}
                                                onChange={(e) => handleRecurringChange(idx, 'isActive', e.target.checked)}
                                                className="w-5 h-5 rounded border-white/20 bg-transparent text-enigma-purple focus:ring-0 focus:ring-offset-0 checked:bg-enigma-purple"
                                            />
                                            <span className="text-sm font-bold uppercase tracking-wide text-white">{days[day.dayOfWeek].substring(0, 3)}</span>
                                        </div>

                                        <div className="flex gap-3 flex-1 items-center">
                                            <input
                                                type="time"
                                                value={day.startTime}
                                                disabled={!day.isActive}
                                                onInput={(e) => handleRecurringChange(idx, 'startTime', e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-30 focus:border-enigma-purple outline-none"
                                            />
                                            <span className="text-white/20 font-bold">→</span>
                                            <input
                                                type="time"
                                                value={day.endTime}
                                                disabled={!day.isActive}
                                                onInput={(e) => handleRecurringChange(idx, 'endTime', e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-30 focus:border-enigma-purple outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'emergency' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                                <Heart className="w-5 h-5 text-red-400 mt-0.5" />
                                <div>
                                    <h4 className="text-white font-medium text-sm">Vital Info</h4>
                                    <p className="text-xs text-red-200/70 mt-1">
                                        Critical contact details for medical emergencies.
                                    </p>
                                </div>
                            </div>
                            <InputField label="Contact Name" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} />
                            <InputField label="Emergency Phone" name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} icon={Phone} />

                            <div>
                                <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">Medical Notes / Allergies</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows="4"
                                    className="glass-input w-full rounded-xl p-4 text-white focus:outline-none focus:border-enigma-purple transition-colors placeholder:text-white/20 resize-none"
                                    placeholder="List any allergies or medical conditions..."
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <InputField label="Gov ID / DNI" name="govId" value={formData.govId} onChange={handleChange} />
                                <InputField label="Nationality" name="nationality" value={formData.nationality} onChange={handleChange} />
                            </div>

                            <div className="border-t border-white/5 pt-6">
                                <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-4">Compensation Scheme</label>
                                <div className="grid grid-cols-2 gap-6">
                                    <select
                                        name="salaryType"
                                        value={formData.salaryType}
                                        onChange={handleChange}
                                        className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="fixed">Fixed Salary (Monthly)</option>
                                        <option value="hourly">Hourly Rate</option>
                                    </select>
                                    <div className="relative">
                                        <div className="absolute left-4 top-3.5 text-white/50 text-xs font-bold">{formData.currency}</div>
                                        <input
                                            type="number"
                                            name="salaryAmount"
                                            value={formData.salaryAmount}
                                            onChange={handleChange}
                                            className="glass-input w-full rounded-xl p-3 pl-12 text-white focus:outline-none focus:border-green-500 transition-colors text-right font-mono font-bold"
                                            placeholder="0.00"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCalculator(true)}
                                            className="absolute right-2 top-2 p-1.5 hover:bg-white/10 rounded-lg text-green-400 transition-colors"
                                            title="Calculator"
                                        >
                                            <Calculator className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-6">
                                <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-4">Payment Details</label>

                                <div className="mb-4">
                                    <select
                                        name="paymentMethod"
                                        value={formData.paymentMethod}
                                        onChange={handleChange}
                                        className="glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="transfer">Bank Transfer</option>
                                        <option value="mobile">Pago Móvil</option>
                                        <option value="zelle">Zelle</option>
                                        <option value="cash">Cash</option>
                                    </select>
                                </div>

                                {(formData.paymentMethod === 'transfer' || formData.paymentMethod === 'mobile') && (
                                    <div className="space-y-4 animate-fade-in">
                                        <InputField label="Bank Name" name="bankName" value={formData.bankName} onChange={handleChange} />
                                        <InputField label="Account Number / Phone" name="accountNumber" value={formData.accountNumber} onChange={handleChange} />
                                        <InputField label="Account Holder (If different)" name="accountHolder" value={formData.accountHolder} onChange={handleChange} />
                                    </div>
                                )}
                                {formData.paymentMethod === 'zelle' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <InputField label="Zelle Email" name="accountNumber" value={formData.accountNumber} onChange={handleChange} />
                                        <InputField label="Zelle Holder Name" name="accountHolder" value={formData.accountHolder} onChange={handleChange} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-6 animate-fade-in">
                            {!employee ? (
                                <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center justify-center h-64">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                        <Lock className="w-8 h-8 text-white/20" />
                                    </div>
                                    <h4 className="text-white font-medium">Profile Not Created</h4>
                                    <p className="text-sm text-white/40 mt-1 max-w-xs mx-auto">Please save the specialist profile first to enable document uploads.</p>
                                </div>
                            ) : (
                                <>
                                    <label className="group p-8 rounded-3xl border-2 border-dashed border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer flex flex-col items-center justify-center h-48">
                                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Upload className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <h4 className="text-blue-200 font-medium">Upload Document</h4>
                                        <p className="text-xs text-blue-200/50 mt-1 text-center">PDF, JPG, PNG (Max 5MB)</p>
                                        <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                                    </label>

                                    <div className="grid grid-cols-1 gap-3">
                                        {documents.map((doc) => (
                                            <a
                                                key={doc.id}
                                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}${doc.url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
                                            >
                                                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mr-4">
                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-white font-medium group-hover:text-glow transition-all">{doc.title}</p>
                                                    <p className="text-[10px] text-white/40 font-mono mt-0.5">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                                            </a>
                                        ))}
                                        {documents.length === 0 && (
                                            <div className="text-center text-white/20 text-sm py-4 italic">
                                                No documents on file.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-white/10 bg-enigma-void/50 flex gap-4 backdrop-blur-md">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 px-6 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] py-4 px-6 rounded-xl bg-enigma-purple hover:bg-enigma-purple-glow text-white transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-enigma-purple/20"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Profile
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
            <label className="block text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-2">{label}</label>
            <div className="relative">
                {Icon && <Icon className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />}
                <input
                    type={type}
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    required={required}
                    className={clsx(
                        "glass-input w-full rounded-xl p-3 text-white focus:outline-none focus:border-enigma-purple transition-colors placeholder:text-white/20",
                        Icon && "pl-12"
                    )}
                />
            </div>
        </div>
    )
}
