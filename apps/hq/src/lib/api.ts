import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Mock Tenant ID for MVP (This would come from Auth Context)
export const CURRENT_TENANT_ID = 'enigma_hq';

api.interceptors.request.use((config) => {
    config.headers['x-tenant-id'] = CURRENT_TENANT_ID;
    return config;
});
