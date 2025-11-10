import sortBy from "just-sort-by";
import * as v from "valibot";
import type { Adapter } from "./Adapter";
import type {
  Entity,
  EntityConstructor,
  InferSchemaFromEntityConstructor,
} from "./entity-types";
import type { Plugin } from "./Plugin";
import type {
  InferEntityNameFromSchema,
  InferEventFromSchema,
} from "./schema-types";
import type { ConstructorReturnType, ValibotEmptyObject } from "./util-types";

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
export type Repository<$$Entity> = {
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
  findOne: (args: { entityId: string }) => Promise<$$Entity | null>;

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
  commit: (entity: $$Entity) => Promise<void>;
};

/**
 * Creates a repository instance for managing entity persistence.
 *
 * @param Entity - The entity class created with `class MyEntity extends Entity()`
 * @param args - Repository configuration
 * @param args.adapter - The adapter implementation for persistence
 * @param args.plugins - Optional array of plugins to extend repository behavior
 * @param args.onPluginError - Optional callback to handle plugin execution errors
 *
 * @returns A repository instance with type-safe operations
 *
 * @remarks
 * The repository serves as the bridge between your domain entities and the
 * underlying persistence mechanism. It ensures that all persistence operations
 * maintain the integrity of the event sourcing pattern.
 *
 * ```
 * Entity → dispatch() → queuedEvents → commit() → Adapter → Plugins
 * ```
 *
 * ## Plugin Execution
 *
 * Plugins run after events are committed to storage:
 * - All plugins execute in parallel using Promise.allSettled
 * - Plugin failures don't affect the commit operation (events are already saved)
 * - Plugin failures don't prevent other plugins from running
 * - Use `onPluginError` to handle plugin failures
 *
 * @example
 * ### Basic Usage
 *
 * ```typescript
 * import { createRepository, Entity, defineSchema, defineReducer } from 'ventyd';
 * import type { Adapter } from 'ventyd';
 *
 * // Define your entity
 * const userSchema = defineSchema("user", {...});
 * const userReducer = defineReducer(userSchema, ...);
 * class User extends Entity(userSchema, userReducer) {
 *   // ...
 * }
 *
 * // Create adapter implementation
 * const adapter: Adapter = {
 *   async getEventsByEntityId({ entityName, entityId }) {
 *     // Implementation for retrieving events
 *   },
 *   async commitEvents({ events }) {
 *     // Implementation for storing events
 *   }
 * };
 *
 * // Create repository with adapter
 * const userRepository = createRepository(User, {
 *   adapter: adapter
 * });
 *
 * // Use the repository
 * const user = await userRepository.findOne({ entityId: 'user-123' });
 * ```
 *
 * @example
 * ### Using Plugins
 *
 * ```typescript
 * import type { Plugin } from 'ventyd';
 *
 * const analyticsPlugin: Plugin = {
 *   async onCommitted({ events }) {
 *     await analytics.track(events);
 *   }
 * };
 *
 * const auditPlugin: Plugin = {
 *   async onCommitted({ entityName, entityId, state }) {
 *     await auditLog.record({ entityName, entityId, state });
 *   }
 * };
 *
 * const userRepository = createRepository(User, {
 *   adapter,
 *   plugins: [analyticsPlugin, auditPlugin]
 * });
 * ```
 *
 * @example
 * ### Handling Plugin Errors
 *
 * ```typescript
 * const userRepository = createRepository(User, {
 *   adapter,
 *   plugins: [analyticsPlugin, notificationPlugin],
 *   onPluginError: (error, plugin) => {
 *     // Log error
 *     logger.error('Plugin execution failed', {
 *       error: error instanceof Error ? error.message : String(error),
 *       pluginName: plugin.constructor.name
 *     });
 *
 *     // Send to error tracking service
 *     sentry.captureException(error, {
 *       tags: { component: 'plugin' }
 *     });
 *   }
 * });
 * ```
 *
 * @since 1.0.0
 */
export function createRepository<
  $$EntityConstructor extends EntityConstructor<
    InferSchemaFromEntityConstructor<$$EntityConstructor>
  >,
>(
  Entity: $$EntityConstructor,
  args: {
    adapter: Adapter<InferSchemaFromEntityConstructor<$$EntityConstructor>>;
    plugins?: Plugin<InferSchemaFromEntityConstructor<$$EntityConstructor>>[];
    onPluginError?: (
      error: unknown,
      plugin: Plugin<InferSchemaFromEntityConstructor<$$EntityConstructor>>,
    ) => void;
  },
): Repository<ConstructorReturnType<$$EntityConstructor>> {
  type $$Schema = InferSchemaFromEntityConstructor<$$EntityConstructor>;
  type $$Event = InferEventFromSchema<$$Schema>;
  type $$EntityName = InferEntityNameFromSchema<$$Schema>;
  type $$ExtendedEntityType = ConstructorReturnType<$$EntityConstructor>;

  // biome-ignore lint/suspicious/noExplicitAny: entity is valid
  const _schema: any = Entity.schema;

  const entityName: $$EntityName = _schema[" $$entityName"];
  const eventSchema: ValibotEmptyObject = _schema.event;

  return {
    async findOne({ entityId }) {
      // 1. query events by entity ID
      const rawEvents = await args.adapter.getEventsByEntityId({
        entityName,
        entityId,
      });

      // 2. validate and sort events from adapter using the schema
      const EventArraySchema = v.array(eventSchema);
      const events = sortBy(
        v.parse(EventArraySchema, rawEvents) as $$Event[],
        "eventCreatedAt",
      );

      if (events.length === 0) {
        return null;
      }

      // 3. load entity from events
      const entity = Entity[" $$loadFromEvents"]({ entityId, events });

      return entity as $$ExtendedEntityType;
    },
    async commit(entity) {
      // 0. prepare
      const _entity = entity as Entity<$$Schema>;

      // 1. copy queued events
      const queuedEvents = [..._entity[" $$queuedEvents"]];

      // 2. commit events to adapter
      await args.adapter.commitEvents({
        entityName,
        entityId: _entity.entityId,
        events: queuedEvents,
        state: _entity.state,
      });

      // 3. flush queued events
      _entity[" $$flush"]();

      // 4. run plugins in parallel (only if there are events)
      if (args.plugins && args.plugins.length > 0 && queuedEvents.length > 0) {
        const pluginResults = await Promise.allSettled(
          args.plugins.map((plugin) =>
            // Wrap in async function to catch both sync and async errors
            (async () => {
              return await plugin.onCommitted?.({
                entityName,
                entityId: _entity.entityId,
                events: queuedEvents,
                state: _entity.state,
              });
            })(),
          ),
        );

        // Handle plugin errors if callback is provided
        if (args.onPluginError) {
          pluginResults.forEach((pluginResult, i) => {
            const plugin = args.plugins?.[i];

            if (pluginResult.status === "rejected" && plugin) {
              args.onPluginError?.(pluginResult.reason, plugin);
            }
          });
        }
      }
    },
  };
}
