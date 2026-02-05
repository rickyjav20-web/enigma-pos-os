"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productReadModel = void 0;
const types_1 = require("@enigma/types");
const EventBus_1 = require("../events/EventBus");
class ProductReadModel {
    constructor() {
        this.products = new Map();
        this.startProjection();
    }
    startProjection() {
        console.log(`[ProductReadModel] Subscribing to ${types_1.EventType.PRODUCT_CREATED}`);
        EventBus_1.eventBus.subscribe(types_1.EventType.PRODUCT_CREATED, (event) => {
            console.log(`[ProductReadModel] Received PRODUCT_CREATED: ${event.entity_id}`);
            const product = event.metadata;
            // Ensure ID matches entity_id if not present
            if (!product.id)
                product.id = event.entity_id;
            this.products.set(product.id, product);
            console.log(`[ProductReadModel] Product Stored. Total: ${this.products.size}`);
        });
    }
    getProducts(tenantId) {
        // In memory filter (Production would use SQL WHERE)
        return Array.from(this.products.values()).filter(p => p.tenant_id === tenantId);
    }
}
exports.productReadModel = new ProductReadModel();
