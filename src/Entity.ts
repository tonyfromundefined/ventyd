import * as v from "valibot";
import type { Reducer } from "./defineReducer";
import type { Entity as EntityType } from "./entity-types/Entity";
import type {
  EntityConstructor,
  EntityConstructorArgs,
} from "./entity-types/EntityConstructor";
import type {
  InferEntityNameFromSchema,
  InferEventBodyFromSchema,
  InferEventFromSchema,
  InferEventNameFromSchema,
  InferInitialEventBodyFromSchema,
  InferInitialEventNameFromSchema,
  InferStateFromSchema,
} from "./schema-types";
import type { ValibotEmptyObject, ValibotEventObject } from "./util-types";

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
export function Entity<$$Schema>(
  schema: $$Schema,
  reducer: Reducer<$$Schema>,
  options?: {
    maxQueuedEvents?: number;
  },
): EntityConstructor<$$Schema> {
  type $$EntityName = InferEntityNameFromSchema<$$Schema>;
  type $$State = InferStateFromSchema<$$Schema>;
  type $$Event = InferEventFromSchema<$$Schema>;
  type $$InitialEventName = InferInitialEventNameFromSchema<$$Schema>;

  // parse schema
  // biome-ignore lint/suspicious/noExplicitAny: schema is valid
  const _schema: any = schema;

  const entityName: $$EntityName = _schema[" $$entityName"];
  const initialEventName: $$InitialEventName = _schema[" $$initialEventName"];
  const initialEventBodySchema: ValibotEmptyObject =
    _schema[" $$initialEventBodySchema"];
  const eventSchema: ValibotEventObject<string, ValibotEmptyObject> =
    _schema.event;
  const generateId: () => string = _schema[" $$generateId"];

  // options
  const maxQueuedEvents = options?.maxQueuedEvents ?? 10000; // Default to 10000 events

  return class BaseEntity implements EntityType<$$Schema> {
    // ----------------------
    // static properties
    // ----------------------
    static schema: $$Schema = schema;

    // ----------------------
    // public properties
    // ----------------------
    entityName: $$EntityName = entityName;
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
    " $$state": $$State = null as any;
    " $$queuedEvents": $$Event[] = [];
    " $$reducer": Reducer<$$Schema> = reducer;
    " $$readonly": boolean = false;

    // ----------------------
    // constructor
    // ----------------------
    /**
     * @internal
     */
    constructor(
      args:
        | {
            type: "create";
            entityId?: string;
            body: InferInitialEventBodyFromSchema<$$Schema>;
          }
        | {
            type: "load";
            entityId: string;
            state: InferStateFromSchema<$$Schema>;
          }
        | {
            type: "loadFromEvents";
            entityId: string;
            events: InferEventFromSchema<$$Schema>[];
          },
    ) {
      switch (args.type) {
        case "create": {
          this.entityId = args.entityId ?? generateId();
          type EventName = InferEventNameFromSchema<$$Schema>;
          type EventBody = InferEventBodyFromSchema<$$Schema, EventName>;

          const eventName = `${entityName}:${initialEventName}` as EventName;
          const body = v.parse(initialEventBodySchema, args.body) as EventBody;

          this.dispatch(eventName, body);
          break;
        }

        case "load": {
          this.entityId = args.entityId;
          this[" $$state"] = args.state;
          this[" $$readonly"] = true;
          break;
        }

        case "loadFromEvents": {
          // 0. prepare
          const reducer = this[" $$reducer"];
          const prevState = this[" $$state"];
          const EventArraySchema = v.array(eventSchema);

          // 1. validate current state
          if (this[" $$state"] !== null) {
            throw new Error("Entity is already initialized");
          }

          // 2. validate events
          const events = v.parse(EventArraySchema, args.events) as $$Event[];

          // 3. compute state
          this.entityId = args.entityId;
          this[" $$state"] = events.reduce(reducer, prevState);
          break;
        }
      }
    }

    /**
     * Creates a new entity instance with the given initial event body.
     */
    static create<T>(
      this: new (
        args: EntityConstructorArgs<$$Schema>,
      ) => T,
      args: {
        entityId?: string;
        body: InferInitialEventBodyFromSchema<$$Schema>;
      },
    ): T {
      // biome-ignore lint/complexity/noThisInStatic: inheritance
      return new this({
        type: "create",
        entityId: args.entityId,
        body: args.body,
      });
    }

    /**
     * Loads an entity instance with the given state. (readonly)
     */
    static load<T>(
      this: new (
        args: EntityConstructorArgs<$$Schema>,
      ) => T,
      args: {
        entityId: string;
        state: InferStateFromSchema<$$Schema>;
      },
    ): T {
      // biome-ignore lint/complexity/noThisInStatic: inheritance
      return new this({
        type: "load",
        entityId: args.entityId,
        state: args.state,
      });
    }

    /**
     * @internal
     */
    static " $$loadFromEvents"<T>(
      this: new (
        args: EntityConstructorArgs<$$Schema>,
      ) => T,
      args: {
        entityId: string;
        events: InferEventFromSchema<$$Schema>[];
      },
    ): T {
      // biome-ignore lint/complexity/noThisInStatic: inheritance
      return new this({
        type: "loadFromEvents",
        entityId: args.entityId,
        events: args.events,
      });
    }

    // ----------------------
    // public methods
    // ----------------------
    dispatch<EventName extends InferEventNameFromSchema<$$Schema>>(
      eventName: EventName,
      body: InferEventBodyFromSchema<$$Schema, EventName>,
    ) {
      // 0. prepare
      const queuedEvents = this[" $$queuedEvents"];
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];
      const readonly = this[" $$readonly"];

      // Check if entity is readonly (initialized with state)
      if (readonly) {
        throw new Error("Entity is readonly");
      }

      // Check queue size limit
      if (queuedEvents.length >= maxQueuedEvents) {
        throw new Error(
          `Event queue overflow: maximum ${maxQueuedEvents} uncommitted events exceeded. ` +
            `Please commit the entity before dispatching more events.`,
        );
      }

      // 1. create event
      const event = v.parse(eventSchema, {
        eventId: generateId(),
        eventName,
        eventCreatedAt: new Date().toISOString(),
        entityId: this.entityId,
        entityName: this.entityName,
        body,
      }) as $$Event;

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
  };
}
