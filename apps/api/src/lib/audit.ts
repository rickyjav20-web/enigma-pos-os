import prisma from './prisma';

interface AuditEntry {
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
    employeeId?: string;
    employeeName?: string;
    amount?: number;
    metadata?: Record<string, any>;
    ipAddress?: string;
}

/** Log a financial or admin action for auditing. Non-blocking, never throws. */
export function logAudit(entry: AuditEntry): void {
    prisma.auditLog.create({
        data: {
            tenantId: entry.tenantId,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            employeeId: entry.employeeId || null,
            employeeName: entry.employeeName || null,
            amount: entry.amount || null,
            metadata: entry.metadata || null,
            ipAddress: entry.ipAddress || null,
        },
    }).catch((err) => {
        console.warn('[AUDIT] Failed to log:', entry.action, err?.message || err);
    });
}
