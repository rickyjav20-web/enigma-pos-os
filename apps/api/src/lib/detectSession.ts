
import prisma from './prisma';

/** Get the current local hour for a tenant's timezone */
function getLocalHour(timezone: string): number {
    try {
        const now = new Date();
        const localTime = now.toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' });
        return parseInt(localTime, 10);
    } catch {
        // Invalid timezone — fallback to UTC-4 (Venezuela)
        return (new Date().getUTCHours() - 4 + 24) % 24;
    }
}

/** Get today's start in the tenant's local timezone */
function getLocalTodayStart(timezone: string): Date {
    try {
        const now = new Date();
        // Get the local date string in the tenant's timezone
        const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
        // Create a Date at midnight UTC, then adjust for the timezone offset
        const parts = localDateStr.split('-');
        const localMidnight = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 0, 0, 0));
        // Get the offset: difference between UTC midnight and local midnight
        const offsetMs = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: timezone })).getTime();
        return new Date(localMidnight.getTime() + offsetMs);
    } catch {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
}

/** Get the local date string (YYYY-MM-DD) for a tenant's timezone */
export function getLocalDateStr(timezone: string): string {
    try {
        return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    } catch {
        return new Date().toISOString().split('T')[0];
    }
}

/**
 * Intelligent session detection based on actual register sessions.
 *
 * Logic:
 * 1. If there's an open register AND a closed register from today → AFTERNOON
 * 2. If there's an open register AND NO closed register today → MORNING
 * 3. If no open register:
 *    - If there's a closed register today → AFTERNOON (morning done)
 *    - No sessions today → time-based fallback using tenant timezone
 *
 * All time comparisons use the tenant's configured timezone.
 */
export async function detectSessionSmart(tenantId: string): Promise<'MORNING' | 'AFTERNOON'> {
    try {
        // Get tenant timezone
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { timezone: true },
        });
        const tz = tenant?.timezone || 'America/Caracas';

        // Calculate "today" in tenant's local timezone
        const todayStart = getLocalTodayStart(tz);

        // Get today's register sessions (only PHYSICAL to avoid double-counting)
        const sessions = await prisma.registerSession.findMany({
            where: {
                tenantId,
                startedAt: { gte: todayStart },
                registerType: 'PHYSICAL',
            },
            orderBy: { startedAt: 'asc' },
            select: { id: true, status: true, startedAt: true, endedAt: true },
        });

        const openSessions = sessions.filter(s => s.status === 'open');
        const closedSessions = sessions.filter(s => s.status === 'closed');

        if (openSessions.length > 0) {
            if (closedSessions.length > 0) {
                return 'AFTERNOON'; // Previous session closed → this is afternoon
            }
            return 'MORNING'; // First session of the day
        }

        if (closedSessions.length > 0) {
            return 'AFTERNOON'; // Morning done, afternoon pending or done
        }

        // No sessions today — time-based fallback using tenant timezone
        const localHour = getLocalHour(tz);
        return localHour < 14 ? 'MORNING' : 'AFTERNOON';
    } catch {
        // DB error — safe fallback using UTC-4
        const hour = (new Date().getUTCHours() - 4 + 24) % 24;
        return hour < 14 ? 'MORNING' : 'AFTERNOON';
    }
}
