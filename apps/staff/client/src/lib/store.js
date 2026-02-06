import { create } from 'zustand';
import axios from 'axios';
import { db } from './db';

const api = axios.create({
    baseURL: (window._env_ && window._env_.VITE_API_URL) ||
        import.meta.env.VITE_API_URL ||
        'https://enigma-pos-os-production.up.railway.app/api/v1'
});

// Add Tenant interceptor if needed
api.interceptors.request.use((config) => {
    // In production, get SUBDOMAIN or from local storage settings.
    // For MVP, we'll assume a fixed tenant header or localhost.
    config.headers['x-tenant-id'] = 'enigma_hq'; // Hardcoded for MVP default
    return config;
});

export const useStore = create((set, get) => ({
    // State
    employee: null,
    activeShift: null,
    isOnline: navigator.onLine,

    // Actions
    setEmployee: (emp) => set({ employee: emp }),

    verifyPin: async (pin) => {
        try {
            const res = await api.post('/auth/verify-pin', { pin });
            set({
                employee: res.data.employee,
                activeShift: res.data.activeShift || null
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    clockIn: async (mood, photoUrl) => {
        const { employee } = get();
        if (!employee) return;

        const timestamp = new Date().toISOString();
        const payload = {
            employeeId: employee.id,
            mood,
            photoUrl,
            timestamp
        };

        try {
            if (navigator.onLine) {
                await api.post('/shifts/clock-in', payload);
            } else {
                throw new Error("Offline");
            }
        } catch (error) {
            console.log("Saving offline...");
            await db.pendingShifts.add({
                ...payload,
                tenantId: employee.tenantId,
                type: 'CLOCK_IN'
            });
        }

        // Reset state
        set({ employee: null, activeShift: null });
    },

    clockOut: async (exitMood, comments) => {
        const { employee } = get();
        if (!employee) return;

        const timestamp = new Date().toISOString();
        const payload = {
            employeeId: employee.id,
            exitMood,
            comments,
            timestamp
        };

        try {
            if (navigator.onLine) {
                await api.post('/shifts/clock-out', payload);
            } else {
                throw new Error("Offline");
            }
        } catch (error) {
            console.log("Saving offline clock-out...");
            await db.pendingShifts.add({
                ...payload,
                tenantId: employee.tenantId,
                type: 'CLOCK_OUT'
            });
        }

        set({ employee: null, activeShift: null });
    },

    syncOffline: async () => {
        const pending = await db.pendingShifts.toArray();
        if (pending.length === 0) return;

        for (const shift of pending) {
            try {
                await api.post('/shifts/clock-in', shift);
                await db.pendingShifts.delete(shift.id); // Remove after sync
            } catch (e) {
                console.error("Sync failed for", shift.id, e);
            }
        }
    }
}));

// Listen to online status
window.addEventListener('online', () => {
    useStore.setState({ isOnline: true });
    useStore.getState().syncOffline();
});
window.addEventListener('offline', () => {
    useStore.setState({ isOnline: false });
});
