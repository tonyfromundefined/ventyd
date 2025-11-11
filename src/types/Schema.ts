import type { BaseEventType } from "./BaseEventType";
import type { SchemaInput } from "./SchemaInput";

/**
 * Type definition for a complete entity schema.
 * @internal
 */
export type Schema<
  EntityName,
  EventType extends BaseEventType,
  StateType,
  InitialEventName extends EventType["eventName"],
  NamespaceSeparator extends string,
> = ReturnType<
  SchemaInput<EntityName, EventType, StateType, NamespaceSeparator>
> & {
  " $$entityName": EntityName;
  " $$initialEventName": InitialEventName;
  " $$generateId": () => string;
  " $$namespaceSeparator": NamespaceSeparator;
};

/**
 * Infer the state type from a schema.
 * @internal
 */
export type InferStateFromSchema<T> = T extends {
  parseState: (input: unknown) => infer State;
}
  ? State
  : never;

/**
 * Infer the event type from a schema.
 * @internal
 */
export type InferEventFromSchema<T> = T extends {
  parseEvent: (input: unknown) => infer Event;
}
  ? Event
  : never;

/**
 * Infer the event name from a schema.
 * @internal
 */
export type InferEventNameFromSchema<T> = T extends {
  parseEvent: (input: unknown) => infer Event;
}
  ? Event extends { eventName: infer EventName }
    ? EventName
    : string
  : string;

/**
 * Infer the event body from a schema.
 * @internal
 */
export type InferEventBodyFromSchema<T, K> = T extends {
  parseEvent: (input: unknown) => infer Event;
}
  ? Event extends { eventName: K; body: infer Body }
    ? Body
    : never
  : never;

/**
 * Infer the initial event name from a schema.
 * @internal
 */
export type InferInitialEventNameFromSchema<T> = T extends {
  " $$initialEventName": infer InitialEventName;
}
  ? InitialEventName
  : never;

/**
 * Infer the initial event from a schema.
 * @internal
 */
export type InferInitialEventFromSchema<T> = T extends {
  parseEvent: (input: unknown) => infer Event;
}
  ? Extract<Event, { eventName: InferInitialEventNameFromSchema<T> }>
  : never;

/**
 * Infer the initial event body from a schema.
 * @internal
 */
export type InferInitialEventBodyFromSchema<T> =
  InferInitialEventFromSchema<T> extends { body: infer Body } ? Body : never;

/**
 * Infer the entity name from a schema.
 * @internal
 */
export type InferEntityNameFromSchema<T> = T extends {
  " $$entityName": infer EntityName;
}
  ? EntityName
  : never;

/**
 * Default schema type
 * @internal
 */
export type DefaultSchema = Schema<string, BaseEventType, {}, string, ":">;
