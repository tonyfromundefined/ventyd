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

/**
 * Type definition for a complete entity schema.
 * @internal
 */
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

/**
 * Base type for all schemas, used for type constraints.
 * @internal
 */
export type BaseSchema = Schema<
  string,
  { [eventName in string]: ZodEmptyObject },
  string,
  ZodEmptyObject
>;

/**
 * Defines a complete schema for an event-sourced entity.
 *
 * @param entityName - The canonical name for this entity type (e.g., "user", "order")
 * @param options - Schema configuration options
 * @param options.event - Map of event names to Zod schemas defining event payloads
 * @param options.initialEventName - The event name that creates new entities
 * @param options.state - Zod schema defining the shape of entity state
 * @param options.generateId - Optional custom ID generator function
 *
 * @returns A fully-typed schema object for use with Entity and Repository
 *
 * @remarks
 * The schema is the foundation of your event-sourced domain model. It defines:
 * - **Events**: All possible events and their payload structures
 * - **State**: The shape of entity state
 * - **Identity**: How entity IDs are generated
 * - **Validation**: Automatic validation through Zod schemas
 *
 * ## Architecture
 *
 * The schema serves as the single source of truth for:
 * 1. **Type Safety**: Full TypeScript inference throughout the system
 * 2. **Runtime Validation**: Automatic validation of events and state
 * 3. **Event Namespacing**: Events are prefixed with entity name (e.g., `user:created`)
 * 4. **Documentation**: Schema serves as living documentation of your domain
 *
 * ## Best Practices
 *
 * - **Event Naming**: Use past tense and snake_case for events (e.g., `created`, `updated`, `deleted`)
 * - **Event Granularity**: Prefer fine-grained events over coarse-grained ones
 * - **State Shape**: Keep state flat when possible for better performance
 * - **Optional Fields**: Use Zod's `.optional()` for nullable fields
 * - **Custom Types**: Create reusable Zod schemas for common patterns
 *
 * @example
 * ```typescript
 * import { defineSchema, z } from 'ventyd';
 *
 * const userSchema = defineSchema("user", {
 *   // Define all possible events and their payloads
 *   event: {
 *     created: z.object({
 *       email: z.string().email(),
 *       nickname: z.string().min(1).max(50),
 *       invitedBy: z.string().uuid().optional()
 *     }),
 *     profile_updated: z.object({
 *       nickname: z.string().min(1).max(50).optional(),
 *       bio: z.string().max(500).optional(),
 *       avatar: z.string().url().optional()
 *     }),
 *     verified: z.object({
 *       verifiedAt: z.string().datetime(),
 *       verificationMethod: z.enum(["email", "phone", "manual"])
 *     }),
 *     deleted: z.object({
 *       reason: z.string().optional(),
 *       deletedBy: z.string().uuid().optional()
 *     }),
 *     restored: z.object({
 *       restoredBy: z.string().uuid().optional()
 *     })
 *   },
 *
 *   // Specify which event creates new entities
 *   initialEventName: "created",
 *
 *   // Define the shape of entity state
 *   state: z.object({
 *     email: z.string().email(),
 *     nickname: z.string(),
 *     bio: z.string().nullable(),
 *     avatar: z.string().nullable(),
 *     isVerified: z.boolean(),
 *     isDeleted: z.boolean(),
 *     createdAt: z.string().datetime(),
 *     updatedAt: z.string().datetime(),
 *     verifiedAt: z.string().datetime().nullable(),
 *     deletedAt: z.string().datetime().nullable()
 *   }),
 *
 *   // Optional: Custom ID generator
 *   generateId: () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 * });
 * ```
 *
 * @since 1.0.0
 */
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
