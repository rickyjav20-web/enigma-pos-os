export interface TenantContext {
    tenantId: string;
    userId?: string;
    roles?: string[];
}
export interface Event<T = any> {
    event_id: string;
    tenant_id: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    timestamp: number;
    actor_id: string;
    metadata: T;
    version: number;
}
export declare enum EventType {
    TABLE_OPENED = "mesa_abierta",
    TABLE_CLOSED = "mesa_cerrada",
    ORDER_PLACED = "orden_tomada",
    ORDER_SENT = "orden_enviada_cocina",
    ITEM_READY = "item_listo",
    ITEM_SERVED = "item_entregado",
    PAYMENT_RECEIVED = "pago_recibido",
    PRODUCT_CREATED = "producto_creado",
    PRODUCT_UPDATED = "producto_actualizado",
    PURCHASE_ORDER_CONFIRMED = "orden_compra_confirmada",
    NOTIFICATION_CREATED = "notification_created"
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
    price: number;
    cost?: number;
    loyverse_id?: string;
    sku?: string;
    track_inventory: boolean;
    variants?: Variant[];
    modifiers?: string[];
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
