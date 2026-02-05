import { FastifyInstance } from 'fastify';
import { eventBus } from '../events/EventBus';
import { Event, EventType } from '@enigma/types';
import { randomUUID } from 'crypto';

interface CommandBody {
    command: string; // e.g., 'OPEN_TABLE'
    tenant_id: string;
    payload: any;
    actor_id: string;
}

export default async function commandRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: CommandBody }>('/commands', async (request, reply) => {
        const { command, payload, tenant_id, actor_id } = request.body;

        // TODO: Command Handlers Map (Validate -> Transform -> Event)
        // For MVP, we will directly map some commands to events

        let eventType: string = '';

        switch (command) {
            case 'OPEN_TABLE':
                eventType = EventType.TABLE_OPENED;
                break;
            default:
                return reply.status(400).send({ error: 'Unknown Command' });
        }

        const event: Event = {
            event_id: randomUUID(),
            event_type: eventType,
            entity_type: 'table',
            entity_id: payload.table_id || randomUUID(),
            tenant_id,
            timestamp: Date.now(),
            actor_id,
            metadata: payload,
            version: 1
        };

        eventBus.publish(event);

        return { success: true, event_id: event.event_id };
    });
}
