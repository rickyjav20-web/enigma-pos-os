/**
 * WhatsApp Notification Service (Wazend)
 * Non-fatal: all calls are fire-and-forget with silent error handling.
 * Env vars required: WAZEND_INSTANCE, WAZEND_API_KEY, WHATSAPP_GROUP_ID
 */

const WAZEND_BASE = 'https://api2.wazend.net';

function cfg() {
    return {
        instance: process.env.WAZEND_INSTANCE,
        apiKey: process.env.WAZEND_API_KEY,
        groupId: process.env.WHATSAPP_GROUP_ID
    };
}

/**
 * Format a Date in Venezuela time (America/Caracas, UTC-4, no DST)
 */
export function ftime(date: Date = new Date()): string {
    return date.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });
}

/**
 * Format duration between two dates as "Xh Ymin"
 */
export function fduration(from: Date, to: Date = new Date()): string {
    const diffMs = to.getTime() - from.getTime();
    const totalMin = Math.round(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
}

/**
 * Send a text message to the configured WhatsApp group via Wazend.
 * Non-fatal: resolves silently on error.
 */
export async function alertGroup(message: string): Promise<void> {
    const { instance, apiKey, groupId } = cfg();
    if (!instance || !apiKey || !groupId) {
        console.warn('[WA] Missing env vars — skipping notification.');
        return;
    }
    try {
        const res = await fetch(`${WAZEND_BASE}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apiKey': apiKey
            },
            body: JSON.stringify({ number: groupId, text: message })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[WA] Send failed: ${res.status} ${body}`);
        }
    } catch (err: any) {
        console.warn('[WA] Network error:', err?.message ?? err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-formatted notification builders
// ─────────────────────────────────────────────────────────────────────────────

export function notifyRegisterOpen(opts: {
    employeeName: string;
    physicalCash: number;
    electronicCash: number;
}) {
    return alertGroup(
        `🟢 *APERTURA DE CAJA*\n` +
        `👤 ${opts.employeeName}\n` +
        `💵 Efectivo: $${opts.physicalCash.toFixed(2)}\n` +
        `📱 Electrónica: $${opts.electronicCash.toFixed(2)}\n` +
        `🕐 ${ftime()}`
    ).catch(() => {});
}

export function notifyRegisterClose(opts: {
    employeeName: string;
    expectedCash: number;
    declaredCash: number;
    difference: number;
    openedAt: Date;
}) {
    const diffStr = opts.difference >= 0
        ? `+$${opts.difference.toFixed(2)}`
        : `-$${Math.abs(opts.difference).toFixed(2)}`;
    const diffIcon = Math.abs(opts.difference) < 0.01 ? '✅' :
        Math.abs(opts.difference) < 5 ? '⚠️' : '🔴';

    return alertGroup(
        `🔴 *CIERRE DE CAJA*\n` +
        `👤 ${opts.employeeName}\n` +
        `💰 Esperado: $${opts.expectedCash.toFixed(2)}\n` +
        `💵 Declarado: $${opts.declaredCash.toFixed(2)}\n` +
        `${diffIcon} Diferencia: ${diffStr}\n` +
        `⏱ Duración: ${fduration(opts.openedAt)}\n` +
        `🕐 ${ftime()}`
    ).catch(() => {});
}

export function notifyClockIn(opts: {
    employeeName: string;
    role: string;
}) {
    return alertGroup(
        `👋 *EMPLEADO ACTIVO*\n` +
        `👤 ${opts.employeeName} (${opts.role})\n` +
        `✅ Entrada registrada\n` +
        `🕐 ${ftime()}`
    ).catch(() => {});
}

export function notifyPurchase(opts: {
    supplierName: string;
    totalAmount: number;
    lineCount: number;
    currency?: string;
}) {
    const currencyLabel = opts.currency && opts.currency !== 'USD'
        ? ` (${opts.currency})`
        : '';
    return alertGroup(
        `🛒 *NUEVA COMPRA*\n` +
        `🏭 Proveedor: ${opts.supplierName}\n` +
        `💵 Total: $${opts.totalAmount.toFixed(2)}${currencyLabel}\n` +
        `📦 ${opts.lineCount} ${opts.lineCount === 1 ? 'artículo' : 'artículos'}\n` +
        `🕐 ${ftime()}`
    ).catch(() => {});
}

export function notifyCashMovement(opts: {
    type: 'EXPENSE' | 'DEPOSIT';
    amount: number;
    description: string;
    employeeName?: string;
}) {
    const isExpense = opts.type === 'EXPENSE';
    return alertGroup(
        `${isExpense ? '💸' : '💰'} *${isExpense ? 'GASTO DE CAJA' : 'DEPOSITO EN CAJA'}*\n` +
        `📝 ${opts.description}\n` +
        `💵 $${Math.abs(opts.amount).toFixed(2)}\n` +
        (opts.employeeName ? `👤 ${opts.employeeName}\n` : '') +
        `🕐 ${ftime()}`
    ).catch(() => {});
}
