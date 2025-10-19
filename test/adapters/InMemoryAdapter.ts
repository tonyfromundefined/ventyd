/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import type { Adapter } from "../../src/Adapter";

type BaseEvent = {
  eventId: string;
  eventName: `${string}:${string}`;
  eventCreatedAt: string;
  entityName: string;
  entityId: string;
  body: {};
};

/**
 * In-memory adapter implementation for testing purposes.
 * This adapter keeps all events in memory using a Map structure.
 */
export const createInMemoryAdapter = (): InMemoryAdapter => {
  const events: Map<string, BaseEvent[]> = new Map();

  const adapter: Adapter = {
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
     * Commits new events to the adapter.
     */
    async commitEvents(args: {
      events: BaseEvent[];
      state: any;
    }): Promise<void> {
      for (const event of args.events) {
        const key = `${event.entityName}:${event.entityId}`;
        const existing = events.get(key) || [];
        events.set(key, [...existing, event]);
      }
      // Note: In this simple implementation, we don't persist state separately
      // since it can be reconstructed from events
    },
  };

  return {
    ...adapter,
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

export type InMemoryAdapter = Adapter & {
  clear(): void;
  getAllEvents(): BaseEvent[];
  getEventCount(entityName: string, entityId: string): number;
};
