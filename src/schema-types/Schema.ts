import type * as v from "valibot";
import type { ValibotEmptyObject, ValibotEventObject } from "../util-types";
import type { EventDefinitionInput } from "./EventDefinitionInput";
import type { EventSchema } from "./EventSchema";
import type { StateDefinitionInput } from "./StateDefinitionInput";
import type { StateSchema } from "./StateSchema";

/**
 * Type definition for a complete entity schema.
 * @internal
 */
export type Schema<
  EntityName extends string,
  EventDefinition extends EventDefinitionInput,
  StateDefinition extends StateDefinitionInput,
  InitialEventName extends Extract<keyof EventDefinition, string>,
> = {
  event: EventSchema<EntityName, EventDefinition>;
  state: StateSchema<StateDefinition>;
  " $$entityName": EntityName;
  " $$eventDefinition": EventDefinition;
  " $$stateDefinition": StateDefinition;
  " $$initialEventName": InitialEventName;
  " $$initialEventBodySchema": EventDefinition[InitialEventName];
  " $$generateId": () => string;
};

/**
 * Infer the state type from a schema.
 * @internal
 */
export type InferStateFromSchema<T> = T extends {
  state: ValibotEmptyObject;
}
  ? v.InferOutput<T["state"]>
  : never;

/**
 * Infer the event type from a schema.
 * @internal
 */
export type InferEventFromSchema<T> = T extends {
  event: v.VariantSchema<
    "eventName",
    ValibotEventObject<string, ValibotEmptyObject>[],
    undefined
  >;
}
  ? v.InferOutput<T["event"]>
  : never;

/**
 * Infer the event name from a schema.
 * @internal
 */
export type InferEventNameFromSchema<T> = T extends {
  event: v.VariantSchema<
    "eventName",
    ValibotEventObject<string, ValibotEmptyObject>[],
    undefined
  >;
}
  ? v.InferOutput<T["event"]>["eventName"]
  : string;

/**
 * Infer the event body from a schema.
 * @internal
 */
export type InferEventBodyFromSchema<
  T,
  EventName extends InferEventNameFromSchema<T>,
> = T extends {
  event: v.VariantSchema<
    "eventName",
    ValibotEventObject<string, ValibotEmptyObject>[],
    undefined
  >;
}
  ? Extract<v.InferOutput<T["event"]>, { eventName: EventName }>["body"]
  : never;

/**
 * Infer the initial event name from a schema.
 * @internal
 */
export type InferInitialEventNameFromSchema<T> = T extends {
  " $$initialEventName": string;
}
  ? T[" $$initialEventName"]
  : never;

/**
 * Infer the initial event body from a schema.
 * @internal
 */
export type InferInitialEventBodyFromSchema<T> = T extends {
  " $$initialEventBodySchema": ValibotEmptyObject;
}
  ? v.InferOutput<T[" $$initialEventBodySchema"]>
  : never;

/**
 * Infer the entity name from a schema.
 * @internal
 */
export type InferEntityNameFromSchema<T> = T extends {
  " $$entityName": string;
}
  ? T[" $$entityName"]
  : never;
