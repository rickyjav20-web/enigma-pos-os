import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import api from '../lib/api';

interface Employee {
    id: string;
    fullName: string;
    role: string;
    pinCode: string;
}

interface RegisterSession {
    id: string;
    employeeId: string;
    registerType: 'PHYSICAL' | 'ELECTRONIC';
    status: 'open' | 'closed';
    startedAt: string;
    startingCash: number;
    linkedSessionId: string | null;
}

interface AuthState {
    employee: Employee | null;
    isLoading: boolean;
    /** Active physical register session (any employee, tenant-wide) */
    session: RegisterSession | null;
    /** Active electronic register session */
    electronicSession: RegisterSession | null;
    login: (pin: string) => Promise<boolean | string>;
    logout: () => void;
    /** Force re-sync session from API */
    syncSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Fetch any open register session for the tenant (not employee-specific) */
async function fetchTenantSessions(): Promise<{
    physical: RegisterSession | null;
    electronic: RegisterSession | null;
}> {
    try {
        const { data } = await api.get('/register/sessions?status=open');
        const sessions: RegisterSession[] = Array.isArray(data) ? data : (data?.data || []);

        if (sessions.length === 0) {
            return { physical: null, electronic: null };
        }

        // Find the most recent physical and electronic sessions
        const physical = sessions.find(s => s.registerType === 'PHYSICAL')
            || sessions.find(s => !s.registerType || s.registerType !== 'ELECTRONIC') // fallback: any non-electronic
            || sessions[0] // ultimate fallback: first open session
            || null;
        const electronic = sessions.find(s => s.registerType === 'ELECTRONIC') || null;

        return { physical, electronic };
    } catch (err) {
        console.error('[POS Auth] Failed to fetch tenant sessions:', err);
        return { physical: null, electronic: null };
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [employee, setEmployee] = useState<Employee | null>(() => {
        const saved = localStorage.getItem('wave_pos_employee');
        return saved ? JSON.parse(saved) : null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [session, setSession] = useState<RegisterSession | null>(null);
    const [electronicSession, setElectronicSession] = useState<RegisterSession | null>(null);

    // ─── Sync sessions: find any open session for the tenant ────────────
    const syncSession = useCallback(async () => {
        const { physical, electronic } = await fetchTenantSessions();

        setSession(physical);
        setElectronicSession(electronic);

        // Store session IDs for sales resolution (resolveSession picks by payment method)
        if (physical?.id) {
            localStorage.setItem('wave_pos_session', physical.id);
        } else {
            localStorage.removeItem('wave_pos_session');
        }
        if (electronic?.id) {
            localStorage.setItem('wave_pos_electronic_session', electronic.id);
        } else {
            localStorage.removeItem('wave_pos_electronic_session');
        }
    }, []);

    // ─── Auto-sync on mount if employee is already logged in ────────────
    useEffect(() => {
        if (employee) {
            syncSession();
        }
    }, [employee, syncSession]);

    // ─── Periodic sync every 30s to catch OPS opening/closing ───────────
    useEffect(() => {
        if (!employee) return;
        const interval = setInterval(syncSession, 30_000);
        return () => clearInterval(interval);
    }, [employee, syncSession]);

    const login = useCallback(async (pin: string): Promise<boolean | string> => {
        setIsLoading(true);
        try {
            const { data } = await api.post('/auth/employee-login', { pin });

            if (data?.employee) {
                const emp: Employee = {
                    id: data.employee.id,
                    fullName: data.employee.name,
                    role: data.employee.role,
                    pinCode: pin,
                };
                setEmployee(emp);
                localStorage.setItem('wave_pos_employee', JSON.stringify(emp));

                // Immediately sync with any open register session (tenant-wide)
                const { physical, electronic } = await fetchTenantSessions();
                setSession(physical);
                setElectronicSession(electronic);

                if (physical?.id) {
                    localStorage.setItem('wave_pos_session', physical.id);
                } else {
                    localStorage.removeItem('wave_pos_session');
                }
                if (electronic?.id) {
                    localStorage.setItem('wave_pos_electronic_session', electronic.id);
                } else {
                    localStorage.removeItem('wave_pos_electronic_session');
                }

                return true;
            }
            return false;
        } catch (err: any) {
            console.error('[POS Auth] Login failed:', err);
            if (err.response?.status === 401) return false;
            if (err.response?.data?.message) return err.response.data.message;
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        setEmployee(null);
        setSession(null);
        setElectronicSession(null);
        localStorage.removeItem('wave_pos_employee');
        localStorage.removeItem('wave_pos_session');
        localStorage.removeItem('wave_pos_electronic_session');
    }, []);

    return (
        <AuthContext.Provider value={{
            employee, isLoading, session, electronicSession,
            login, logout, syncSession,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
