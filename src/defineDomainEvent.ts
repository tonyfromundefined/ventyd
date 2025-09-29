import { z } from "zod";
import type { ValueOf } from "./ValueOf";
import type { ZodDomainEvent } from "./ZodDomainEvent";
import type { ZodEmptyObject } from "./ZodEmptyObject";

type $$SchemaMap<
  Namespace extends string,
  BodySchemaMap extends { [key: string]: ZodEmptyObject },
> = {
  [eventName in Extract<keyof BodySchemaMap, string>]: ZodDomainEvent<
    `${Namespace}:${eventName}`,
    BodySchemaMap[eventName]
  >;
};

export type $$DefinedDomainEvent<
  Namespace extends string,
  BodySchemaMap extends { [key: string]: ZodEmptyObject },
> = {
  " $$typeof": "DefinedDomainEvent";
  " $$namespace": Namespace;
  " $$schemaMap": $$SchemaMap<Namespace, BodySchemaMap>;
  " $$schema": z.ZodDiscriminatedUnion<
    ValueOf<$$SchemaMap<Namespace, BodySchemaMap>>[],
    "eventName"
  >;
};

export function defineDomainEvent<
  Namespace extends string,
  BodySchemaMap extends {
    [key: string]: ZodEmptyObject;
  },
>(
  namespace: Namespace,
  options: { schema: BodySchemaMap },
): $$DefinedDomainEvent<Namespace, BodySchemaMap> {
  type SchemaMap = $$SchemaMap<Namespace, BodySchemaMap>;
  type SchemaArray = [ValueOf<SchemaMap>, ...ValueOf<SchemaMap>[]];

  const baseDomainEvent = z.object({
    eventId: z.string(),
    eventCreatedAt: z.string(),
    entityName: z.string(),
    entityId: z.string(),
  });

  const bodySchemaMap = options.schema;
  const bodySchemaEntries = Object.entries(bodySchemaMap);

  const schemaMap = bodySchemaEntries.reduce((acc, [e, bodySchema]) => {
    return {
      // biome-ignore lint/performance/noAccumulatingSpread: biome is dumb
      ...acc,
      [e]: baseDomainEvent.extend({
        eventName: z.literal(`${namespace}:${e}`),
        body: bodySchema,
      }),
    };
  }, {} as SchemaMap);

  const schemaEntries = bodySchemaEntries.map(([e, bodySchema]) =>
    baseDomainEvent.extend({
      eventName: z.literal(`${namespace}:${e}`),
      body: bodySchema,
    }),
  ) as SchemaArray;

  const [a, ...b] = schemaEntries;

  return {
    " $$typeof": "DefinedDomainEvent",
    " $$namespace": namespace,
    " $$schemaMap": schemaMap,
    " $$schema": z.discriminatedUnion("eventName", [a, ...b]),
  };
}
