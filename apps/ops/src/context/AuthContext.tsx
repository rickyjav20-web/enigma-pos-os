
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// --- Types ---
interface Employee {
    id: string;
    name: string;
    role: string;
}

interface RegisterSession {
    id: string;
    startedAt: string;
    status: 'open' | 'closed';
}

interface AuthContextType {
    employee: Employee | null;
    session: RegisterSession | null;
    isLoading: boolean;
    login: (pin: string) => Promise<boolean | string>;
    logout: () => void;
    openRegister: (amount: number) => Promise<void>;
    closeRegister: (data: any) => Promise<void>;
}

// --- Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq'; // Hardcoded for MVP

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [session, setSession] = useState<RegisterSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('ops_employee');
        if (stored) {
            const parsed = JSON.parse(stored);
            setEmployee(parsed);
            checkSessionStatus(parsed.id);
        } else {
            setIsLoading(false);
        }
    }, []);

    const checkSessionStatus = async (employeeId: string) => {
        try {
            const res = await axios.get(`${API_URL}/register/status/${employeeId}`, {
                headers: { 'x-tenant-id': TENANT_ID }
            });
            if (res.data && res.data.status === 'open') {
                setSession(res.data);
            } else {
                setSession(null);
            }
        } catch (e) {
            console.error("Failed to check session", e);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (pin: string): Promise<boolean | string> => {
        try {
            const res = await axios.post(`${API_URL}/auth/employee-login`, { pin }, {
                headers: { 'x-tenant-id': TENANT_ID }
            });

            const { employee: empData, activeSession } = res.data;

            // Dynamic Access Control: Check role permissions from SystemRole table
            let canAccess = false;
            try {
                const roleCheck = await axios.get(`${API_URL}/roles/check/${encodeURIComponent(empData.role)}`, {
                    headers: { 'x-tenant-id': TENANT_ID }
                });
                canAccess = roleCheck.data.canAccessOps === true;
            } catch {
                // Fallback: if roles API not available, use legacy hardcoded list
                const LEGACY_ROLES = ['admin', 'cashier', 'manager', 'cajero', 'gerente', 'cocina'];
                canAccess = LEGACY_ROLES.includes(empData.role.toLowerCase());
            }

            if (!canAccess) {
                return `Acceso denegado. Tu rol "${empData.role}" no tiene permisos para la caja.`;
            }

            setEmployee(empData);
            setSession(activeSession);
            localStorage.setItem('ops_employee', JSON.stringify(empData));
            return true;
        } catch (e) {
            console.error("Login failed", e);
            return false;
        }
    };

    const logout = () => {
        setEmployee(null);
        setSession(null);
        localStorage.removeItem('ops_employee');
    };

    const openRegister = async (startingCash: number) => {
        if (!employee) return;
        const res = await axios.post(`${API_URL}/register/open`, {
            employeeId: employee.id,
            startingCash
        }, { headers: { 'x-tenant-id': TENANT_ID } });

        setSession(res.data);
    };

    const closeRegister = async (data: any) => {
        if (!session) return;
        await axios.post(`${API_URL}/register/close`, {
            sessionId: session.id,
            ...data
        }, { headers: { 'x-tenant-id': TENANT_ID } });

        // Auto-logout after close is the safest flow
        logout();
    };

    return (
        <AuthContext.Provider value={{ employee, session, isLoading, login, logout, openRegister, closeRegister }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
