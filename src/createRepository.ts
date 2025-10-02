import { z } from "zod";
import type { BaseSchema } from "./defineSchema";
import type { Storage } from "./defineStorage";
import type { $$Entity } from "./Entity";
import type { ConstructorReturnType } from "./util-types";

/**
 * Repository interface providing persistence operations for entities.
 *
 * @typeParam Entity - The entity type managed by this repository
 *
 * @remarks
 * The Repository pattern abstracts storage concerns from domain logic,
 * providing a clean interface for entity persistence and retrieval.
 * All operations are asynchronous to support various storage backends.
 *
 * @since 1.0.0
 */
export type Repository<Entity> = {
  /**
   * Retrieves an entity by its unique identifier.
   *
   * @param args - Query parameters
   * @param args.entityId - The unique identifier of the entity to retrieve
   * @returns A promise resolving to the entity if found, null otherwise
   *
   * @remarks
   * This method reconstructs the entity's current state by replaying all
   * historical events from storage. The reconstruction process is deterministic,
   * ensuring the same sequence of events always produces the same state.
   *
   * @example
   * ```typescript
   * const user = await userRepository.findOne({
   *   entityId: "user-123"
   * });
   * ```
   */
  findOne: (args: { entityId: string }) => Promise<Entity | null>;

  /**
   * Persists an entity's pending events to storage.
   *
   * @param entity - The entity instance with queued events to persist
   * @returns A promise that resolves when persistence is complete
   *
   * @remarks
   * The commit operation performs several critical steps:
   * 1. Extracts all queued events from the entity
   * 2. Persists events atomically to the configured storage backend
   * 3. Clears the entity's event queue
   *
   * Events are only persisted if the commit succeeds. In case of failure,
   * the entity's event queue remains intact for retry.
   *
   * @example
   * ```typescript
   * const user = new User({
   *   body: { email: "user@example.com", nickname: "John" }
   * });
   *
   * user.updateProfile({ bio: "Developer" });
   * user.verify({ verifiedAt: new Date().toISOString() });
   *
   * // Persist both events in a single transaction
   * await userRepository.commit(user);
   * ```
   *
   * @throws Will propagate any errors from the storage layer
   */
  commit: (entity: Entity) => Promise<void>;
};

/**
 * Creates a repository instance for managing entity persistence.
 *
 * @param args - Repository configuration
 * @param args.schema - The entity schema created with `defineSchema()`
 * @param args.entity - The entity class created with `class MyEntity extends Entity()`
 * @param args.storage - The storage backend implementation created with `defineStorage()`
 *
 * @returns A repository instance with type-safe operations
 *
 * @remarks
 * The repository serves as the bridge between your domain entities and the
 * underlying storage mechanism. It ensures that all persistence operations
 * maintain the integrity of the event sourcing pattern.
 *
 * ```
 * Entity → dispatch() → queuedEvents → commit() → Storage
 * ```
 *
 *
 * @example
 * ```typescript
 * import { createRepository, Entity, defineSchema } from 'ventyd';
 * import { MongoDBStorage } from './mongodb-storage';
 *
 * // Define your entity
 * const userSchema = defineSchema({...});
 * const userReducer = defineReducer({...});
 * class User extends Entity(userSchema, userReducer) {
 *   // ...
 * }
 *
 * // Create repository with storage
 * const userRepository = createRepository({
 *   schema: userSchema,
 *   entity: User,
 *   storage: new MongoDBStorage({
 *     uri: 'mongodb://localhost:27017',
 *     database: 'myapp'
 *   })
 * });
 *
 * // Use the repository
 * const user = await userRepository.findOne({ entityId: 'user-123' });
 * ```
 *
 * @since 1.0.0
 */
export function createRepository<
  Schema extends BaseSchema,
  EntityConstructor extends new (args?: {
    entityId?: string;
  }) => $$Entity<Schema>,
>(args: {
  schema: Schema;
  entity: EntityConstructor;
  storage: Storage;
}): Repository<ConstructorReturnType<EntityConstructor>> {
  return {
    async findOne({ entityId }) {
      // 0. prepare
      type IEntity = ConstructorReturnType<EntityConstructor>;
      type IEvent = z.infer<Schema["event"]>;

      const entityName = args.schema[" $$entityName"];
      const Entity = args.entity;

      // 1. query events by entity ID
      const rawEvents = await args.storage.getEventsByEntityId({
        entityName: entityName,
        entityId: entityId,
      });

      // validate events from storage using the schema
      const EventArraySchema = z.array(args.schema.event);
      const events = EventArraySchema.parse(rawEvents) as IEvent[];

      if (events.length === 0) {
        return null;
      }

      // 2. hydrate entity
      const entity = new Entity({ entityId }) as IEntity;
      entity[" $$hydrate"](events);

      return entity;
    },
    async commit(entity) {
      // 1. copy queued events
      const queuedEvents = [...entity[" $$queuedEvents"]];

      // 2. commit events to storage
      await args.storage.commitEvents({
        events: queuedEvents,
      });

      // 3. flush queued events
      entity[" $$flush"]();
    },
  };
}
