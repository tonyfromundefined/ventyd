import type { BaseEventType } from "./BaseEventType";

export type SchemaInput<
  $$EntityName,
  $$EventType extends BaseEventType,
  $$StateType,
  $$NamespaceSeparator extends string = ":",
> = (context: {
  entityName: $$EntityName;
  namespaceSeparator: $$NamespaceSeparator;
}) => {
  parseEvent(input: unknown): $$EventType;
  parseEventByName<K extends $$EventType["eventName"]>(
    eventName: K,
    input: unknown,
  ): Extract<$$EventType, { eventName: K }>;
  parseState(input: unknown): $$StateType;
};
