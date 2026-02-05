"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = commandRoutes;
const EventBus_1 = require("../events/EventBus");
const types_1 = require("@enigma/types");
const crypto_1 = require("crypto");
async function commandRoutes(fastify) {
    fastify.post('/commands', async (request, reply) => {
        const { command, payload, tenant_id, actor_id } = request.body;
        // TODO: Command Handlers Map (Validate -> Transform -> Event)
        // For MVP, we will directly map some commands to events
        let eventType = '';
        switch (command) {
            case 'OPEN_TABLE':
                eventType = types_1.EventType.TABLE_OPENED;
                break;
            default:
                return reply.status(400).send({ error: 'Unknown Command' });
        }
        const event = {
            event_id: (0, crypto_1.randomUUID)(),
            event_type: eventType,
            entity_type: 'table',
            entity_id: payload.table_id || (0, crypto_1.randomUUID)(),
            tenant_id,
            timestamp: Date.now(),
            actor_id,
            metadata: payload,
            version: 1
        };
        EventBus_1.eventBus.publish(event);
        return { success: true, event_id: event.event_id };
    });
}
