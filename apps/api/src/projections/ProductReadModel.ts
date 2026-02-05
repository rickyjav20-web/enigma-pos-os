import { Product, Event, EventType } from '@enigma/types';
import { eventBus } from '../events/EventBus';

class ProductReadModel {
    private products: Map<string, Product> = new Map();

    constructor() {
        this.startProjection();
    }

    private startProjection() {
        console.log(`[ProductReadModel] Subscribing to ${EventType.PRODUCT_CREATED}`);
        eventBus.subscribe(EventType.PRODUCT_CREATED, (event: Event) => {
            console.log(`[ProductReadModel] Received PRODUCT_CREATED: ${event.entity_id}`);
            const product = event.metadata as Product;
            // Ensure ID matches entity_id if not present
            if (!product.id) product.id = event.entity_id;
            this.products.set(product.id, product);
            console.log(`[ProductReadModel] Product Stored. Total: ${this.products.size}`);
        });
    }

    public getProducts(tenantId: string): Product[] {
        // In memory filter (Production would use SQL WHERE)
        return Array.from(this.products.values()).filter(p => p.tenant_id === tenantId);
    }
}

export const productReadModel = new ProductReadModel();
