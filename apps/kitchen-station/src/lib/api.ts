import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'enigma_hq';

export { API_URL, TENANT_ID };

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
    },
});

// Auto-logout on 401 (session expired or invalid)
api.interceptors.response.use(
    res => res,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('kitchen_user');
            localStorage.removeItem('kitchen_login_at');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    },
);
