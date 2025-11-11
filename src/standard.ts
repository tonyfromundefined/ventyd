import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

export function standard<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: StandardSchemaV1<BaseEventType, BaseEventType>;
  },
  $$StateDefinition extends StandardSchemaV1,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventDefinition;
  state: $$StateDefinition;
}): SchemaInput<
  $$EntityName,
  StandardSchemaV1.InferOutput<ValueOf<$$EventDefinition>>,
  StandardSchemaV1.InferOutput<$$StateDefinition>,
  $$NamespaceSeparator
> {
  type $$EventType = StandardSchemaV1.InferOutput<ValueOf<$$EventDefinition>>;
  return (context) => {
    return {
      parseEvent(input) {
        for (const eventSchema of Object.values(args.event)) {
          try {
            return standardValidate(eventSchema, input);
          } catch {}
        }

        throw new Error("Validation failed");
      },
      parseEventByName<K extends $$EventType["eventName"]>(
        eventName: K,
        input: unknown,
      ) {
        const eventSchema = args.event[eventName];

        if (!eventSchema) {
          const availableEvents = Object.keys(args.event).join(", ");
          throw new Error(
            `Event name "${eventName}" not found. Available events: ${availableEvents}`,
          );
        }

        return standardValidate(eventSchema, input) as Extract<
          StandardSchemaV1.InferOutput<$$EventDefinition[K]>,
          { eventName: K }
        >;
      },
      parseState(input) {
        return standardValidate(args.state, input);
      },
    };
  };
}

function standardValidate<T extends StandardSchemaV1>(
  schema: T,
  input: unknown,
): StandardSchemaV1.InferOutput<T> {
  const result = schema["~standard"].validate(input);

  if (result instanceof Promise) {
    throw new Error("Promise validation result is not supported");
  }
  if (result.issues) {
    throw new Error("Validation failed");
  }

  return result.value as StandardSchemaV1.InferOutput<T>;
}
