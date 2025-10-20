import type { Reducer } from "../defineReducer";
import type {
  InferEntityNameFromSchema,
  InferEventBodyFromSchema,
  InferEventFromSchema,
  InferEventNameFromSchema,
  InferStateFromSchema,
} from "../schema-types";

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
export interface Entity<$$Schema> {
  // ----------------------
  // public properties
  // ----------------------

  /**
   * The canonical name of this entity type.
   * This value is used for event namespacing and storage isolation.
   */
  entityName: InferEntityNameFromSchema<$$Schema>;

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
  get state(): InferStateFromSchema<$$Schema>;

  // ----------------------
  // private properties
  // ----------------------

  /** @internal */
  " $$state": InferStateFromSchema<$$Schema>;
  /** @internal */
  " $$queuedEvents": InferEventFromSchema<$$Schema>[];
  /** @internal */
  " $$reducer": Reducer<$$Schema>;

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
  dispatch: <K extends InferEventNameFromSchema<$$Schema>>(
    eventName: K,
    body: InferEventBodyFromSchema<$$Schema, K>,
    options?: {
      eventId?: string;
      eventCreatedAt?: string;
    },
  ) => void;

  // ----------------------
  // private methods
  // ----------------------

  /** @internal */
  " $$flush": () => void;
}
