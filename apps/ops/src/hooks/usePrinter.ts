/**
 * usePrinter – Web Bluetooth thermal receipt printer hook
 * Uses @point-of-sale libraries for ESC/POS encoding + BLE communication
 * Fetches receipt config from API for customizable formatting.
 * Supports multi-currency totals and logo printing.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TH: Record<string, string> = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

export interface ReceiptConfig {
    businessName: string;
    logoUrl: string;
    headerLine1: string;
    headerLine2: string;
    footerLine1: string;
    footerLine2: string;
    showTable: boolean;
    showEmployee: boolean;
    showOrderType: boolean;
    showTicketName: boolean;
    showDateTime: boolean;
    showUSD: boolean;
    showVES: boolean;
    showCOP: boolean;
    paperWidth: number;
}

export interface CurrencyRate {
    code: string;
    symbol: string;
    exchangeRate: number; // per 1 USD
}

export interface ReceiptData {
    ticketName: string;
    tableName?: string | null;
    employeeName: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    paymentMethod?: string;
    date?: Date;
    currencies?: CurrencyRate[]; // live rates for multi-currency
}

const DEFAULT_CONFIG: ReceiptConfig = {
    businessName: 'Enigma Cafe',
    logoUrl: '',
    headerLine1: '',
    headerLine2: '',
    footerLine1: 'Gracias por tu visita!',
    footerLine2: 'Las propinas se agradecen',
    showTable: true,
    showEmployee: true,
    showOrderType: false,
    showTicketName: true,
    showDateTime: true,
    showUSD: true,
    showVES: false,
    showCOP: false,
    paperWidth: 32,
};

const PRINTER_KEY = 'ops_bt_printer';
const CONFIG_CACHE_KEY = 'ops_receipt_config';

/**
 * Sanitize text for ESC/POS thermal printers.
 * Replaces Unicode chars that thermal printers can't handle:
 * - Em/en dashes → hyphen
 * - Smart quotes → straight quotes
 * - Accented chars are OK (codepage 858/latin)
 * - Other non-ASCII → stripped
 */
function sanitize(text: string): string {
    return text
        .replace(/[\u2014\u2013\u2015]/g, '-')  // em dash, en dash → hyphen
        .replace(/[\u2018\u2019]/g, "'")          // smart single quotes
        .replace(/[\u2022]/g, '*')                // bullet → asterisk
        .replace(/[\u2026]/g, '...')              // ellipsis
        .replace(/[\u00b7]/g, '-')                // middle dot → hyphen
        .replace(/\u00a0/g, ' ');                 // non-breaking space → space
}

/** Load an image from URL and return as ImageData for the encoder */
async function loadLogoImage(url: string, maxWidth: number): Promise<ImageData | null> {
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = url;
        });
        // Scale to fit printer width (max ~384px for 58mm, ~576px for 80mm)
        const printWidth = Math.min(img.width, maxWidth);
        const scale = printWidth / img.width;
        const w = Math.floor(img.width * scale);
        const h = Math.floor(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        // White background (thermal printers treat transparent as black)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
    } catch {
        return null;
    }
}

export function usePrinter() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(() => {
        try { return localStorage.getItem(PRINTER_KEY); } catch { return null; }
    });
    const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(() => {
        try {
            const cached = localStorage.getItem(CONFIG_CACHE_KEY);
            return cached ? JSON.parse(cached) : DEFAULT_CONFIG;
        } catch { return DEFAULT_CONFIG; }
    });
    const printerRef = useRef<WebBluetoothReceiptPrinter | null>(null);

    // Initialize printer instance once
    useEffect(() => {
        const printer = new WebBluetoothReceiptPrinter();
        printerRef.current = printer;

        printer.addEventListener('connected', (e: any) => {
            setConnected(true);
            setConnecting(false);
            const name = e?.name || e?.detail?.name || 'Printer';
            setPrinterName(name);
            try { localStorage.setItem(PRINTER_KEY, name); } catch { /* */ }
        });

        printer.addEventListener('disconnected', () => {
            setConnected(false);
        });

        return () => { printerRef.current = null; };
    }, []);

    // Fetch receipt config from API on mount
    useEffect(() => {
        fetch(`${API_URL}/receipt-config`, { headers: TH })
            .then(r => r.json())
            .then(res => {
                if (res.success && res.data) {
                    setReceiptConfig(res.data);
                    try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(res.data)); } catch { /* */ }
                }
            })
            .catch(() => { /* use cached/default */ });
    }, []);

    const connect = useCallback(async () => {
        if (!printerRef.current) return;
        setConnecting(true);
        try {
            await printerRef.current.connect();
        } catch (err) {
            console.error('Printer connect error:', err);
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (!printerRef.current) return;
        try { await printerRef.current.disconnect(); } catch { /* */ }
        setConnected(false);
        setPrinterName(null);
        try { localStorage.removeItem(PRINTER_KEY); } catch { /* */ }
    }, []);

    const printReceipt = useCallback(async (data: ReceiptData) => {
        if (!printerRef.current || !connected) return;
        setPrinting(true);
        try {
            const cfg = receiptConfig;
            const cols = cfg.paperWidth || 32;
            const encoder = new ReceiptPrinterEncoder({ columns: cols, language: 'esc-pos' });

            const now = data.date || new Date();
            const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });

            let r = encoder.initialize();

            // Logo — if configured, print logo INSTEAD of text title
            let logoPrinted = false;
            if (cfg.logoUrl) {
                const maxPx = cols === 48 ? 576 : 384;
                const logoData = await loadLogoImage(cfg.logoUrl, maxPx);
                if (logoData) {
                    r = r.align('center').image(logoData, logoData.width, logoData.height, 'threshold').newline();
                    logoPrinted = true;
                }
            }

            // Business name — only as large text if no logo was printed
            if (!logoPrinted) {
                const nameParts = cfg.businessName.split(' ');
                const nameTop = nameParts[0]?.toUpperCase() || '';
                const nameBottom = nameParts.slice(1).join(' ').toUpperCase();
                r = r.align('center').bold(true).size(2, 2).line(sanitize(nameTop));
                if (nameBottom) r = r.size(1, 1).line(sanitize(nameBottom));
                r = r.bold(false).size(1, 1);
            } else {
                // With logo, print business name smaller below it
                r = r.align('center').bold(true).line(sanitize(cfg.businessName.toUpperCase())).bold(false);
            }

            if (cfg.headerLine1) r = r.align('center').line(sanitize(cfg.headerLine1));
            if (cfg.headerLine2) r = r.line(sanitize(cfg.headerLine2));

            r = r.newline().rule().align('left');

            // Order info
            if (cfg.showTable && data.tableName) r = r.line(sanitize(`Pedido: ${data.tableName}`));
            if (cfg.showEmployee) r = r.line(sanitize(`Empleado: ${data.employeeName}`));
            if (cfg.showTicketName) r = r.line(sanitize(`Ticket: ${data.ticketName}`));

            r = r.rule().bold(true).line('CUENTA').bold(false).rule();

            // Items
            const priceColW = 10;
            const nameColW = cols - priceColW;
            for (const item of data.items) {
                const lineTotal = (item.price * item.quantity).toFixed(2);
                r = r
                    .line(sanitize(item.name))
                    .table(
                        [{ width: nameColW, align: 'left' }, { width: priceColW, align: 'right' }],
                        [[`  ${item.quantity} x $${item.price.toFixed(2)}`, `$${lineTotal}`]]
                    );
            }

            r = r.rule();

            // Totals — use currencies passed from the component (live rates)
            const halfCol = Math.floor(cols / 2);
            const currencies = data.currencies || [];

            // USD total (always if showUSD)
            if (cfg.showUSD) {
                r = r
                    .bold(true)
                    .size(1, 2)
                    .table(
                        [{ width: halfCol, align: 'left' }, { width: halfCol, align: 'right' }],
                        [['TOTAL', `$${data.total.toFixed(2)}`]]
                    )
                    .size(1, 1)
                    .bold(false);
            }

            // VES total
            if (cfg.showVES) {
                const vesRate = currencies.find(c => c.code === 'VES');
                if (vesRate && vesRate.exchangeRate > 0) {
                    const vesTotal = data.total * vesRate.exchangeRate;
                    r = r.table(
                        [{ width: halfCol, align: 'left' }, { width: halfCol, align: 'right' }],
                        [[cfg.showUSD ? '' : 'TOTAL', `Bs.${vesTotal.toFixed(2)}`]]
                    );
                }
            }

            // COP total
            if (cfg.showCOP) {
                const copRate = currencies.find(c => c.code === 'COP');
                if (copRate && copRate.exchangeRate > 0) {
                    const copTotal = Math.round(data.total * copRate.exchangeRate);
                    r = r.table(
                        [{ width: halfCol, align: 'left' }, { width: halfCol, align: 'right' }],
                        [['', `$${copTotal.toLocaleString('es-CO')} COP`]]
                    );
                }
            }

            r = r.newline();

            // Payment method
            if (data.paymentMethod) {
                const payLabel =
                    data.paymentMethod === 'cash' ? 'Efectivo' :
                    data.paymentMethod === 'card' ? 'Tarjeta' :
                    data.paymentMethod === 'bolivares' ? 'Bolivares' :
                    data.paymentMethod === 'zelle' ? 'Zelle' :
                    data.paymentMethod === 'binance' ? 'Binance' :
                    data.paymentMethod === 'bancolombia' ? 'Bancolombia' :
                    data.paymentMethod;
                r = r.align('center').line(sanitize(`Pago: ${payLabel}`)).newline();
            }

            // Footer
            r = r.rule().align('center');
            if (cfg.footerLine1) r = r.line(sanitize(cfg.footerLine1));
            if (cfg.footerLine2) r = r.line(sanitize(cfg.footerLine2));
            if (cfg.showDateTime) r = r.newline().line(`${dateStr} ${timeStr}`);

            r = r.newline().newline().newline().cut();

            const result = r.encode();
            await printerRef.current.print(result);
        } catch (err) {
            console.error('Print error:', err);
            throw err;
        } finally {
            setPrinting(false);
        }
    }, [connected, receiptConfig]);

    const refetchConfig = useCallback(() => {
        fetch(`${API_URL}/receipt-config`, { headers: TH })
            .then(r => r.json())
            .then(res => {
                if (res.success && res.data) {
                    setReceiptConfig(res.data);
                    try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(res.data)); } catch { /* */ }
                }
            })
            .catch(() => {});
    }, []);

    return {
        connected,
        connecting,
        printing,
        printerName,
        receiptConfig,
        connect,
        disconnect,
        printReceipt,
        refetchConfig,
    };
}
