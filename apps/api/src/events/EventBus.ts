import { EventEmitter } from 'events';
import { Event, EventType } from '@enigma/types';

class EventBus extends EventEmitter {
    constructor() {
        super();
    }

    public publish(event: Event): void {
        console.log(`[EventBus] Publishing: ${event.event_type} (${event.event_id})`);
        console.log(`[EventBus] Subscriber count for ${event.event_type}: ${this.listenerCount(event.event_type)}`);
        // In production, this would also write to the DB/EventStore
        this.emit(event.event_type, event);
        this.emit('*', event); // Wildcard for logging/persistence
    }

    public subscribe(eventType: EventType | string, handler: (event: Event) => void): void {
        this.on(eventType, handler);
    }
}

export const eventBus = new EventBus();
