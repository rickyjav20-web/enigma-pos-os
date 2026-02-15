"use strict";
// Enigma OS - Shared Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventType = void 0;
// Standard Event Types
var EventType;
(function (EventType) {
    EventType["TABLE_OPENED"] = "mesa_abierta";
    EventType["TABLE_CLOSED"] = "mesa_cerrada";
    EventType["ORDER_PLACED"] = "orden_tomada";
    EventType["ORDER_SENT"] = "orden_enviada_cocina";
    EventType["ITEM_READY"] = "item_listo";
    EventType["ITEM_SERVED"] = "item_entregado";
    EventType["PAYMENT_RECEIVED"] = "pago_recibido";
    // Product Events
    EventType["PRODUCT_CREATED"] = "producto_creado";
    EventType["PRODUCT_UPDATED"] = "producto_actualizado";
    // Purchase Events
    EventType["PURCHASE_ORDER_CONFIRMED"] = "orden_compra_confirmada";
    // Notification Events
    EventType["NOTIFICATION_CREATED"] = "notification_created";
    // Kitchen Events
    EventType["PRODUCTION_BATCH_COMPLETED"] = "production_batch_completed";
    EventType["WASTE_REPORTED"] = "waste_reported";
})(EventType || (exports.EventType = EventType = {}));
