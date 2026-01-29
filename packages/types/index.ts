
// Enigma OS - Shared Types

export interface TenantContext {
    tenantId: string;
    userId?: string;
    roles?: string[];
}

export interface Event<T = any> {
    event_id: string;       // UUID v4
    tenant_id: string;      // UUID of the Organization/Tenant
    event_type: string;     // e.g., 'mesa_abierta', 'orden_tomada'
    entity_type: string;    // 'mesa', 'ticket', 'producto'
    entity_id: string;      // UUID of the aggregate
    timestamp: number;      // Unix timestamp (ms)
    actor_id: string;       // ID of user performing action
    metadata: T;            // Payload specific to the event
    version: number;        // Schema version (default 1)
}

// Standard Event Types
export enum EventType {
    TABLE_OPENED = 'mesa_abierta',
    TABLE_CLOSED = 'mesa_cerrada',
    ORDER_PLACED = 'orden_tomada',
    ORDER_SENT = 'orden_enviada_cocina',
    ITEM_READY = 'item_listo',
    ITEM_SERVED = 'item_entregado',
    PAYMENT_RECEIVED = 'pago_recibido'
}

export interface BaseEntity {
    id: string;
    tenant_id: string;
    created_at: number;
    updated_at: number;
}
