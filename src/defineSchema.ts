import { z } from "zod";
import type { ValueOf, ZodEmptyObject, ZodEvent } from "./util-types";

const defaultGenerateId = () => crypto.randomUUID();

type EventSchemaMap<
  EntityName extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
> = {
  [EventName in Extract<keyof EventBodySchemaMap, string>]: ZodEvent<
    `${EntityName}:${EventName}`,
    EventBodySchemaMap[EventName]
  >;
};

export type Schema<
  EntityName extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
  InitialEventName extends keyof EventBodySchemaMap,
  State extends ZodEmptyObject,
> = {
  " $$typeof": "DefinedSchema";
  " $$entityName": EntityName;
  " $$initialEventName": InitialEventName;
  " $$generateId": () => string;
  event: z.ZodDiscriminatedUnion<
    ValueOf<EventSchemaMap<EntityName, EventBodySchemaMap>>[],
    "eventName"
  >;
  eventMap: EventSchemaMap<EntityName, EventBodySchemaMap>;
  state: State;
};

export type BaseSchema = Schema<
  string,
  { [key: string]: ZodEmptyObject },
  string,
  ZodEmptyObject
>;

export function defineSchema<
  EntityName extends string,
  EventBodySchemaMap extends { [key: string]: ZodEmptyObject },
  InitialEventName extends keyof EventBodySchemaMap,
  State extends ZodEmptyObject,
>(
  entityName: EntityName,
  options: {
    event: EventBodySchemaMap;
    initialEventName: InitialEventName;
    state: State;
    generateId?: () => string;
  },
): Schema<EntityName, EventBodySchemaMap, InitialEventName, State> {
  type SchemaMap = EventSchemaMap<EntityName, EventBodySchemaMap>;
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
        [`${entityName}:${eventName}`]: baseEvent.extend({
          eventName: z.literal(`${entityName}:${eventName}`),
          body,
        }),
      };
    },
    {} as SchemaMap,
  );

  const eventSchemaEntries = eventBodySchemaEntries.map(([eventName, body]) =>
    baseEvent.extend({
      eventName: z.literal(`${entityName}:${eventName}`),
      body,
    }),
  ) as SchemaArray;

  const [a, ...b] = eventSchemaEntries;

  return {
    " $$entityName": entityName,
    " $$typeof": "DefinedSchema",
    " $$initialEventName": options.initialEventName,
    " $$generateId": options.generateId ?? defaultGenerateId,
    event: z.discriminatedUnion("eventName", [a, ...b]),
    eventMap: eventSchemaMap,
    state: options.state,
  };
}
