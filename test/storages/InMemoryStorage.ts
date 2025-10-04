import { defineStorage } from "../../src/defineStorage";

type BaseEvent = {
  eventId: string;
  eventName: `${string}:${string}`;
  eventCreatedAt: string;
  entityName: string;
  entityId: string;
  body: {};
};

/**
 * In-memory storage implementation for testing purposes.
 * This storage keeps all events in memory using a Map structure.
 */
export const createInMemoryStorage = () => {
  const events: Map<string, BaseEvent[]> = new Map();

  const storage = defineStorage({
    /**
     * Retrieves all events for a specific entity.
     */
    async getEventsByEntityId(args: {
      entityName: string;
      entityId: string;
    }): Promise<BaseEvent[]> {
      const key = `${args.entityName}:${args.entityId}`;
      return events.get(key) || [];
    },

    /**
     * Commits new events to the storage.
     */
    async commitEvents(args: { events: BaseEvent[] }): Promise<void> {
      for (const event of args.events) {
        const key = `${event.entityName}:${event.entityId}`;
        const existing = events.get(key) || [];
        events.set(key, [...existing, event]);
      }
    },
  });

  return {
    ...storage,
    /**
     * Utility method to clear all events (useful for test cleanup).
     */
    clear(): void {
      events.clear();
    },

    /**
     * Utility method to get all stored events (useful for debugging tests).
     */
    getAllEvents(): BaseEvent[] {
      const allEvents: BaseEvent[] = [];
      for (const evts of events.values()) {
        allEvents.push(...evts);
      }
      return allEvents;
    },

    /**
     * Utility method to get the count of events for a specific entity.
     */
    getEventCount(entityName: string, entityId: string): number {
      const key = `${entityName}:${entityId}`;
      return events.get(key)?.length || 0;
    },
  };
};

export type InMemoryStorage = ReturnType<typeof createInMemoryStorage>;
