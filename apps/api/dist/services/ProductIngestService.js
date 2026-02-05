"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productIngestService = exports.ProductIngestService = void 0;
const sync_1 = require("csv-parse/sync");
const types_1 = require("@enigma/types");
const EventBus_1 = require("../events/EventBus");
const crypto_1 = require("crypto");
class ProductIngestService {
    constructor() { }
    async ingestCsv(csvContent, tenantId, actorId) {
        const records = (0, sync_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true
        });
        // Group variations by Handle (Product ID in Loyverse)
        const productMap = new Map();
        for (const row of records) {
            // Mapping logic similar to Enigma Staff python scripts
            // Assuming 'handle' groups items
            const handle = row['Handle'] || row['handle'];
            if (!handle)
                continue;
            if (!productMap.has(handle)) {
                productMap.set(handle, {
                    name: row['Item Name'] || row['item_name'],
                    category: row['Category'] || row['category'],
                    variants: []
                });
            }
            const product = productMap.get(handle);
            product.variants.push({
                name: row['Variation Name'] || row['variation_name'],
                price: parseFloat(row['Price'] || row['price'] || '0'),
                cost: parseFloat(row['Cost'] || row['cost'] || '0'),
                sku: row['SKU'] || row['sku']
            });
        }
        let count = 0;
        // Generate Events for each Product
        for (const [handle, data] of productMap) {
            const productId = (0, crypto_1.randomUUID)();
            const payload = {
                name: data.name,
                category_id: data.category, // In real app, map this to Category ID
                price: data.variants[0]?.price || 0, // Base price
                variants: data.variants.map((v) => ({
                    id: (0, crypto_1.randomUUID)(),
                    name: v.name,
                    price: v.price,
                    cost: v.cost,
                    sku: v.sku
                })),
                is_active: true,
                loyverse_id: handle,
                tenant_id: tenantId
            };
            const event = {
                event_id: (0, crypto_1.randomUUID)(),
                tenant_id: tenantId,
                event_type: types_1.EventType.PRODUCT_CREATED,
                entity_type: 'product',
                entity_id: productId,
                timestamp: Date.now(),
                actor_id: actorId,
                metadata: payload,
                version: 1
            };
            EventBus_1.eventBus.publish(event);
            count++;
        }
        return count;
    }
}
exports.ProductIngestService = ProductIngestService;
exports.productIngestService = new ProductIngestService();
