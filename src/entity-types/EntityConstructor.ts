import type {
  InferInitialEventBodyFromSchema,
  InferStateFromSchema,
} from "../schema-types";
import type { Entity } from "./Entity";

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

  new (
    args?: {
      entityId?: string;
    } & (
      | {
          by?: undefined;
          body?: undefined;
          state?: undefined;
        }
      | {
          by: "INITIAL_EVENT";
          body: InferInitialEventBodyFromSchema<$$Schema>;
        }
      | {
          by: "STATE";
          state: InferStateFromSchema<$$Schema>;
        }
    ),
  ): Entity<$$Schema>;
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
