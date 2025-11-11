import type { BaseEventType } from "./BaseEventType";

/**
 * Schema provider function signature for pluggable validation libraries.
 *
 * @typeParam $$EntityName - The entity name type
 * @typeParam $$EventType - The event type structure
 * @typeParam $$StateType - The state type structure
 * @typeParam $$NamespaceSeparator - Separator between entity name and event name (default: ":")
 *
 * @param context - Schema context
 * @param context.entityName - The entity name
 * @param context.namespaceSeparator - The separator used for event namespacing
 * @returns Schema provider with validation methods
 *
 * @remarks
 * This interface enables Ventyd to support multiple validation libraries
 * (Valibot, Zod, Typebox, ArkType) through a unified API.
 *
 * @internal
 */
export type SchemaInput<
  $$EntityName,
  $$EventType extends BaseEventType,
  $$StateType,
> = (context: { entityName: $$EntityName }) => {
  parseEvent(input: unknown): $$EventType;
  parseEventByName<K extends $$EventType["eventName"]>(
    eventName: K,
    input: unknown,
  ): Extract<$$EventType, { eventName: K }>;
  parseState(input: unknown): $$StateType;
};
