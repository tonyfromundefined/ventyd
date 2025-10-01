import type { Collection, Db } from "mongodb";
import type z from "zod";
import type { BaseSchema } from "../../src/defineSchema";
import type { Storage } from "../../src/defineStorage";

/**
 * MongoDB storage implementation for event sourcing.
 * This storage uses MongoDB to persist events.
 */
export class MongoDBStorage implements Storage {
  private eventsCollection: Collection<z.infer<BaseSchema["event"]>>;

  constructor(db: Db) {
    this.eventsCollection = db.collection("events");

    // Create indexes for better query performance
    this.eventsCollection.createIndex({ entityName: 1, entityId: 1 });
    this.eventsCollection.createIndex({ eventCreatedAt: 1 });
  }

  /**
   * Retrieves all events for a specific entity.
   */
  async getEventsByEntityId(args: {
    entityName: string;
    entityId: string;
  }): Promise<z.infer<BaseSchema["event"]>[]> {
    const events = await this.eventsCollection
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
  }

  /**
   * Commits new events to the storage.
   */
  async commitEvents(args: {
    events: z.infer<BaseSchema["event"]>[];
  }): Promise<void> {
    if (args.events.length === 0) return;

    await this.eventsCollection.insertMany(args.events as any);
  }

  /**
   * Utility method to clear all events (useful for test cleanup).
   */
  async clear(): Promise<void> {
    await this.eventsCollection.deleteMany({});
  }

  /**
   * Utility method to get all stored events (useful for debugging tests).
   */
  async getAllEvents(): Promise<z.infer<BaseSchema["event"]>[]> {
    const events = await this.eventsCollection.find({}).toArray();

    // Remove MongoDB's _id field
    return events.map((event) => {
      const { _id, ...rest } = event as any;
      return rest;
    });
  }

  /**
   * Utility method to get the count of events for a specific entity.
   */
  async getEventCount(entityName: string, entityId: string): Promise<number> {
    return await this.eventsCollection.countDocuments({
      entityName,
      entityId,
    });
  }

  /**
   * Close the database connection (useful for cleanup).
   */
  async close(): Promise<void> {
    // The client connection should be managed externally
    // This is just a placeholder for interface consistency
  }
}
