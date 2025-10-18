/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import type { Collection, Db } from "mongodb";
import { defineStorage } from "../../src/defineStorage";

type BaseEvent = {
  eventId: string;
  eventName: `${string}:${string}`;
  eventCreatedAt: string;
  entityName: string;
  entityId: string;
  body: any;
};

/**
 * MongoDB storage implementation for event sourcing.
 * This storage uses MongoDB to persist events.
 */
export const createMongoDBStorage = (db: Db) => {
  const eventsCollection: Collection<BaseEvent> = db.collection("events");

  const storage = defineStorage({
    /**
     * Retrieves all events for a specific entity.
     */
    async getEventsByEntityId(args: {
      entityName: string;
      entityId: string;
    }): Promise<BaseEvent[]> {
      const events = await eventsCollection
        .find({
          entityName: args.entityName,
          entityId: args.entityId,
        })
        .sort({ eventCreatedAt: 1 })
        .toArray();

      // Remove MongoDB's _id field
      return events.map((event) => {
        const { _id, ...rest } = event as any;
        return rest;
      });
    },

    /**
     * Commits new events to the storage.
     */
    async commitEvents(args: {
      events: BaseEvent[];
      state: any;
    }): Promise<void> {
      if (args.events.length === 0) return;

      await eventsCollection.insertMany(args.events as any);

      // Note: In this implementation, we don't persist state separately
      // since it can be reconstructed from events
    },
  });

  return {
    ...storage,
    /**
     * Utility method to clear all events (useful for test cleanup).
     */
    async clear(): Promise<void> {
      await eventsCollection.deleteMany({});
    },

    /**
     * Utility method to get all stored events (useful for debugging tests).
     */
    async getAllEvents(): Promise<BaseEvent[]> {
      const events = await eventsCollection.find({}).toArray();

      // Remove MongoDB's _id field
      return events.map((event) => {
        const { _id, ...rest } = event as any;
        return rest;
      });
    },

    /**
     * Utility method to get the count of events for a specific entity.
     */
    async getEventCount(entityName: string, entityId: string): Promise<number> {
      return await eventsCollection.countDocuments({
        entityName,
        entityId,
      });
    },

    /**
     * Close the database connection (useful for cleanup).
     */
    async close(): Promise<void> {
      // The client connection should be managed externally
      // This is just a placeholder for interface consistency
    },
  };
};

export type MongoDBStorage = ReturnType<typeof createMongoDBStorage>;
