import type z from "zod";
import type { BaseSchema } from "../../src/defineSchema";
import type { Storage } from "../../src/defineStorage";

/**
 * In-memory storage implementation for testing purposes.
 * This storage keeps all events in memory using a Map structure.
 */
export class InMemoryStorage implements Storage {
  private events: Map<string, z.infer<BaseSchema["event"]>[]> = new Map();

  /**
   * Retrieves all events for a specific entity.
   */
  async getEventsByEntityId(args: {
    entityName: string;
    entityId: string;
  }): Promise<z.infer<BaseSchema["event"]>[]> {
    const key = `${args.entityName}:${args.entityId}`;
    return this.events.get(key) || [];
  }

  /**
   * Commits new events to the storage.
   */
  async commitEvents(args: {
    events: z.infer<BaseSchema["event"]>[];
  }): Promise<void> {
    for (const event of args.events) {
      const key = `${event.entityName}:${event.entityId}`;
      const existing = this.events.get(key) || [];
      this.events.set(key, [...existing, event]);
    }
  }

  /**
   * Utility method to clear all events (useful for test cleanup).
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Utility method to get all stored events (useful for debugging tests).
   */
  getAllEvents(): z.infer<BaseSchema["event"]>[] {
    const allEvents: z.infer<BaseSchema["event"]>[] = [];
    for (const events of this.events.values()) {
      allEvents.push(...events);
    }
    return allEvents;
  }

  /**
   * Utility method to get the count of events for a specific entity.
   */
  getEventCount(entityName: string, entityId: string): number {
    const key = `${entityName}:${entityId}`;
    return this.events.get(key)?.length || 0;
  }
}