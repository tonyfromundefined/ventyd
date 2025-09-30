import { z } from "zod";
import type { ValueOf, ZodEmptyObject, ZodEventObject } from "./util-types";

const defaultGenerateId = () => crypto.randomUUID();

type ZodEventObjectMapByEventName<
  EntityName extends string,
  ZodEventBodyObjectMapByEventName extends {
    [eventName in string]: ZodEmptyObject;
  },
> = {
  [EventName in keyof ZodEventBodyObjectMapByEventName]: ZodEventObject<
    `${EntityName}:${Extract<EventName, string>}`,
    ZodEventBodyObjectMapByEventName[EventName]
  >;
};

export type Schema<
  EntityName extends string,
  ZodEventBodyObjectMapByEventName extends {
    [eventName in string]: ZodEmptyObject;
  },
  InitialEventName extends keyof ZodEventBodyObjectMapByEventName,
  State extends ZodEmptyObject,
> = {
  event: z.ZodDiscriminatedUnion<
    ValueOf<
      ZodEventObjectMapByEventName<EntityName, ZodEventBodyObjectMapByEventName>
    >[],
    "eventName"
  >;
  eventMap: ZodEventObjectMapByEventName<
    EntityName,
    ZodEventBodyObjectMapByEventName
  >;
  state: State;
  " $$entityName": EntityName;
  " $$eventBodyMap": ZodEventBodyObjectMapByEventName;
  " $$initialEventName": InitialEventName;
  " $$generateId": () => string;
};

export type BaseSchema = Schema<
  string,
  { [eventName in string]: ZodEmptyObject },
  string,
  ZodEmptyObject
>;

export function defineSchema<
  EntityName extends string,
  ZodEventBodyObjectMapByEventName extends {
    [eventName in string]: ZodEmptyObject;
  },
  InitialEventName extends keyof ZodEventBodyObjectMapByEventName,
  State extends ZodEmptyObject,
>(
  entityName: EntityName,
  options: {
    event: ZodEventBodyObjectMapByEventName;
    initialEventName: InitialEventName;
    state: State;
    generateId?: () => string;
  },
): Schema<
  EntityName,
  ZodEventBodyObjectMapByEventName,
  InitialEventName,
  State
> {
  // 0. prepare
  type ISchemaMap = ZodEventObjectMapByEventName<
    EntityName,
    ZodEventBodyObjectMapByEventName
  >;
  type ISchemaTuple = [ValueOf<ISchemaMap>, ...ValueOf<ISchemaMap>[]];

  const eventBodySchemaMap = options.event;
  const eventBodySchemaEntries = Object.entries(options.event);
  const BaseEventSchema = z.object({
    eventId: z.string(),
    eventCreatedAt: z.string(),
    entityName: z.string(),
    entityId: z.string(),
  });

  // 1. create event schema map
  const eventSchemaMap = eventBodySchemaEntries.reduce(
    (acc, [eventName, body]) => ({
      // biome-ignore lint/performance/noAccumulatingSpread: biome is dumb
      ...acc,
      [`${entityName}:${eventName}`]: BaseEventSchema.extend({
        eventName: z.literal(`${entityName}:${eventName}`),
        body,
      }),
    }),
    {} as ISchemaMap,
  );

  // 2. create event schema tuple
  const eventSchemaTuple = eventBodySchemaEntries.map(([eventName, body]) =>
    BaseEventSchema.extend({
      eventName: z.literal(`${entityName}:${eventName}`),
      body,
    }),
  ) as ISchemaTuple;
  const [a, ...b] = eventSchemaTuple;

  return {
    event: z.discriminatedUnion("eventName", [a, ...b]),
    eventMap: eventSchemaMap,
    state: options.state,
    " $$entityName": entityName,
    " $$eventBodyMap": eventBodySchemaMap,
    " $$initialEventName": options.initialEventName,
    " $$generateId": options.generateId ?? defaultGenerateId,
  };
}
