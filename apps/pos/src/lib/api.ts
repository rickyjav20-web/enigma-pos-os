import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TENANT_ID = 'enigma_hq';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
    },
    timeout: 10000,
});

export default api;
export { API_URL, TENANT_ID };
