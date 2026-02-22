import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const HEADERS = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };
const CACHE_KEY = 'enigma_currencies';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface Currency {
    id: string;
    code: string;       // 'USD', 'VES', 'COP'
    name: string;
    symbol: string;
    exchangeRate: number;  // units of this currency per 1 USD
    isBase: boolean;
    isActive: boolean;
}

interface CurrencyCache {
    data: Currency[];
    fetchedAt: number;
}

let globalCurrencies: Currency[] = [];
let globalFetchedAt = 0;

export function useCurrencies() {
    const [currencies, setCurrencies] = useState<Currency[]>(globalCurrencies);
    const [isLoading, setIsLoading] = useState(globalCurrencies.length === 0);

    useEffect(() => {
        const now = Date.now();

        // Use in-memory cache if fresh
        if (globalCurrencies.length > 0 && now - globalFetchedAt < CACHE_TTL) {
            setCurrencies(globalCurrencies);
            setIsLoading(false);
            return;
        }

        // Try localStorage
        try {
            const cached: CurrencyCache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (cached && now - cached.fetchedAt < CACHE_TTL) {
                globalCurrencies = cached.data;
                globalFetchedAt = cached.fetchedAt;
                setCurrencies(globalCurrencies);
                setIsLoading(false);
                return;
            }
        } catch { /* ignore */ }

        const DEFAULTS: Currency[] = [
            { id: 'usd', code: 'USD', name: 'Dolar', symbol: '$',   exchangeRate: 1,    isBase: true,  isActive: true },
            { id: 'ves', code: 'VES', name: 'Bolivar', symbol: 'Bs.', exchangeRate: 55, isBase: false, isActive: true },
            { id: 'cop', code: 'COP', name: 'Peso', symbol: '$',    exchangeRate: 4200, isBase: false, isActive: true },
        ];

        // Fetch from API
        fetchCurrencies().then(data => {
            // Fall back to defaults if API returns empty (not yet seeded)
            const final = data.length > 0 ? data : DEFAULTS;
            globalCurrencies = final;
            globalFetchedAt = Date.now();
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ data: final, fetchedAt: globalFetchedAt }));
            } catch { /* ignore */ }
            setCurrencies(final);
            setIsLoading(false);
        }).catch(() => {
            // Fallback to sane defaults if API is down
            setCurrencies(DEFAULTS);
            setIsLoading(false);
        });
    }, []);

    /** Refresh rates from API (call after HQ updates a rate) */
    const refresh = async () => {
        globalFetchedAt = 0;
        try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        const data = await fetchCurrencies();
        globalCurrencies = data;
        globalFetchedAt = Date.now();
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: globalFetchedAt }));
        } catch { /* ignore */ }
        setCurrencies(data);
    };

    /** Convert an amount in local currency to USD */
    const toUSD = (amount: number, code: string): number => {
        const cur = currencies.find(c => c.code === code);
        if (!cur || cur.isBase) return amount;
        return amount / cur.exchangeRate;
    };

    /** Get exchange rate for a currency code */
    const getRate = (code: string): number => {
        const cur = currencies.find(c => c.code === code);
        return cur ? cur.exchangeRate : 1;
    };

    /** Format an amount in local currency */
    const formatLocal = (amount: number, code: string): string => {
        const cur = currencies.find(c => c.code === code);
        if (!cur) return `$${amount.toFixed(2)}`;
        if (code === 'COP') {
            return `${cur.symbol}${Math.round(amount).toLocaleString('es-CO')}`;
        }
        return `${cur.symbol}${amount.toFixed(2)}`;
    };

    return { currencies, isLoading, toUSD, getRate, formatLocal, refresh };
}

async function fetchCurrencies(): Promise<Currency[]> {
    const res = await fetch(`${API_URL}/currencies`, { headers: HEADERS });
    if (!res.ok) throw new Error('Failed to fetch currencies');
    return res.json();
}
