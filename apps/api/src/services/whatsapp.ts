/**
 * Enigma Notification Service (Telegram Bot API)
 * Official API, completely free, supports group chats.
 * Non-fatal: all calls are fire-and-forget with silent error handling.
 *
 * Env vars required:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather on Telegram
 *   TELEGRAM_CHAT_ID    — group chat ID (negative number, e.g. -1001234567890)
 */

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
 * Send a message to the configured Telegram group.
 * Uses MarkdownV2 parse_mode so *bold* works.
 * Non-fatal: resolves silently on any error.
 */
export async function alertGroup(message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('[Notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping.');
        return;
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'   // supports *bold* and `code`
            })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[Notify] Telegram error: ${res.status} — ${body}`);
        }
    } catch (err: any) {
        console.warn('[Notify] Network error:', err?.message ?? err);
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

export function notifyClockOut(opts: {
    employeeName: string;
    role: string;
    clockIn: Date;
}) {
    return alertGroup(
        `🏁 *SALIDA DE TURNO*\n` +
        `👤 ${opts.employeeName} (${opts.role})\n` +
        `⏱ Turno: ${fduration(opts.clockIn)}\n` +
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
