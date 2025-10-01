import type { z } from "zod";
import type { BaseSchema } from "./defineSchema";

/**
 * Storage interface for persisting and retrieving events.
 *
 * @remarks
 * The Storage interface abstracts the underlying persistence mechanism,
 * allowing the event sourcing system to work with any storage backend.
 * Implementations can range from in-memory stores for testing to distributed
 * databases for production deployments.
 *
 * ## Key Requirements
 *
 * - **Append-Only**: Events are immutable once written
 * - **Ordering**: Events must maintain chronological order per entity
 * - **Isolation**: Events for different entities must be isolated
 * - **Atomicity**: Event batches must be committed atomically
 *
 * @since 1.0.0
 */
export type Storage = {
  /**
   * Retrieves all events for a specific entity.
   *
   * @param args - Query parameters
   * @param args.entityName - The type of entity (e.g., "user", "order")
   * @param args.entityId - The unique identifier of the entity
   * @returns A promise resolving to an array of events in chronological order
   *
   * @remarks
   * Events must be returned in the exact order they were committed to ensure
   * deterministic state reconstruction. An empty array should be returned
   * if no events exist for the specified entity.
   */
  getEventsByEntityId: (args: {
    entityName: string;
    entityId: string;
  }) => Promise<z.infer<BaseSchema["event"]>[]>;

  /**
   * Persists a batch of events to storage.
   *
   * @param args - Commit parameters
   * @param args.events - Array of events to persist
   * @returns A promise that resolves when persistence is complete
   *
   * @remarks
   * All events in a batch must be committed atomically - either all succeed
   * or all fail. This ensures consistency in the event log and prevents
   * partial state transitions.
   */
  commitEvents(args: { events: z.infer<BaseSchema["event"]>[] }): Promise<void>;
};

/**
 * Defines a storage implementation for the event sourcing system.
 *
 * @param storage - The storage implementation
 * @returns The same storage instance with type validation
 *
 * @remarks
 * This function provides type safety and validation for storage implementations.
 * It ensures that custom storage backends properly implement the required interface.
 *
 * ## Implementation Examples
 *
 * ### In-Memory Storage (for testing)
 * ```typescript
 * const inMemoryStorage = defineStorage({
 *   events: new Map<string, Event[]>(),
 *
 *   async getEventsByEntityId({ entityName, entityId }) {
 *     const key = `${entityName}:${entityId}`;
 *     return this.events.get(key) || [];
 *   },
 *
 *   async commitEvents({ events }) {
 *     for (const event of events) {
 *       const key = `${event.entityName}:${event.entityId}`;
 *       const existing = this.events.get(key) || [];
 *       this.events.set(key, [...existing, event]);
 *     }
 *   },
 * });
 * ```
 *
 * ### MongoDB Storage
 * ```typescript
 * const mongoStorage = defineStorage({
 *   async getEventsByEntityId({ entityName, entityId }) {
 *     const events = await db.collection('events')
 *       .find({ entityName, entityId })
 *       .sort({ eventCreatedAt: 1 })
 *       .toArray();
 *     return events;
 *   },
 *
 *   async commitEvents({ events }) {
 *     if (events.length === 0) return;
 *
 *     const session = await client.startSession();
 *
 *     try {
 *       await session.withTransaction(async () => {
 *         await db.collection('events').insertMany(events, { session });
 *       });
 *     } finally {
 *       await session.endSession();
 *     }
 *   },
 * });
 * ```
 *
 * @since 1.0.0
 */
export function defineStorage(storage: Storage): Storage {
  return storage;
}
