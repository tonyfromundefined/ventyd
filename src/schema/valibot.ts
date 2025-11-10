import * as v from "valibot";
import type { SchemaInput } from "../schema-types";
import type { ValibotEmptyObject, ValueOf } from "../util-types";

type $$ValibotEventSchema<
  EventName extends string,
  Body extends ValibotEmptyObject,
> = v.ObjectSchema<
  {
    eventId: v.StringSchema<undefined>;
    eventName: v.LiteralSchema<EventName, undefined>;
    eventCreatedAt: v.StringSchema<undefined>;
    entityName: v.StringSchema<undefined>;
    entityId: v.StringSchema<undefined>;
    body: Body;
  },
  undefined
>;

type $$ValibotSingleEventSchemaFromDefinition<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$NamespaceSeparator extends string,
> = ValueOf<{
  [key in keyof $$EventDefinition]: $$ValibotEventSchema<
    `${$$EntityName}${$$NamespaceSeparator}${Extract<key, string>}`,
    $$EventDefinition[key]
  >;
}>;

type $$ValibotEventSchemaFromDefinition<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$NamespaceSeparator extends string,
> = v.VariantSchema<
  "eventName",
  $$ValibotSingleEventSchemaFromDefinition<
    $$EntityName,
    $$EventDefinition,
    $$NamespaceSeparator
  >[],
  undefined
>;

export function valibot<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$StateDefinition extends ValibotEmptyObject,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventDefinition;
  state: $$StateDefinition;
}): SchemaInput<
  $$EntityName,
  v.InferOutput<
    $$ValibotEventSchemaFromDefinition<
      $$EntityName,
      $$EventDefinition,
      $$NamespaceSeparator
    >
  >,
  v.InferOutput<$$StateDefinition>,
  $$NamespaceSeparator
> {
  return (context) => {
    type $$EventType = v.InferOutput<
      $$ValibotEventSchemaFromDefinition<
        $$EntityName,
        $$EventDefinition,
        $$NamespaceSeparator
      >
    >;

    type $$SingleEventSchemaTuple = [
      $$ValibotSingleEventSchemaFromDefinition<
        $$EntityName,
        $$EventDefinition,
        $$NamespaceSeparator
      >,
      ...$$ValibotSingleEventSchemaFromDefinition<
        $$EntityName,
        $$EventDefinition,
        $$NamespaceSeparator
      >[],
    ];

    const baseEventSchema = v.object({
      eventId: v.string(),
      eventCreatedAt: v.string(),
      entityName: v.string(),
      entityId: v.string(),
    });

    const eventSchemaMap = new Map([
      ...Object.entries(args.event).map(([key, body]) => {
        const eventName = `${context.entityName}${context.namespaceSeparator}${key}`;
        const schema = v.object({
          ...baseEventSchema.entries,
          eventName: v.literal(eventName),
          body,
        });

        return [eventName, schema] as const;
      }),
    ]);

    const eventSchemaTuple = [
      ...eventSchemaMap.values(),
    ] as $$SingleEventSchemaTuple;

    return {
      parseEvent(input) {
        return v.parse(v.variant("eventName", eventSchemaTuple), input);
      },
      parseEventByName<K extends $$EventType["eventName"]>(
        eventName: K,
        input: unknown,
      ) {
        const schema = eventSchemaMap.get(eventName);

        if (!schema) {
          throw new Error(`Event name ${eventName} not found`);
        }

        return v.parse(schema, input) as Extract<$$EventType, { eventName: K }>;
      },
      parseState(input) {
        return v.parse(args.state, input);
      },
    };
  };
}
