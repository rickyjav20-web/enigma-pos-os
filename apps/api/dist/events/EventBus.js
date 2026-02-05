"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const events_1 = require("events");
class EventBus extends events_1.EventEmitter {
    constructor() {
        super();
    }
    publish(event) {
        console.log(`[EventBus] Publishing: ${event.event_type} (${event.event_id})`);
        console.log(`[EventBus] Subscriber count for ${event.event_type}: ${this.listenerCount(event.event_type)}`);
        // In production, this would also write to the DB/EventStore
        this.emit(event.event_type, event);
        this.emit('*', event); // Wildcard for logging/persistence
    }
    subscribe(eventType, handler) {
        this.on(eventType, handler);
    }
}
exports.eventBus = new EventBus();
