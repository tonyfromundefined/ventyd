import type {
  EventDefinitionInput,
  InferEventFromSchema,
  InferStateFromSchema,
  Schema,
  StateDefinitionInput,
} from "./schema-types";

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
export type Storage<
  $$Schema = Schema<string, EventDefinitionInput, StateDefinitionInput, string>,
> = {
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
  }) => Promise<InferEventFromSchema<$$Schema>[]>;

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
  commitEvents(args: {
    events: InferEventFromSchema<$$Schema>[];
    state: InferStateFromSchema<$$Schema>;
  }): Promise<void>;
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
 * const createInMemoryStorage = () => {
 *   const events = new Map<string, Event[]>();
 *
 *   return defineStorage({
 *     async getEventsByEntityId({ entityName, entityId }) {
 *       const key = `${entityName}:${entityId}`;
 *       return events.get(key) || [];
 *     },
 *
 *     async commitEvents({ events: newEvents }) {
 *       for (const event of newEvents) {
 *         const key = `${event.entityName}:${event.entityId}`;
 *         const existing = events.get(key) || [];
 *         events.set(key, [...existing, event]);
 *       }
 *     },
 *   });
 * };
 *
 * const inMemoryStorage = createInMemoryStorage();
 * ```
 *
 * ### MongoDB Storage
 * ```typescript
 * const createMongoDBStorage = (client: MongoClient, dbName: string) => {
 *   const db = client.db(dbName);
 *
 *   return defineStorage({
 *     async getEventsByEntityId({ entityName, entityId }) {
 *       const events = await db.collection('events')
 *         .find({ entityName, entityId })
 *         .sort({ eventCreatedAt: 1 })
 *         .toArray();
 *       return events;
 *     },
 *
 *     async commitEvents({ events }) {
 *       if (events.length === 0) return;
 *
 *       const session = await client.startSession();
 *
 *       try {
 *         await session.withTransaction(async () => {
 *           await db.collection('events').insertMany(events, { session });
 *         });
 *       } finally {
 *         await session.endSession();
 *       }
 *     },
 *   });
 * };
 *
 * const mongoStorage = createMongoDBStorage(mongoClient, 'myapp');
 * ```
 *
 * @since 1.0.0
 */
export function defineStorage<
  $$Schema = Schema<string, EventDefinitionInput, StateDefinitionInput, string>,
>(storage: Storage<$$Schema>): Storage<$$Schema> {
  return storage;
}
