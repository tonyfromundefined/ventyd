import type {
  InferEntityNameFromSchema,
  InferEventFromSchema,
  InferStateFromSchema,
  Schema,
} from "./Schema";

/**
 * Adapter interface for persisting and retrieving events.
 *
 * @remarks
 * The Adapter interface provides the contract for connecting Ventyd to any
 * persistence backend. Implementations bridge the event sourcing system with
 * databases, message queues, or other storage mechanisms.
 *
 * ## Design Philosophy
 *
 * Adapters follow the **Adapter Pattern** from Gang of Four design patterns,
 * converting the interface of a storage backend into the interface expected
 * by Ventyd. This enables:
 *
 * - **Backend Flexibility**: Switch between databases without changing domain code
 * - **Testing Simplicity**: Use in-memory adapters for unit tests
 * - **Production Scalability**: Deploy with distributed databases
 *
 * ## Key Requirements
 *
 * - **Append-Only**: Events are immutable once written
 * - **Ordering**: Events must maintain chronological order per entity
 * - **Isolation**: Events for different entities must be isolated
 * - **Atomicity**: Event batches must be committed atomically
 *
 * ## Implementation Guide
 *
 * Implement the Adapter interface as a plain object, factory function, or class.
 * Choose the style that best fits your database client:
 *
 * ### Factory Function Pattern (Recommended)
 *
 * ```typescript
 * import type { Adapter } from 'ventyd';
 *
 * export const createMyAdapter = (client: DatabaseClient): Adapter => {
 *   return {
 *     async getEventsByEntityId({ entityName, entityId }) {
 *       // Query your database
 *       const rows = await client.query(
 *         'SELECT * FROM events WHERE entity_name = ? AND entity_id = ?',
 *         [entityName, entityId]
 *       );
 *       return rows;
 *     },
 *
 *     async commitEvents({ events, state }) {
 *       // Persist events atomically
 *       await client.transaction(async (tx) => {
 *         for (const event of events) {
 *           await tx.insert('events', event);
 *         }
 *       });
 *     },
 *   };
 * };
 * ```
 *
 * ### Direct Object Pattern
 *
 * ```typescript
 * import type { Adapter } from 'ventyd';
 *
 * const myAdapter: Adapter = {
 *   async getEventsByEntityId({ entityName, entityId }) {
 *     // Implementation
 *   },
 *   async commitEvents({ events, state }) {
 *     // Implementation
 *   },
 * };
 * ```
 *
 * ## Integration Examples
 *
 * ### Drizzle ORM
 *
 * ```typescript
 * import type { Adapter } from 'ventyd';
 * import { eq, and } from 'drizzle-orm';
 * import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
 *
 * export const createDrizzleAdapter = (
 *   db: NeonHttpDatabase<typeof schema>
 * ): Adapter => {
 *   return {
 *     async getEventsByEntityId({ entityName, entityId }) {
 *       return await db
 *         .select()
 *         .from(events)
 *         .where(and(
 *           eq(events.entityName, entityName),
 *           eq(events.entityId, entityId)
 *         ))
 *         .orderBy(events.eventCreatedAt);
 *     },
 *
 *     async commitEvents({ events: newEvents }) {
 *       if (newEvents.length === 0) return;
 *       await db.insert(events).values(newEvents);
 *     },
 *   };
 * };
 * ```
 *
 * ### Prisma
 *
 * ```typescript
 * import type { Adapter } from 'ventyd';
 * import type { PrismaClient } from '@prisma/client';
 *
 * export const createPrismaAdapter = (prisma: PrismaClient): Adapter => {
 *   return {
 *     async getEventsByEntityId({ entityName, entityId }) {
 *       return await prisma.event.findMany({
 *         where: { entityName, entityId },
 *         orderBy: { eventCreatedAt: 'asc' },
 *       });
 *     },
 *
 *     async commitEvents({ events }) {
 *       if (events.length === 0) return;
 *       await prisma.event.createMany({ data: events });
 *     },
 *   };
 * };
 * ```
 *
 * ### In-Memory (for testing)
 *
 * ```typescript
 * import type { Adapter } from 'ventyd';
 *
 * export const createInMemoryAdapter = (): Adapter => {
 *   const events = new Map<string, Event[]>();
 *
 *   return {
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
 *   };
 * };
 * ```
 *
 * ## Connection Management
 *
 * Adapters should **not** manage database connections internally. Instead:
 *
 * - Accept an existing database client/pool as a parameter
 * - Reuse the application's connection pool
 * - Participate in the application's transaction management
 *
 * This enables:
 * - Efficient resource usage (especially in serverless environments)
 * - Unified transaction boundaries across domain logic and events
 * - Consistent connection configuration
 *
 * ## State Parameter
 *
 * The `commitEvents` method receives both events and the resulting state.
 * While events are the source of truth, the state parameter enables:
 *
 * - **Snapshot optimization**: Periodically save snapshots to avoid replaying thousands of events
 * - **Denormalization**: Update read models or projections
 * - **Monitoring**: Track entity state evolution for debugging
 *
 * Basic adapters can ignore the state parameter - it's provided for advanced use cases.
 *
 * @since 2.0.0
 */
export type Adapter<
  $$Schema = Schema<string, { eventName: string }, {}, string, ":">,
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
   * Events **must** be returned in the exact order they were committed to ensure
   * deterministic state reconstruction. An empty array should be returned
   * if no events exist for the specified entity.
   *
   * ## Performance Considerations
   *
   * - Add database indexes on `(entityName, entityId, eventCreatedAt)`
   * - Consider implementing snapshot optimization for entities with many events
   * - Use connection pooling to handle concurrent queries efficiently
   *
   * @example
   * ```typescript
   * const events = await adapter.getEventsByEntityId({
   *   entityName: 'user',
   *   entityId: 'user-123'
   * });
   * ```
   */
  getEventsByEntityId: (args: {
    entityName: string;
    entityId: string;
  }) => Promise<InferEventFromSchema<$$Schema>[]>;

  /**
   * Persists a batch of events to the adapter.
   *
   * @param args - Commit parameters
   * @param args.events - Array of events to persist
   * @param args.state - The resulting entity state after applying events
   * @returns A promise that resolves when persistence is complete
   *
   * @remarks
   * All events in a batch **must** be committed atomically - either all succeed
   * or all fail. This ensures consistency in the event log and prevents
   * partial state transitions.
   *
   * ## Transaction Handling
   *
   * Use your database's transaction mechanism to ensure atomicity:
   *
   * ```typescript
   * // Example with transactions
   * async commitEvents({ events }) {
   *   await db.transaction(async (tx) => {
   *     for (const event of events) {
   *       await tx.insert('events', event);
   *     }
   *   });
   * }
   * ```
   *
   * ## Empty Commits
   *
   * Adapters should handle empty event arrays gracefully (typically a no-op):
   *
   * ```typescript
   * if (events.length === 0) return;
   * ```
   *
   * @example
   * ```typescript
   * await adapter.commitEvents({
   *   events: [
   *     { eventId: '1', eventName: 'user:created', ... },
   *     { eventId: '2', eventName: 'user:verified', ... },
   *   ],
   *   state: { nickname: 'John', verified: true }
   * });
   * ```
   */
  commitEvents(args: {
    entityName: InferEntityNameFromSchema<$$Schema>;
    entityId: string;
    events: InferEventFromSchema<$$Schema>[];
    state: InferStateFromSchema<$$Schema>;
  }): Promise<void>;
};
