import { z } from "zod";
import type { ValueOf, ZodEmptyObject, ZodEvent } from "./util-types";

const defaultGenerateId = () => crypto.randomUUID();

type EventSchemaMap<
  Namespace extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
> = {
  [EventName in Extract<keyof EventBodySchemaMap, string>]: ZodEvent<
    `${Namespace}:${EventName}`,
    EventBodySchemaMap[EventName]
  >;
};

export type Schema<
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
    ValueOf<EventSchemaMap<Namespace, EventBodySchemaMap>>[],
    "eventName"
  >;
  eventMap: EventSchemaMap<Namespace, EventBodySchemaMap>;
  state: State;
};

export type BaseSchema = Schema<
  string,
  { [key: string]: ZodEmptyObject },
  string,
  ZodEmptyObject
>;

export function defineSchema<
  Namespace extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
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
): Schema<Namespace, EventBodySchemaMap, InitialEventName, State> {
  type SchemaMap = EventSchemaMap<Namespace, EventBodySchemaMap>;
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
