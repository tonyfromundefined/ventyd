import { z } from "zod";
import type { Reducer } from "./defineReducer";
import type { BaseSchema } from "./defineSchema";

type InitialEventOf<Schema extends BaseSchema> = z.infer<
  Schema["eventMap"][Schema[" $$initialEventName"]]
>;

/**
 * Internal interface defining the structure of an Entity instance.
 *
 * @internal
 *
 * @remarks
 * This interface is marked as internal and should not be directly implemented by consumers.
 * Use the `Entity()` factory function to create entity classes.
 *
 * Properties prefixed with ` $$` are considered private implementation details
 * and should not be accessed directly by consumers.
 */
export interface $$IEntity<Schema extends BaseSchema> {
  // ----------------------
  // public properties
  // ----------------------

  /**
   * The canonical name of this entity type.
   * This value is used for event namespacing and storage isolation.
   */
  entityName: Schema[" $$entityName"];

  /**
   * The unique identifier for this entity instance.
   * Once set, this value is immutable throughout the entity's lifecycle.
   */
  entityId: string;

  /**
   * The current state of the entity, computed from all applied events.
   *
   * @readonly
   * @throws {Error} If the entity has not been initialized
   */
  get state(): z.infer<Schema["state"]>;

  // ----------------------
  // private properties
  // ----------------------

  /** @internal */
  " $$state": z.infer<Schema["state"]>;
  /** @internal */
  " $$schema": Schema;
  /** @internal */
  " $$queuedEvents": z.infer<Schema["event"]>[];
  /** @internal */
  " $$reducer": Reducer<Schema>;

  // ----------------------
  // public methods
  // ----------------------

  /**
   * Dispatches an event to update the entity's state.
   *
   * @typeParam EventName - The type of event being dispatched
   * @param eventName - The fully-qualified event name (e.g., "user:created")
   * @param body - The event payload conforming to the event's schema
   *
   * @remarks
   * Events are queued internally and only persisted when the repository's
   * commit method is called. This enables batching multiple state transitions
   * in a single transaction.
   *
   * @example
   * ```typescript
   * this.dispatch("user:profile_updated", {
   *   nickname: "NewName",
   *   bio: "Updated bio"
   * });
   * ```
   */
  dispatch: <EventName extends z.infer<Schema["event"]>["eventName"]>(
    eventName: EventName,
    body: z.infer<Schema["eventMap"][EventName]>["body"],
  ) => void;

  // ----------------------
  // private methods
  // ----------------------

  /** @internal */
  " $$flush": () => void;
  /** @internal */
  " $$hydrate": (events: z.infer<Schema["event"]>[]) => void;
}

/**
 * Creates an Entity class with event sourcing capabilities.
 *
 * @typeParam Schema - The schema defining the entity's structure and event types
 * @param schema - The schema instance created with `defineSchema()`
 * @param reducer - The reducer function created with `defineReducer()`
 * @returns A constructor function for creating entity instances
 *
 * @remarks
 * The Entity factory is the cornerstone of the event sourcing system. It creates
 * classes that maintain their state through an append-only event log, ensuring
 * complete auditability and the ability to reconstruct state at any point in time.
 *
 * @example
 * ```typescript
 * // Define your entity class
 * class User extends Entity(userSchema, userReducer) {
 *   updateProfile(updates: { nickname?: string; bio?: string }) {
 *     this.dispatch("user:profile_updated", updates);
 *   }
 * }
 *
 * // Create a new instance
 * const user = new User({
 *   body: {
 *     email: "user@example.com",
 *     nickname: "JohnDoe"
 *   }
 * });
 *
 * // Dispatch events to update state
 * user.updateProfile({
 *   bio: "Software Engineer"
 * });
 *
 * // Access current state
 * console.log(user.state); // { email: "...", nickname: "...", bio: "..." }
 * ```
 *
 * @since 1.0.0
 */
export function Entity<Schema extends BaseSchema>(
  schema: Schema,
  reducer: Reducer<Schema>,
  options?: {
    maxQueuedEvents?: number;
  },
) {
  const MAX_QUEUED_EVENTS = options?.maxQueuedEvents ?? 10000; // Default to 10000 events

  return class $$Entity implements $$IEntity<Schema> {
    // ----------------------
    // public properties
    // ----------------------
    entityName: Schema[" $$entityName"] = schema[" $$entityName"];
    entityId: string;

    get state() {
      if (this[" $$state"] === null) {
        throw new Error("Entity is not initialized");
      }

      return this[" $$state"];
    }

    // ----------------------
    // private properties
    // ----------------------
    // biome-ignore lint/suspicious/noExplicitAny: initial state is null
    " $$state": z.infer<Schema["state"]> = null as any;
    " $$schema": Schema = schema;
    " $$queuedEvents": z.infer<Schema["event"]>[] = [];
    " $$reducer": Reducer<Schema> = reducer;

    // ----------------------
    // constructor
    // ----------------------

    /**
     * Creates a new entity instance or prepares an empty instance for hydration.
     *
     * @param args - Optional configuration for entity initialization
     * @param args.entityId - Custom entity ID (auto-generated if not provided)
     * @param args.body - Initial event payload for new entities
     *
     * @remarks
     * When `body` is provided, the constructor automatically dispatches the
     * initial event defined in the schema. This ensures new entities always
     * start with a valid initial state.
     *
     * @example
     * ```typescript
     * // Create new entity with auto-generated ID
     * const user1 = new User({
     *   body: { email: "user@example.com", nickname: "John" }
     * });
     *
     * // Create new entity with custom ID
     * const user2 = new User({
     *   entityId: "user-123",
     *   body: { email: "user@example.com", nickname: "Jane" }
     * });
     *
     * // Create empty entity for hydration (used internally by repository)
     * const user3 = new User();
     * ```
     */
    constructor(args?: {
      entityId?: string;
      body?: InitialEventOf<Schema>["body"];
    }) {
      // 0. prepare
      const entityName = schema[" $$entityName"];
      const initialEventName = schema[" $$initialEventName"];
      const initialEventBodySchema =
        schema[" $$eventBodyMap"][initialEventName];

      // 1. validate initial event body if provided
      if (args?.body) {
        if (!initialEventBodySchema) {
          throw new Error(
            `Body schema for initial event ${initialEventName} not found`,
          );
        }
        // Validate body before setting any entity properties
        initialEventBodySchema.parse(args.body);
      }

      // 2. initialize entity
      const generateId = schema[" $$generateId"];
      this.entityId = args?.entityId ?? generateId();

      // 3. dispatch initial event
      if (args?.body) {
        const eventName = `${entityName}:${initialEventName}` as const;
        const body = args.body; // Already validated above

        this.dispatch(eventName, body);
      }
    }

    // ----------------------
    // public methods
    // ----------------------
    dispatch<EventName extends z.infer<Schema["event"]>["eventName"]>(
      eventName: EventName,
      body: z.infer<Schema["eventMap"][EventName]>["body"],
    ) {
      // 0. prepare
      type IEvent = z.infer<Schema["event"]>;
      const queuedEvents = this[" $$queuedEvents"];
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];
      const generateId = this[" $$schema"][" $$generateId"];

      // Check queue size limit
      if (queuedEvents.length >= MAX_QUEUED_EVENTS) {
        throw new Error(
          `Event queue overflow: maximum ${MAX_QUEUED_EVENTS} uncommitted events exceeded. ` +
            `Please commit the entity before dispatching more events.`,
        );
      }

      // 1. create event
      const event = {
        eventId: generateId(),
        eventName,
        eventCreatedAt: new Date().toISOString(),
        entityId: this.entityId,
        entityName: this.entityName,
        body,
      } as IEvent;

      // 2. add event to queue
      queuedEvents.push(event);

      // 3. update state
      this[" $$state"] = reducer(prevState, event);
    }

    // ----------------------
    // private methods
    // ----------------------
    " $$flush"() {
      this[" $$queuedEvents"] = [];
    }

    " $$hydrate"(input: unknown[]) {
      // 0. prepare
      type IEvent = z.infer<Schema["event"]>;
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];
      const EventArraySchema = z.array(this[" $$schema"].event);

      // 1. validate current state
      if (this[" $$state"] !== null) {
        throw new Error("Entity is already initialized");
      }

      // 2. validate events
      const events = EventArraySchema.parse(input) as IEvent[];

      // 3. compute state
      this[" $$state"] = events.reduce(reducer, prevState);
    }
  };
}
