import type { Entity } from "./Entity";
import type {
  InferEventFromSchema,
  InferInitialEventBodyFromSchema,
  InferStateFromSchema,
} from "./Schema";

/**
 * Arguments for entity constructor.
 *
 * @remarks
 * Supports three initialization modes:
 * - `create`: Create a new entity with initial event
 * - `load`: Load entity with pre-computed state (readonly)
 * - `loadFromEvents`: Load entity by replaying events
 *
 * @internal
 */
export type EntityConstructorArgs<$$Schema> =
  | {
      type: "create";
      body: InferInitialEventBodyFromSchema<$$Schema>;
      entityId?: string;
      eventId?: string;
      eventCreatedAt?: string;
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
    };

/**
 * Internal interface defining the constructor for an Entity instance.
 *
 * @internal
 */
export interface EntityConstructor<$$Schema> {
  /**
   * The schema defining the entity's structure and event types
   **/
  schema: $$Schema;

  /**
   * Creates a new entity instance with the given initial event body.
   */
  create: <T>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      body: InferInitialEventBodyFromSchema<$$Schema>;
      entityId?: string;
      eventId?: string;
      eventCreatedAt?: string;
    },
  ) => T;

  /**
   * Loads an entity instance with the given state. (readonly)
   */
  load: <T extends Entity<$$Schema>>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      entityId: string;
      state: InferStateFromSchema<$$Schema>;
    },
  ) => T;

  /**
   * @internal
   */
  " $$loadFromEvents": <T extends Entity<$$Schema>>(
    this: new (
      args: EntityConstructorArgs<$$Schema>,
    ) => T,
    args: {
      events: InferEventFromSchema<$$Schema>[];
      entityId: string;
    },
  ) => T;

  /**
   * @internal
   */
  new (args: EntityConstructorArgs<$$Schema>): Entity<$$Schema>;
}

/**
 * Infer the schema from an entity constructor.
 * @internal
 */
export type InferSchemaFromEntityConstructor<T> = T extends {
  schema: infer $$Schema;
}
  ? $$Schema
  : never;
