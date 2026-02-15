
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
    PAYMENT_RECEIVED = 'pago_recibido',

    // Product Events
    PRODUCT_CREATED = 'producto_creado',
    PRODUCT_UPDATED = 'producto_actualizado',

    // Purchase Events
    PURCHASE_ORDER_CONFIRMED = 'orden_compra_confirmada',

    // Notification Events
    NOTIFICATION_CREATED = 'notification_created',

    // Kitchen Events
    PRODUCTION_BATCH_COMPLETED = 'production_batch_completed',
    WASTE_REPORTED = 'waste_reported'
}

export interface BaseEntity {
    id: string;
    tenant_id: string;
    created_at: number;
    updated_at: number;
}

export interface Product extends BaseEntity {
    name: string;
    description?: string;
    category_id?: string;
    image_url?: string;
    is_active: boolean;

    // Pricing
    price: number;
    cost?: number; // For analytics

    // Loyverse Mapping
    loyverse_id?: string;
    sku?: string;

    // Configuration
    track_inventory: boolean;

    // Relations
    variants?: Variant[];
    modifiers?: string[]; // IDs of ModifierGroups
}

export interface Variant {
    id: string;
    name: string;
    price: number;
    cost?: number;
    sku?: string;
    loyverse_id?: string;
}

export interface Category extends BaseEntity {
    name: string;
    color?: string;
    loyverse_id?: string;
}

export interface ModifierGroup extends BaseEntity {
    name: string;
    options: ModifierOption[];
}

export interface ModifierOption {
    id: string;
    name: string;
    price_delta: number;
}
