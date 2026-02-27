import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import api from '../lib/api';

interface Employee {
    id: string;
    fullName: string;
    role: string;
    pinCode: string;
}

interface AuthState {
    employee: Employee | null;
    isLoading: boolean;
    login: (pin: string) => Promise<boolean | string>;
    logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [employee, setEmployee] = useState<Employee | null>(() => {
        const saved = localStorage.getItem('wave_pos_employee');
        return saved ? JSON.parse(saved) : null;
    });
    const [isLoading, setIsLoading] = useState(false);

    const login = useCallback(async (pin: string): Promise<boolean | string> => {
        setIsLoading(true);
        try {
            const { data } = await api.post('/auth/employee-login', { pin });

            if (data?.employee) {
                // Check if they have POS access (role check can be expanded)
                const emp: Employee = {
                    id: data.employee.id,
                    fullName: data.employee.name,
                    role: data.employee.role,
                    pinCode: pin,
                };
                setEmployee(emp);
                localStorage.setItem('wave_pos_employee', JSON.stringify(emp));
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
        localStorage.removeItem('wave_pos_employee');
    }, []);

    return (
        <AuthContext.Provider value={{ employee, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
