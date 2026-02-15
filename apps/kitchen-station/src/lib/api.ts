import axios from 'axios';

// Default to local development URL, or environmental variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const CURRENT_TENANT_ID = 'enigma_hq'; // Hardcoded for MVP, ideally dynamic

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': CURRENT_TENANT_ID
    }
});

// Interceptor to attach token if we have one (future proofing)
api.interceptors.request.use(config => {
    // const token = localStorage.getItem('token');
    // if (token) {
    //     config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
});
