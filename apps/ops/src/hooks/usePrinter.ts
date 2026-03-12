/**
 * usePrinter – Web Bluetooth thermal receipt printer hook
 * Uses @point-of-sale libraries for ESC/POS encoding + BLE communication
 * Fetches receipt config from API for customizable formatting.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TH = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

export interface ReceiptConfig {
    businessName: string;
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

export interface ReceiptData {
    ticketName: string;
    tableName?: string | null;
    employeeName: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    paymentMethod?: string;
    date?: Date;
}

const DEFAULT_CONFIG: ReceiptConfig = {
    businessName: 'Enigma Cafe',
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

            // Split business name for large display (first word big, rest normal)
            const nameParts = cfg.businessName.split(' ');
            const nameTop = nameParts[0]?.toUpperCase() || '';
            const nameBottom = nameParts.slice(1).join(' ').toUpperCase();

            // Build receipt
            let r = encoder
                .initialize()
                .align('center')
                .bold(true)
                .size(2, 2)
                .line(nameTop);

            if (nameBottom) {
                r = r.size(1, 1).line(nameBottom);
            }
            r = r.bold(false).size(1, 1);

            if (cfg.headerLine1) r = r.line(cfg.headerLine1);
            if (cfg.headerLine2) r = r.line(cfg.headerLine2);

            r = r.newline().rule().align('left');

            // Order info
            if (cfg.showTable && data.tableName) {
                r = r.line(`Pedido: ${data.tableName}`);
            }
            if (cfg.showEmployee) {
                r = r.line(`Empleado: ${data.employeeName}`);
            }
            if (cfg.showTicketName) {
                r = r.line(`Ticket: ${data.ticketName}`);
            }

            r = r.rule().bold(true).line('CUENTA').bold(false).rule();

            // Items
            const priceColW = 10;
            const nameColW = cols - priceColW;
            for (const item of data.items) {
                const lineTotal = (item.price * item.quantity).toFixed(2);
                r = r
                    .line(item.name)
                    .table(
                        [{ width: nameColW, align: 'left' }, { width: priceColW, align: 'right' }],
                        [[`  ${item.quantity} x $${item.price.toFixed(2)}`, `$${lineTotal}`]]
                    );
            }

            r = r.rule();

            // Total
            const halfCol = Math.floor(cols / 2);
            r = r
                .bold(true)
                .size(1, 2)
                .table(
                    [{ width: halfCol, align: 'left' }, { width: halfCol, align: 'right' }],
                    [['TOTAL', `$${data.total.toFixed(2)}`]]
                )
                .size(1, 1)
                .bold(false)
                .newline();

            // Payment method (only if provided — for pre-payment "cuenta" prints, skip it)
            if (data.paymentMethod) {
                const payLabel =
                    data.paymentMethod === 'cash' ? 'Efectivo' :
                    data.paymentMethod === 'card' ? 'Tarjeta' :
                    data.paymentMethod === 'bolivares' ? 'Bolivares' :
                    data.paymentMethod === 'zelle' ? 'Zelle' :
                    data.paymentMethod === 'binance' ? 'Binance' :
                    data.paymentMethod === 'bancolombia' ? 'Bancolombia' :
                    data.paymentMethod;
                r = r.align('center').line(`Pago: ${payLabel}`).newline();
            }

            // Footer
            r = r.rule().align('center');
            if (cfg.footerLine1) r = r.line(cfg.footerLine1);
            if (cfg.footerLine2) r = r.line(cfg.footerLine2);

            if (cfg.showDateTime) {
                r = r.newline().line(`${dateStr} ${timeStr}`);
            }

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
