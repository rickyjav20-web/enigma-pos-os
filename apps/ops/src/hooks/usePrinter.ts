/**
 * usePrinter – Web Bluetooth thermal receipt printer hook
 * Uses @point-of-sale libraries for ESC/POS encoding + BLE communication
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';

export interface ReceiptData {
    ticketName: string;
    tableName?: string | null;
    employeeName: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    paymentMethod: string;
    date?: Date;
}

const PRINTER_KEY = 'ops_bt_printer';

export function usePrinter() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [printerName, setPrinterName] = useState<string | null>(() => {
        try { return localStorage.getItem(PRINTER_KEY); } catch { return null; }
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

        return () => {
            // Cleanup
            printerRef.current = null;
        };
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
        try {
            await printerRef.current.disconnect();
        } catch { /* */ }
        setConnected(false);
        setPrinterName(null);
        try { localStorage.removeItem(PRINTER_KEY); } catch { /* */ }
    }, []);

    const printReceipt = useCallback(async (data: ReceiptData) => {
        if (!printerRef.current || !connected) return;
        setPrinting(true);
        try {
            const encoder = new ReceiptPrinterEncoder({
                columns: 32,
                language: 'esc-pos',
            });

            const now = data.date || new Date();
            const dateStr = now.toLocaleDateString('es-VE', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
            const timeStr = now.toLocaleTimeString('es-VE', {
                hour: '2-digit', minute: '2-digit', hour12: true,
            });

            const payLabel =
                data.paymentMethod === 'cash' ? 'Efectivo' :
                data.paymentMethod === 'card' ? 'Tarjeta' :
                data.paymentMethod === 'bolivares' ? 'Bolivares' :
                data.paymentMethod === 'zelle' ? 'Zelle' :
                data.paymentMethod === 'binance' ? 'Binance' :
                data.paymentMethod === 'bancolombia' ? 'Bancolombia' :
                data.paymentMethod;

            // Build receipt
            let receipt = encoder
                .initialize()
                .align('center')
                .bold(true)
                .size(2, 2)
                .line('ENIGMA')
                .size(1, 1)
                .line('CAFE')
                .bold(false)
                .newline()
                .rule()
                .align('left')
                .newline();

            // Table + Employee
            if (data.tableName) {
                receipt = receipt.line(`Pedido: ${data.tableName}`);
            }
            receipt = receipt
                .line(`Empleado: ${data.employeeName}`)
                .line(`Ticket: ${data.ticketName}`)
                .rule();

            // Items
            receipt = receipt
                .bold(true)
                .line('CUENTA')
                .bold(false)
                .rule();

            for (const item of data.items) {
                const lineTotal = (item.price * item.quantity).toFixed(2);
                receipt = receipt
                    .line(item.name)
                    .table(
                        [
                            { width: 20, align: 'left' },
                            { width: 12, align: 'right' },
                        ],
                        [
                            [`  ${item.quantity} x $${item.price.toFixed(2)}`, `$${lineTotal}`],
                        ]
                    );
            }

            receipt = receipt.rule();

            // Total
            receipt = receipt
                .bold(true)
                .size(1, 2)
                .table(
                    [
                        { width: 16, align: 'left' },
                        { width: 16, align: 'right' },
                    ],
                    [['TOTAL', `$${data.total.toFixed(2)}`]]
                )
                .size(1, 1)
                .bold(false)
                .newline();

            // Payment method
            receipt = receipt
                .align('center')
                .line(`Pago: ${payLabel}`)
                .newline();

            // Footer
            receipt = receipt
                .rule()
                .align('center')
                .line('Gracias por tu visita!')
                .line('Las propinas se agradecen')
                .newline()
                .line(`${dateStr} ${timeStr}`)
                .newline()
                .newline()
                .newline()
                .cut();

            const result = receipt.encode();
            await printerRef.current.print(result);
        } catch (err) {
            console.error('Print error:', err);
            throw err;
        } finally {
            setPrinting(false);
        }
    }, [connected]);

    return {
        connected,
        connecting,
        printing,
        printerName,
        connect,
        disconnect,
        printReceipt,
    };
}
