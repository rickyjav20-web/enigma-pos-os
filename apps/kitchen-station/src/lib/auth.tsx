import React, { createContext, useContext, useState, useEffect } from 'react';

const SESSION_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours

interface Permissions {
    canAccessOps: boolean;
    canAccessHq: boolean;
    canAccessKiosk: boolean;
    canAccessKitchen: boolean;
}

interface User {
    id: string;
    name: string;
    role: string;
    permissions?: Permissions;
}

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isSessionExpired(): boolean {
    const loginAt = localStorage.getItem('kitchen_login_at');
    if (!loginAt) return true;
    return Date.now() - Number(loginAt) > SESSION_MAX_AGE;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    // Load from local storage on mount — check session expiry
    useEffect(() => {
        const stored = localStorage.getItem('kitchen_user');
        if (stored) {
            if (isSessionExpired()) {
                localStorage.removeItem('kitchen_user');
                localStorage.removeItem('kitchen_login_at');
                return;
            }
            try {
                setUser(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse user", e);
                localStorage.removeItem('kitchen_user');
            }
        }
    }, []);

    // Periodically check session expiry (every 5 minutes)
    useEffect(() => {
        const check = setInterval(() => {
            if (user && isSessionExpired()) {
                setUser(null);
                localStorage.removeItem('kitchen_user');
                localStorage.removeItem('kitchen_login_at');
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(check);
    }, [user]);

    const login = (newUser: User) => {
        setUser(newUser);
        localStorage.setItem('kitchen_user', JSON.stringify(newUser));
        localStorage.setItem('kitchen_login_at', String(Date.now()));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('kitchen_user');
        localStorage.removeItem('kitchen_login_at');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
