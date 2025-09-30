import { z } from "zod";
import type { ValueOf } from "./ValueOf";
import type { ZodEmptyObject } from "./ZodEmptyObject";
import type { ZodEvent } from "./ZodEvent";

const defaultGenerateId = () => crypto.randomUUID();

export type $$EventSchemaMap<
  Namespace extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
> = {
  [eventName in Extract<keyof EventBodySchemaMap, string>]: ZodEvent<
    `${Namespace}:${eventName}`,
    EventBodySchemaMap[eventName]
  >;
};

export type $$DefinedSchema<
  Namespace extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
  InitialEventName extends keyof EventBodySchemaMap,
  State extends ZodEmptyObject,
> = {
  " $$typeof": "DefinedSchema";
  " $$namespace": Namespace;
  " $$initialEventName": InitialEventName;
  " $$generateId": () => string;
  event: z.ZodDiscriminatedUnion<
    ValueOf<$$EventSchemaMap<Namespace, EventBodySchemaMap>>[],
    "eventName"
  >;
  eventMap: $$EventSchemaMap<Namespace, EventBodySchemaMap>;
  state: State;
};

export function defineSchema<
  Namespace extends string,
  EventBodySchemaMap extends {
    [key: string]: ZodEmptyObject;
  },
  InitialEventName extends keyof EventBodySchemaMap,
  State extends ZodEmptyObject,
>(
  namespace: Namespace,
  options: {
    event: EventBodySchemaMap;
    initialEventName: InitialEventName;
    state: State;
    generateId?: () => string;
  },
): $$DefinedSchema<Namespace, EventBodySchemaMap, InitialEventName, State> {
  type SchemaMap = $$EventSchemaMap<Namespace, EventBodySchemaMap>;
  type SchemaArray = [ValueOf<SchemaMap>, ...ValueOf<SchemaMap>[]];

  const baseEvent = z.object({
    eventId: z.string(),
    eventCreatedAt: z.string(),
    entityName: z.string(),
    entityId: z.string(),
  });

  const eventBodySchemaMap = options.event;
  const eventBodySchemaEntries = Object.entries(eventBodySchemaMap);

  const eventSchemaMap = eventBodySchemaEntries.reduce(
    (acc, [eventName, body]) => {
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: biome is dumb
        ...acc,
        [`${namespace}:${eventName}`]: baseEvent.extend({
          eventName: z.literal(`${namespace}:${eventName}`),
          body,
        }),
      };
    },
    {} as SchemaMap,
  );

  const eventSchemaEntries = eventBodySchemaEntries.map(([eventName, body]) =>
    baseEvent.extend({
      eventName: z.literal(`${namespace}:${eventName}`),
      body,
    }),
  ) as SchemaArray;

  const [a, ...b] = eventSchemaEntries;

  return {
    " $$namespace": namespace,
    " $$typeof": "DefinedSchema",
    " $$initialEventName": options.initialEventName,
    " $$generateId": options.generateId ?? defaultGenerateId,
    event: z.discriminatedUnion("eventName", [a, ...b]),
    eventMap: eventSchemaMap,
    state: options.state,
  };
}
